-- 0013 · Clientes, fidelidad y recordatorios (T-031)
-- Cubre: REQ-002.3, REQ-003.4, REQ-008.3, REQ-018.1, REQ-019.1–19.3, REQ-019.6, REQ-020.4–20.5, REQ-021.1
-- Diseño: design.md §2.2 (customers, loyalty_*, reminders), §2.5 (triggers)

create type loyalty_reward_type as enum ('free_service', 'discount');
create type loyalty_card_status as enum ('active', 'completed', 'redeemed');
create type reminder_kind as enum ('inactive');

-- ------------------------------------------------------------ customers ----
create table customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  phone_e164 text not null,
  name text not null check (length(trim(name)) between 1 and 60),
  preferred_barber_id uuid references barbers (id) on delete set null,
  preferred_barber_manual boolean not null default false, -- true si el dueño lo fijó a mano
  first_visit_at timestamptz,
  last_visit_at timestamptz,
  visits_count int not null default 0,
  notes text,
  privacy_accepted_at timestamptz,
  privacy_version int,
  do_not_contact boolean not null default false,
  referred_by uuid references customers (id), -- reservado: referidos
  anonymized_at timestamptz,
  created_at timestamptz not null default now(),
  unique (business_id, phone_e164)
);
create index customers_name_trgm_idx on customers using gin (name gin_trgm_ops);
create index customers_phone_idx on customers (business_id, phone_e164);
create index customers_last_visit_idx on customers (business_id, last_visit_at);

alter table tickets add constraint tickets_customer_fk
  foreign key (customer_id) references customers (id) on delete set null;
create index tickets_customer_id_idx on tickets (customer_id, created_at);

-- ------------------------------------------------------------- loyalty ----
create table loyalty_programs (
  business_id uuid primary key references businesses (id) on delete cascade,
  enabled boolean not null default false,
  visits_required int not null default 10 check (visits_required between 2 and 50),
  reward_type loyalty_reward_type not null default 'free_service',
  reward_service_id uuid references services (id),
  reward_amount int check (reward_amount is null or reward_amount > 0),
  updated_at timestamptz not null default now()
);

create table loyalty_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  stamps int not null default 0 check (stamps >= 0),
  status loyalty_card_status not null default 'active',
  completed_at timestamptz,
  redeemed_at timestamptz,
  redeemed_sale_id uuid, -- FK a sales en 0016 (T-040)
  created_at timestamptz not null default now()
);
-- Una sola tarjeta abierta (active o completed) por cliente
create unique index loyalty_cards_open_uniq on loyalty_cards (customer_id) where status in ('active', 'completed');
create index loyalty_cards_business_idx on loyalty_cards (business_id, status);

create table loyalty_stamps (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  card_id uuid not null references loyalty_cards (id) on delete cascade,
  ticket_id uuid not null unique references tickets (id) on delete cascade,
  at timestamptz not null default now()
);

-- ----------------------------------------------------------- reminders ----
create table reminders (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  customer_id uuid not null references customers (id) on delete cascade,
  kind reminder_kind not null default 'inactive',
  sent_by uuid,
  sent_at timestamptz not null default now()
);
create index reminders_customer_idx on reminders (customer_id, sent_at desc);

-- ------------------------------------------------- upsert de cliente ----
-- Crea/actualiza la ficha por (negocio, celular). Registra aceptación del aviso (REQ-002.3).
create or replace function upsert_customer(p_business_id uuid, p_phone text, p_name text, p_privacy_version int default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  insert into customers (business_id, phone_e164, name, privacy_accepted_at, privacy_version)
  values (p_business_id, p_phone, trim(p_name),
          case when p_privacy_version is not null then now() end, p_privacy_version)
  on conflict (business_id, phone_e164) do update
    set name = excluded.name,
        anonymized_at = null,
        privacy_accepted_at = case when excluded.privacy_version is not null
                                    and (customers.privacy_version is null or excluded.privacy_version > customers.privacy_version)
                                   then now() else customers.privacy_accepted_at end,
        privacy_version = greatest(coalesce(customers.privacy_version, 0), coalesce(excluded.privacy_version, 0))
  returning id into v_id;
  return v_id;
end $$;

-- join_queue ahora vincula la ficha del cliente (REQ-003.4) — redefinición completa.
create or replace function join_queue(
  p_slug text, p_name text, p_phone text, p_service_id uuid,
  p_preferred_barber_id uuid default null, p_privacy_version int default null, p_source ticket_source default 'qr'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  z businesses%rowtype;
  t tickets%rowtype;
  v_existing text;
  v_customer uuid;
begin
  select * into z from businesses where slug = p_slug;
  if not found then raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0002'; end if;
  if not is_business_open(z.id) then raise exception 'BUSINESS_CLOSED' using errcode = 'P0007'; end if;

  select public_token into v_existing from tickets
  where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
  if v_existing is not null then
    return jsonb_build_object('token', v_existing, 'existing', true);
  end if;

  if p_preferred_barber_id is not null and not exists (
    select 1 from barbers b where b.id = p_preferred_barber_id and b.business_id = z.id and b.is_active and b.status not in ('off', 'paused')
  ) then
    raise exception 'BARBER_UNAVAILABLE' using errcode = 'P0005';
  end if;

  v_customer := upsert_customer(z.id, p_phone, p_name, p_privacy_version);

  insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, source)
  values (z.id, v_customer, trim(p_name), p_phone, p_service_id, p_preferred_barber_id, p_source)
  returning * into t;

  return jsonb_build_object('token', t.public_token, 'existing', false);
exception
  when unique_violation then
    select public_token into v_existing from tickets
    where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
    return jsonb_build_object('token', v_existing, 'existing', true);
end $$;

-- Turnos manuales con celular también crean ficha (REQ-012.3: sin celular, no).
create or replace function add_manual_ticket(
  p_business_id uuid, p_name text, p_phone text, p_service_id uuid, p_preferred_barber_id uuid default null
) returns tickets
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
  v_customer uuid;
begin
  if auth.uid() is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if nullif(p_phone, '') is not null then
    v_customer := upsert_customer(p_business_id, p_phone, p_name, null);
  end if;
  insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, source)
  values (p_business_id, v_customer, p_name, nullif(p_phone, ''), p_service_id, p_preferred_barber_id, 'manual')
  returning * into t;
  return t;
end $$;

-- --------------------------------------------- al terminar un turno (done) ----
-- REQ-018.1 visitas/última visita/preferido · REQ-019.2–19.3 sello · REQ-008.3 (solo done)
create or replace function tickets_after_done() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  prog loyalty_programs%rowtype;
  card loyalty_cards%rowtype;
  v_counts boolean;
  v_pref uuid;
begin
  if new.status <> 'done' or old.status = 'done' or new.customer_id is null then
    return new;
  end if;

  -- Ficha
  select preferred_barber_id into v_pref
  from (
    select assigned_barber_id as preferred_barber_id, count(*) as c
    from (select assigned_barber_id from tickets
          where customer_id = new.customer_id and status = 'done' and assigned_barber_id is not null
          order by finished_at desc nulls last limit 5) last5
    group by assigned_barber_id order by c desc, max(1) limit 1
  ) s;
  perform set_config('turnos.internal', '1', true);
  update customers
     set visits_count = visits_count + 1,
         first_visit_at = coalesce(first_visit_at, new.finished_at),
         last_visit_at = new.finished_at,
         preferred_barber_id = case when preferred_barber_manual then preferred_barber_id else coalesce(v_pref, preferred_barber_id) end
   where id = new.customer_id;
  perform set_config('turnos.internal', '', true);

  -- Fidelidad
  select * into prog from loyalty_programs where business_id = new.business_id and enabled;
  if not found then return new; end if;
  select counts_for_loyalty into v_counts from services where id = new.service_id;
  if not coalesce(v_counts, false) then return new; end if;

  select * into card from loyalty_cards where customer_id = new.customer_id and status = 'active' for update;
  if not found then
    if exists (select 1 from loyalty_cards where customer_id = new.customer_id and status = 'completed') then
      return new; -- premio pendiente de canje: no se acumula encima
    end if;
    insert into loyalty_cards (business_id, customer_id) values (new.business_id, new.customer_id) returning * into card;
  end if;
  insert into loyalty_stamps (business_id, card_id, ticket_id) values (new.business_id, card.id, new.id)
  on conflict (ticket_id) do nothing;
  update loyalty_cards set stamps = stamps + 1 where id = card.id returning * into card;
  if card.stamps >= prog.visits_required then
    update loyalty_cards set status = 'completed', completed_at = now() where id = card.id;
  end if;
  return new;
end $$;

create trigger tickets_after_done after update of status on tickets
  for each row execute function tickets_after_done();

-- REQ-019.5 (canje manual mientras no exista caja) / usado también por register_sale en T-041.
create or replace function redeem_loyalty_card(p_card_id uuid, p_sale_id uuid default null)
returns loyalty_cards
language plpgsql security definer set search_path = public as $$
declare
  card loyalty_cards%rowtype;
begin
  select * into card from loyalty_cards where id = p_card_id for update;
  if not found then raise exception 'CARD_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not is_member_of(card.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if card.status <> 'completed' then
    raise exception 'CARD_NOT_COMPLETED' using errcode = 'P0004';
  end if;
  update loyalty_cards set status = 'redeemed', redeemed_at = now(), redeemed_sale_id = p_sale_id where id = card.id;
  insert into loyalty_cards (business_id, customer_id) values (card.business_id, card.customer_id);
  select * into card from loyalty_cards where id = p_card_id;
  return card;
end $$;

-- REQ-020.2: clientes para recordar (N días, excluye recordados hace < cooldown y "no contactar")
create or replace function inactive_customers(p_business_id uuid)
returns table (id uuid, name text, phone_e164 text, days_since int, visits_count int,
               preferred_barber_name text, last_reminder_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.phone_e164,
         (business_day_bogota(now()) - business_day_bogota(c.last_visit_at))::int as days_since,
         c.visits_count,
         b.display_name,
         (select max(r.sent_at) from reminders r where r.customer_id = c.id)
  from customers c
  join businesses z on z.id = c.business_id
  left join barbers b on b.id = c.preferred_barber_id
  where c.business_id = p_business_id
    and (auth.uid() is null or is_member_of(p_business_id))
    and c.anonymized_at is null
    and not c.do_not_contact
    and c.visits_count >= 1
    and c.last_visit_at < now() - make_interval(days => z.inactive_days)
    and coalesce((select max(r.sent_at) from reminders r where r.customer_id = c.id), 'epoch')
        < now() - make_interval(days => z.reminder_cooldown_days)
  order by c.last_visit_at asc
$$;

-- REQ-018.3: búsqueda por nombre (trigram) o últimos dígitos del celular
create or replace function search_customers(p_business_id uuid, p_q text, p_limit int default 30)
returns setof customers
language sql stable security definer set search_path = public as $$
  select c.* from customers c
  where c.business_id = p_business_id
    and (auth.uid() is null or is_member_of(p_business_id))
    and c.anonymized_at is null
    and (
      p_q is null or p_q = ''
      or c.name ilike '%' || p_q || '%'
      or word_similarity(p_q, c.name) > 0.5
      or (p_q ~ '^\d{3,10}$' and c.phone_e164 like '%' || p_q)
    )
  order by case when c.phone_e164 like '%' || p_q then 0 else 1 end, similarity(c.name, coalesce(p_q, '')) desc, c.last_visit_at desc nulls last
  limit p_limit
$$;

-- REQ-018.6: supresión (anonimizar conservando montos y conteos)
create or replace function anonymize_customer(p_customer_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c customers%rowtype;
begin
  select * into c from customers where id = p_customer_id for update;
  if not found then raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not is_owner_of(c.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from tickets where customer_id = c.id and status in ('waiting', 'called', 'in_service')) then
    raise exception 'CUSTOMER_HAS_ACTIVE_TICKET' using errcode = 'P0005';
  end if;
  update tickets set customer_name = 'Cliente eliminado', customer_phone_e164 = null where customer_id = c.id;
  update customers
     set name = 'Cliente eliminado', phone_e164 = 'deleted:' || c.id::text, notes = null,
         preferred_barber_id = null, do_not_contact = true, anonymized_at = now()
   where id = c.id;
  delete from reminders where customer_id = c.id;
end $$;

-- REQ-018.5: fusionar dos fichas (la secundaria se vacía en la principal)
create or replace function merge_customers(p_keep_id uuid, p_merge_id uuid)
returns customers
language plpgsql security definer set search_path = public as $$
declare
  k customers%rowtype; m customers%rowtype;
begin
  select * into k from customers where id = p_keep_id for update;
  select * into m from customers where id = p_merge_id for update;
  if k.id is null or m.id is null or k.business_id <> m.business_id then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(k.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update tickets set customer_id = k.id where customer_id = m.id;
  update loyalty_cards set customer_id = k.id where customer_id = m.id and status = 'redeemed';
  -- Tarjeta abierta: se conserva la de k; los sellos de m se suman si k no tiene abierta
  if not exists (select 1 from loyalty_cards where customer_id = k.id and status in ('active','completed')) then
    update loyalty_cards set customer_id = k.id where customer_id = m.id;
  else
    delete from loyalty_cards where customer_id = m.id and status in ('active','completed');
  end if;
  update reminders set customer_id = k.id where customer_id = m.id;
  update customers
     set visits_count = k.visits_count + m.visits_count,
         first_visit_at = least(k.first_visit_at, m.first_visit_at),
         last_visit_at = greatest(k.last_visit_at, m.last_visit_at),
         notes = concat_ws(E'\n', k.notes, m.notes)
   where id = k.id;
  delete from customers where id = m.id;
  select * into k from customers where id = k.id;
  return k;
end $$;

-- ------------------------------------------------------------------ RLS ----
alter table customers enable row level security;        alter table customers force row level security;
alter table loyalty_programs enable row level security; alter table loyalty_programs force row level security;
alter table loyalty_cards enable row level security;    alter table loyalty_cards force row level security;
alter table loyalty_stamps enable row level security;   alter table loyalty_stamps force row level security;
alter table reminders enable row level security;        alter table reminders force row level security;

create policy customers_select on customers for select to authenticated using (is_member_of(business_id));
create policy customers_owner_write on customers for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
create policy customers_barber_update on customers for update to authenticated
  using (is_member_of(business_id) and not is_owner_of(business_id))
  with check (is_member_of(business_id));

-- El barbero solo puede cambiar notes y preferred_barber (REQ-018.4)
create or replace function customers_restrict_barber_update() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_owner_of(new.business_id) or current_setting('turnos.internal', true) = '1' then
    return new;
  end if;
  if new.name <> old.name or new.phone_e164 <> old.phone_e164 or new.do_not_contact <> old.do_not_contact
     or new.visits_count <> old.visits_count or new.privacy_version is distinct from old.privacy_version
     or new.anonymized_at is distinct from old.anonymized_at then
    raise exception 'FORBIDDEN_COLUMN' using errcode = '42501';
  end if;
  if new.preferred_barber_id is distinct from old.preferred_barber_id then
    new.preferred_barber_manual := true;
  end if;
  return new;
end $$;
create trigger customers_restrict_barber_update before update on customers
  for each row execute function customers_restrict_barber_update();

create policy loyalty_programs_select on loyalty_programs for select to authenticated using (is_member_of(business_id));
create policy loyalty_programs_owner on loyalty_programs for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
create policy loyalty_cards_select on loyalty_cards for select to authenticated using (is_member_of(business_id));
create policy loyalty_stamps_select on loyalty_stamps for select to authenticated using (is_member_of(business_id));
create policy reminders_owner on reminders for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));

revoke all on function upsert_customer(uuid, text, text, int), redeem_loyalty_card(uuid, uuid),
  inactive_customers(uuid), search_customers(uuid, text, int), anonymize_customer(uuid), merge_customers(uuid, uuid) from public;
grant execute on function upsert_customer(uuid, text, text, int) to service_role;
grant execute on function redeem_loyalty_card(uuid, uuid), inactive_customers(uuid), search_customers(uuid, text, int),
  anonymize_customer(uuid), merge_customers(uuid, uuid) to authenticated, service_role;
