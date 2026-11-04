-- 0045 · Citas a hora fija: datos, agenda, reservar y cancelar (REQ-049, REQ-050, REQ-051.2,
-- REQ-054.2, REQ-054.6, ADR-033, design.md §14.1–§14.3, T-078). Todo nace apagado: sin encender las
-- citas no hay horas y nada cambia en la fila.

alter table businesses add column appointments_enabled boolean not null default false;
alter table barbers add column accepts_appointments boolean not null default false;

create type appointment_status as enum ('booked', 'arrived', 'cancelled', 'no_show');
create type appointment_source as enum ('public', 'owner');
create type appointment_cancel_reason as enum ('customer', 'business');

create table appointments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses(id) on delete cascade,
  customer_id uuid,
  customer_name text not null,
  customer_phone_e164 text not null,
  service_id uuid not null,
  service_name text not null,
  service_duration_min int not null check (service_duration_min > 0),
  service_price int not null check (service_price >= 0),
  barber_id uuid not null,
  any_barber boolean not null default false,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  business_day date not null,
  status appointment_status not null default 'booked',
  public_token text not null unique default gen_public_token(16),
  ticket_id uuid unique references tickets(id),
  source appointment_source not null,
  cancel_reason appointment_cancel_reason,
  created_by uuid,
  created_at timestamptz not null default now(),
  arrived_at timestamptz,
  cancelled_at timestamptz,
  check (ends_at > starts_at),
  foreign key (business_id, customer_id) references customers (business_id, id),
  foreign key (business_id, service_id) references services (business_id, id),
  foreign key (business_id, barber_id) references barbers (business_id, id)
);
create index appointments_business_day_idx on appointments (business_id, business_day, status);
create index appointments_barber_starts_idx on appointments (barber_id, starts_at);
-- REQ-050.5 una cita pendiente por celular y negocio
create unique index appointments_one_booked_per_phone on appointments (business_id, customer_phone_e164)
  where status = 'booked';

-- ------------------------------------------------------------------ RLS ----
alter table appointments enable row level security;
alter table appointments force row level security;
create policy appointments_owner_select on appointments for select to authenticated
  using (is_owner_of(business_id));
-- REQ-054.6 el barbero solo ve las suyas de hoy
create policy appointments_barber_select on appointments for select to authenticated
  using (barber_id = my_barber_id(business_id) and business_day = business_day_bogota(now()));
revoke all on appointments from anon, authenticated;
grant select on appointments to authenticated;
grant all on appointments to service_role;

-- REQ-049.6 el barbero no se marca solo para recibir citas (trigger de 0003)
create or replace function barbers_restrict_self_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- El dueño (o una función con service_role, donde auth.uid() es null) puede cambiar todo.
  if auth.uid() is null or is_owner_of(new.business_id) then
    return new;
  end if;
  if new.business_id <> old.business_id or new.user_id is distinct from old.user_id
     or new.display_name <> old.display_name or new.phone_e164 is distinct from old.phone_e164
     or new.commission_pct <> old.commission_pct or new.is_active <> old.is_active
     or new.sort_order <> old.sort_order or new.duration_factor is distinct from old.duration_factor
     or new.accepts_appointments <> old.accepts_appointments then
    raise exception 'FORBIDDEN_COLUMN' using errcode = '42501',
      hint = 'El barbero solo puede cambiar su estado.';
  end if;
  return new;
end $$;

-- ------------------------------------------------------------- ajustes ----
-- REQ-049.1, 049.2, 049.6 encender/apagar y barberos que reciben citas (solo activos)
create or replace function save_appointment_settings(p_business_id uuid, p_enabled boolean, p_barber_ids uuid[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update businesses set appointments_enabled = p_enabled where id = p_business_id;
  update barbers set accepts_appointments = (is_active and id = any(coalesce(p_barber_ids, '{}')))
   where business_id = p_business_id;
end $$;

-- --------------------------------------------------------------- huecos ----
-- design.md §14.1: tolerancia de 10 min; una cita pendiente pierde la hora después.
create or replace function appointment_lapsed(p_starts_at timestamptz) returns boolean
language sql stable set search_path = public as $$
  select now() > p_starts_at + interval '10 minutes'
$$;

-- Hora libre de un barbero: [p_start, p_end) no se cruza con citas pendientes que no perdieron la
-- hora ni con citas llegadas a tiempo cuyo turno sigue activo.
create or replace function barber_time_free(p_barber_id uuid, p_start timestamptz, p_end timestamptz,
                                            p_exclude uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (
    select 1 from appointments a
    left join tickets t on t.id = a.ticket_id
    where a.barber_id = p_barber_id
      and a.id is distinct from p_exclude
      and a.starts_at < p_end and a.ends_at > p_start
      and ((a.status = 'booked' and not appointment_lapsed(a.starts_at))
           or (a.status = 'arrived' and t.scheduled_at is not null
               and t.status in ('waiting', 'called', 'in_service')))
  )
$$;

-- Barbero que puede recibir una cita de ese servicio (REQ-049.2, 049.3)
create or replace function barber_takes_appointments(p_barber_id uuid, p_service_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from barbers b where b.id = p_barber_id and b.is_active and b.accepts_appointments)
     and barber_does_service(p_barber_id, p_service_id)
$$;

-- REQ-049.3–049.5 la hora es válida en la agenda (sin mirar si está libre)
create or replace function appointment_time_valid(p_business_id uuid, p_starts_at timestamptz, p_duration_min int,
                                                  p_min_start timestamptz) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  z businesses%rowtype;
  v_local timestamp := p_starts_at at time zone 'America/Bogota';
  v_day date := v_local::date;
  v_today date := business_day_bogota(now());
  h business_hours%rowtype;
begin
  select * into z from businesses where id = p_business_id;
  if not found or not z.appointments_enabled then return false; end if;
  if p_starts_at < p_min_start or v_day < v_today or v_day > v_today + 7 then return false; end if;
  if z.queue_override = 'closed' and z.queue_override_day = v_day then return false; end if;
  select * into h from business_hours where business_id = p_business_id and weekday = extract(dow from v_day)::int;
  if not found or h.is_closed then return false; end if;
  if v_local::time < h.opens_at or v_local::time + make_interval(mins => p_duration_min) > h.closes_at
     or (v_local::time + make_interval(mins => p_duration_min)) < v_local::time then
    return false;
  end if;
  -- Cada 15 minutos desde la apertura
  return extract(epoch from (v_local::time - h.opens_at))::int % 900 = 0
     and extract(second from v_local) = 0;
end $$;

-- REQ-049.3 horas disponibles de un día. p_barber_id null = "El que esté libre".
create or replace function appointment_slots(p_business_id uuid, p_service_id uuid, p_barber_id uuid,
                                             p_day date, p_min_start timestamptz)
returns table (starts_at timestamptz, barber_ids uuid[])
language plpgsql stable security definer set search_path = public as $$
declare
  s services%rowtype;
  h business_hours%rowtype;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into s from services where id = p_service_id and business_id = p_business_id and is_active;
  if not found then return; end if;
  select * into h from business_hours where business_id = p_business_id and weekday = extract(dow from p_day)::int;
  if not found or h.is_closed then return; end if;
  return query
    select g.at, array_agg(b.id order by b.sort_order, b.id)
    from generate_series((p_day + h.opens_at) at time zone 'America/Bogota',
                         (p_day + h.closes_at) at time zone 'America/Bogota' - make_interval(mins => s.duration_min),
                         interval '15 minutes') as g(at)
    join barbers b on b.business_id = p_business_id
      and (p_barber_id is null or b.id = p_barber_id)
      and barber_takes_appointments(b.id, s.id)
      and barber_time_free(b.id, g.at, g.at + make_interval(mins => s.duration_min))
    where appointment_time_valid(p_business_id, g.at, s.duration_min, p_min_start)
    group by g.at
    order by g.at;
end $$;

-- Versión pública por slug (service_role): mínimo 1 hora desde ahora (REQ-049.4)
create or replace function public_appointment_slots(p_slug text, p_service_id uuid, p_barber_id uuid, p_day date)
returns table (starts_at timestamptz, barber_ids uuid[])
language sql stable security definer set search_path = public as $$
  select s.* from businesses z,
    lateral appointment_slots(z.id, p_service_id, p_barber_id, p_day, now() + interval '1 hour') s
  where z.slug = p_slug
$$;

-- -------------------------------------------------------------- reservar ----
-- REQ-050.2–050.6. Público (service_role, auth.uid() null): mínimo 1 h. Dueño: cualquier hora libre
-- que no haya pasado. Devuelve {token, existing}: con una cita pendiente del mismo celular devuelve
-- esa (REQ-050.5), como join_queue con un turno activo.
create or replace function book_appointment(
  p_business_id uuid, p_service_id uuid, p_barber_id uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_privacy_version int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_owner boolean := auth.uid() is not null;
  v_min timestamptz;
  s services%rowtype;
  v_existing text;
  v_barber uuid;
  v_chosen uuid;
  v_customer uuid;
  a appointments%rowtype;
begin
  if v_owner and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not (select appointments_enabled from businesses where id = p_business_id) then
    raise exception 'APPOINTMENTS_DISABLED' using errcode = 'P0004';
  end if;
  if p_phone is null or p_phone !~ '^\+573[0-9]{9}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0004';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'INVALID_NAME' using errcode = 'P0004';
  end if;

  -- Citas del mismo celular que ya perdieron la hora no estorban (design.md §14.1)
  update appointments set status = 'no_show'
   where business_id = p_business_id and customer_phone_e164 = p_phone and status = 'booked'
     and appointment_lapsed(starts_at);
  select public_token into v_existing from appointments
   where business_id = p_business_id and customer_phone_e164 = p_phone and status = 'booked';
  if v_existing is not null then
    return jsonb_build_object('token', v_existing, 'existing', true);
  end if;

  select * into s from services where id = p_service_id and business_id = p_business_id and is_active;
  v_min := case when v_owner then now() else now() + interval '1 hour' end;
  if not found or not appointment_time_valid(p_business_id, p_starts_at, s.duration_min, v_min)
     or (p_barber_id is not null and not barber_takes_appointments(p_barber_id, p_service_id)) then
    raise exception 'SLOT_UNAVAILABLE' using errcode = 'P0004';
  end if;

  -- REQ-050.3 / 050.4 candidatos en orden; el candado por barbero serializa las reservas
  for v_barber in
    select b.id from barbers b
    where b.business_id = p_business_id
      and (p_barber_id is null or b.id = p_barber_id)
      and barber_takes_appointments(b.id, p_service_id)
    order by (select count(*) from appointments x
               where x.barber_id = b.id and x.business_day = (p_starts_at at time zone 'America/Bogota')::date
                 and x.status in ('booked', 'arrived')),
             b.sort_order, b.id
  loop
    perform pg_advisory_xact_lock(hashtext('appointments:' || v_barber::text));
    if barber_time_free(v_barber, p_starts_at, p_starts_at + make_interval(mins => s.duration_min)) then
      v_chosen := v_barber;
      exit;
    end if;
  end loop;
  if v_chosen is null then
    raise exception 'SLOT_TAKEN' using errcode = 'P0004';
  end if;

  v_customer := upsert_customer(p_business_id, p_phone, p_name, p_privacy_version);
  insert into appointments (business_id, customer_id, customer_name, customer_phone_e164, service_id, service_name,
                            service_duration_min, service_price, barber_id, any_barber, starts_at, ends_at,
                            business_day, source, created_by)
  values (p_business_id, v_customer, trim(p_name), p_phone, s.id, s.name, s.duration_min, s.price, v_chosen,
          p_barber_id is null, p_starts_at, p_starts_at + make_interval(mins => s.duration_min),
          (p_starts_at at time zone 'America/Bogota')::date,
          (case when v_owner then 'owner' else 'public' end)::appointment_source, auth.uid())
  returning * into a;
  return jsonb_build_object('token', a.public_token, 'existing', false, 'id', a.id);
exception
  when unique_violation then
    select public_token into v_existing from appointments
     where business_id = p_business_id and customer_phone_e164 = p_phone and status = 'booked';
    return jsonb_build_object('token', v_existing, 'existing', true);
end $$;

create or replace function public_book_appointment(
  p_slug text, p_service_id uuid, p_barber_id uuid, p_starts_at timestamptz,
  p_name text, p_phone text, p_privacy_version int default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid;
begin
  select id into v_biz from businesses where slug = p_slug;
  if v_biz is null then raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0002'; end if;
  return book_appointment(v_biz, p_service_id, p_barber_id, p_starts_at, p_name, p_phone, p_privacy_version);
end $$;

-- ------------------------------------------------------------ Mi cita ----
-- REQ-051.1, 051.4, 051.5, 051.6: nunca el celular
create or replace function get_appointment_by_token(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'status', a.status, 'lapsed', a.status = 'booked' and appointment_lapsed(a.starts_at),
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'durationMin', a.service_duration_min,
    'serviceName', a.service_name, 'price', a.service_price, 'customerName', a.customer_name,
    'barberName', b.display_name, 'cancelReason', a.cancel_reason,
    'ticketToken', t.public_token,
    'business', jsonb_build_object('name', z.name, 'slug', z.slug, 'address', z.address)
  )
  from appointments a
  join businesses z on z.id = a.business_id
  join barbers b on b.id = a.barber_id
  left join tickets t on t.id = a.ticket_id
  where a.public_token = p_token
$$;

-- REQ-051.2 el cliente cancela cuando quiera mientras esté pendiente
create or replace function cancel_appointment_by_token(p_token text) returns appointment_status
language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype;
begin
  select * into a from appointments where public_token = p_token for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if a.status = 'cancelled' and a.cancel_reason = 'customer' then return a.status; end if;
  if a.status <> 'booked' then raise exception 'NOT_CANCELLABLE' using errcode = 'P0004'; end if;
  update appointments set status = 'cancelled', cancel_reason = 'customer', cancelled_at = now() where id = a.id;
  return 'cancelled';
end $$;

-- REQ-054.2 el dueño cancela
create or replace function cancel_appointment(p_id uuid) returns appointments
language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype;
begin
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not is_owner_of(a.business_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if a.status <> 'booked' then raise exception 'NOT_CANCELLABLE' using errcode = 'P0004'; end if;
  update appointments set status = 'cancelled', cancel_reason = 'business', cancelled_at = now()
   where id = a.id returning * into a;
  return a;
end $$;

-- REQ-054.2 el dueño la pasa a otro barbero con la hora libre
create or replace function reassign_appointment(p_id uuid, p_barber_id uuid) returns appointments
language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype;
begin
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not is_owner_of(a.business_id) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if a.status <> 'booked' then raise exception 'NOT_CANCELLABLE' using errcode = 'P0004'; end if;
  if not exists (select 1 from barbers where id = p_barber_id and business_id = a.business_id)
     or not barber_takes_appointments(p_barber_id, a.service_id) then
    raise exception 'BARBER_CANT_DO_SERVICE' using errcode = 'P0010';
  end if;
  perform pg_advisory_xact_lock(hashtext('appointments:' || p_barber_id::text));
  if not barber_time_free(p_barber_id, a.starts_at, a.ends_at, a.id) then
    raise exception 'SLOT_TAKEN' using errcode = 'P0004';
  end if;
  update appointments set barber_id = p_barber_id, any_barber = false where id = a.id returning * into a;
  return a;
end $$;

-- ------------------------------------------------------------- permisos ----
revoke all on function save_appointment_settings(uuid, boolean, uuid[]), appointment_lapsed(timestamptz),
  barber_time_free(uuid, timestamptz, timestamptz, uuid), barber_takes_appointments(uuid, uuid),
  appointment_time_valid(uuid, timestamptz, int, timestamptz),
  appointment_slots(uuid, uuid, uuid, date, timestamptz), public_appointment_slots(text, uuid, uuid, date),
  book_appointment(uuid, uuid, uuid, timestamptz, text, text, int),
  public_book_appointment(text, uuid, uuid, timestamptz, text, text, int),
  get_appointment_by_token(text), cancel_appointment_by_token(text), cancel_appointment(uuid),
  reassign_appointment(uuid, uuid) from public, anon;
grant execute on function save_appointment_settings(uuid, boolean, uuid[]),
  appointment_slots(uuid, uuid, uuid, date, timestamptz),
  book_appointment(uuid, uuid, uuid, timestamptz, text, text, int),
  cancel_appointment(uuid), reassign_appointment(uuid, uuid) to authenticated, service_role;
grant execute on function appointment_lapsed(timestamptz), barber_time_free(uuid, timestamptz, timestamptz, uuid),
  barber_takes_appointments(uuid, uuid), appointment_time_valid(uuid, timestamptz, int, timestamptz),
  public_appointment_slots(text, uuid, uuid, date), public_book_appointment(text, uuid, uuid, timestamptz, text, text, int),
  get_appointment_by_token(text), cancel_appointment_by_token(text) to service_role;
