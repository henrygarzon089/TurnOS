-- 0005 · Turnos, eventos, estado de barberos, rate limit (T-011)
-- Cubre: REQ-003.3–3.5, REQ-007.7, REQ-011.5, REQ-028.2 (fuente), NFR-004. Diseño: design.md §2.2

create type ticket_status as enum ('waiting', 'called', 'in_service', 'done', 'cancelled', 'no_show');
create type cancel_reason as enum ('customer', 'business', 'closing', 'barber_removed');
create type payment_status as enum ('n/a', 'pending', 'paid', 'unpaid');
create type ticket_source as enum ('qr', 'link', 'manual');
create type actor_type as enum ('customer', 'barber', 'owner', 'system');

-- Día de negocio en Bogotá (REQ-027.5). Colombia no tiene horario de verano.
create or replace function business_day_bogota(at timestamptz default now()) returns date
language sql immutable as $$
  select (at at time zone 'America/Bogota')::date
$$;

-- ------------------------------------------------------------- tickets ----
create table tickets (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  business_day date not null,
  sequence bigint not null,
  queue_order bigint not null,
  display_number int not null,
  customer_id uuid, -- FK a customers se agrega en 0011 (T-031)
  customer_name text not null check (length(trim(customer_name)) between 1 and 60),
  customer_phone_e164 text check (customer_phone_e164 is null or customer_phone_e164 ~ '^\+573\d{9}$'),
  service_id uuid not null references services (id),
  service_name text not null,
  service_duration_min int not null,
  service_price int not null,
  preferred_barber_id uuid references barbers (id), -- null = "el que esté libre"
  assigned_barber_id uuid references barbers (id),
  status ticket_status not null default 'waiting',
  public_token text not null unique default gen_public_token(16),
  created_at timestamptz not null default now(),
  called_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  cancel_reason cancel_reason,
  notified_at timestamptz,
  notified_by uuid,
  payment_status payment_status not null default 'n/a',
  scheduled_at timestamptz, -- reservado: reservas con hora fija
  source ticket_source not null default 'qr',
  unique (business_id, business_day, sequence)
);

create index tickets_day_status_idx on tickets (business_id, business_day, status);
create index tickets_queue_idx on tickets (business_id, status, queue_order);
create index tickets_customer_idx on tickets (business_id, customer_phone_e164);
-- REQ-003.5 / CB-04 / CB-21: un solo turno activo por celular y negocio
create unique index tickets_active_phone_uniq on tickets (business_id, customer_phone_e164)
  where status in ('waiting', 'called', 'in_service') and customer_phone_e164 is not null;

-- Numeración por negocio y día + orden + copia de servicio
create or replace function tickets_before_insert() returns trigger
language plpgsql as $$
declare
  v_seq bigint;
begin
  new.business_day := coalesce(new.business_day, business_day_bogota(coalesce(new.created_at, now())));
  -- Serializa la numeración por negocio/día con un lock consultivo
  perform pg_advisory_xact_lock(hashtext(new.business_id::text || new.business_day::text));
  select coalesce(max(sequence), 0) + 1 into v_seq
  from tickets where business_id = new.business_id and business_day = new.business_day;
  new.sequence := v_seq;
  new.display_number := v_seq;
  new.queue_order := coalesce(new.queue_order, v_seq * 1000); -- ADR-012
  -- Copia del servicio (REQ-015.3)
  select s.name, s.duration_min, s.price
    into new.service_name, new.service_duration_min, new.service_price
  from services s where s.id = new.service_id and s.business_id = new.business_id;
  if new.service_name is null then
    raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if new.preferred_barber_id is not null and not exists (
    select 1 from barbers b where b.id = new.preferred_barber_id and b.business_id = new.business_id and b.is_active
  ) then
    raise exception 'BARBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  return new;
end $$;

create trigger tickets_before_insert before insert on tickets
  for each row execute function tickets_before_insert();

-- ------------------------------------------------------ ticket_events ----
create table ticket_events (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  ticket_id uuid not null references tickets (id) on delete cascade,
  from_status ticket_status,
  to_status ticket_status not null,
  actor_type actor_type not null,
  actor_user_id uuid,
  reason text,
  meta jsonb,
  at timestamptz not null default now()
);
create index ticket_events_ticket_idx on ticket_events (ticket_id, at);

-- Evento inicial al crear el turno (REQ-007.7)
create or replace function tickets_after_insert_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into ticket_events (business_id, ticket_id, from_status, to_status, actor_type, meta)
  values (new.business_id, new.id, null, new.status,
          case when new.source = 'manual' then 'owner'::actor_type else 'customer'::actor_type end,
          jsonb_build_object('source', new.source));
  return new;
end $$;
create trigger tickets_after_insert_event after insert on tickets
  for each row execute function tickets_after_insert_event();

-- ------------------------------------------------- barber_status_events ----
create table barber_status_events (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  barber_id uuid not null references barbers (id) on delete cascade,
  status barber_status not null,
  at timestamptz not null default now()
);
create index barber_status_events_idx on barber_status_events (barber_id, at);

create or replace function barbers_status_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into barber_status_events (business_id, barber_id, status) values (new.business_id, new.id, new.status);
  end if;
  return new;
end $$;
create trigger barbers_status_event after insert or update of status on barbers
  for each row execute function barbers_status_event();

-- ---------------------------------------------------------- rate_limits ----
create table rate_limits (
  key text not null,
  window_start timestamptz not null,
  count int not null default 0,
  primary key (key, window_start)
);
alter table rate_limits enable row level security; -- sin políticas: solo service_role
revoke all on rate_limits from authenticated, anon;

-- Devuelve true si la acción cabe en el límite (y la cuenta); false si se superó (NFR-004).
create or replace function check_rate_limit(p_key text, p_limit int, p_window interval default interval '1 hour')
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  v_count int;
begin
  insert into rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  -- Limpieza oportunista de ventanas viejas
  delete from rate_limits where window_start < now() - p_window * 2 and random() < 0.05;
  return v_count <= p_limit;
end $$;
revoke all on function check_rate_limit(text, int, interval) from public;
grant execute on function check_rate_limit(text, int, interval) to service_role;

-- Secuencias (bigserial) usadas por triggers que corren con el rol del usuario
grant usage, select on all sequences in schema public to authenticated, service_role;
alter default privileges in schema public grant usage, select on sequences to authenticated, service_role;

-- --------------------------------------------------------------- RLS ----
alter table tickets enable row level security;              alter table tickets force row level security;
alter table ticket_events enable row level security;        alter table ticket_events force row level security;
alter table barber_status_events enable row level security; alter table barber_status_events force row level security;

-- Personal: lee turnos y eventos de su negocio. Cambios SOLO vía funciones (T-012/T-013).
create policy tickets_select on tickets for select to authenticated using (is_member_of(business_id));
create policy ticket_events_select on ticket_events for select to authenticated using (is_member_of(business_id));
create policy barber_status_events_select on barber_status_events for select to authenticated using (is_member_of(business_id));
-- El dueño puede editar campos no transicionales (notified_at, orden) directamente; el barbero no.
create policy tickets_owner_update on tickets for update to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
