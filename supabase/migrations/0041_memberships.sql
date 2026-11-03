-- 0041 · Hito 7, membresía familiar: plan y familia (T-071, ADR-030)
-- Cubre: REQ-044.1–044.4, REQ-046.1–046.4; REQ-018.5/018.6 con familias. Diseño: design.md §13.1–§13.3.
-- La familia se llama `family_memberships` porque `memberships` ya es el personal de cada negocio
-- (0002). Todo nace apagado: sin plan encendido nada cambia en la fila ni en la caja.

-- ------------------------------------------------------------ columnas ----
-- REQ-044.1 qué servicios gastan cortes: por defecto solo "Corte"
alter table services add column counts_for_membership boolean not null default false;
update services set counts_for_membership = true where lower(trim(name)) = 'corte';

-- FK compuestas: la ficha del mismo negocio que la familia
alter table customers add constraint customers_business_id_uniq unique (business_id, id);

create type membership_period_status as enum ('active', 'voided');

-- --------------------------------------------------- membership_plans ----
-- REQ-044.1 / REQ-044.2 un único plan por negocio, apagado por defecto
create table membership_plans (
  business_id uuid primary key references businesses (id) on delete cascade,
  enabled boolean not null default false,
  price int check (price > 0),
  cuts_per_period int check (cuts_per_period between 1 and 100),
  discount_pct int check (discount_pct between 0 and 100),
  updated_at timestamptz not null default now(),
  constraint membership_plans_complete_ck check (
    not enabled or (price is not null and cuts_per_period is not null and discount_pct is not null))
);

-- ------------------------------------------------- family_memberships ----
-- REQ-046.1 una familia con su titular
create table family_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  holder_customer_id uuid not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (business_id, id),
  foreign key (business_id, holder_customer_id) references customers (business_id, id)
);
create index family_memberships_holder_idx on family_memberships (holder_customer_id);

-- REQ-046.1 / REQ-046.4 miembros (el titular es uno más); quitar deja la fila con removed_at
create table membership_members (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  membership_id uuid not null,
  customer_id uuid not null,
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  foreign key (business_id, membership_id) references family_memberships (business_id, id) on delete cascade,
  foreign key (business_id, customer_id) references customers (business_id, id)
);
create unique index membership_members_active_uniq on membership_members (membership_id, customer_id)
  where removed_at is null;
create index membership_members_customer_idx on membership_members (customer_id) where removed_at is null;

-- REQ-044.4 / REQ-045.3 periodos pagados: copia del plan al pagar (los crea register_membership_fee, 0042)
create table membership_periods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  membership_id uuid not null,
  sale_id uuid not null unique references sales (id),
  starts_on date not null,
  ends_on date not null,
  cuts_total int not null check (cuts_total between 1 and 100),
  price int not null check (price > 0),
  discount_pct int not null check (discount_pct between 0 and 100),
  status membership_period_status not null default 'active',
  constraint membership_periods_30_days_ck check (ends_on = starts_on + 29),
  foreign key (business_id, membership_id) references family_memberships (business_id, id) on delete cascade
);
create index membership_periods_membership_idx on membership_periods (membership_id, ends_on desc);

-- ------------------------------------------------------------------ RLS ----
-- §13.2 el dueño lee; el barbero no ve nada; los cambios solo con las funciones de abajo
alter table membership_plans enable row level security;
alter table membership_plans force row level security;
alter table family_memberships enable row level security;
alter table family_memberships force row level security;
alter table membership_members enable row level security;
alter table membership_members force row level security;
alter table membership_periods enable row level security;
alter table membership_periods force row level security;

create policy membership_plans_owner_select on membership_plans for select to authenticated
  using (is_owner_of(business_id));
create policy family_memberships_owner_select on family_memberships for select to authenticated
  using (is_owner_of(business_id));
create policy membership_members_owner_select on membership_members for select to authenticated
  using (is_owner_of(business_id));
create policy membership_periods_owner_select on membership_periods for select to authenticated
  using (is_owner_of(business_id));

revoke all on membership_plans, family_memberships, membership_members, membership_periods
  from public, anon, authenticated;
grant select on membership_plans, family_memberships, membership_members, membership_periods to authenticated;
grant all on membership_plans, family_memberships, membership_members, membership_periods to service_role;

-- ------------------------------------------------------------ funciones ----
-- REQ-044.2 / REQ-044.4 el dueño guarda el plan. Cambiarlo no toca periodos pagados (son copia).
create or replace function save_membership_plan(
  p_business_id uuid, p_enabled boolean, p_price int, p_cuts int, p_discount_pct int
) returns membership_plans
language plpgsql security definer set search_path = public as $$
declare
  r membership_plans%rowtype;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_enabled and (p_price is null or p_cuts is null or p_discount_pct is null
                    or not exists (select 1 from services where business_id = p_business_id
                                   and counts_for_membership)) then
    raise exception 'PLAN_INCOMPLETE' using errcode = 'P0004';
  end if;
  insert into membership_plans (business_id, enabled, price, cuts_per_period, discount_pct)
  values (p_business_id, coalesce(p_enabled, false), p_price, p_cuts, p_discount_pct)
  on conflict (business_id) do update
    set enabled = excluded.enabled, price = excluded.price, cuts_per_period = excluded.cuts_per_period,
        discount_pct = excluded.discount_pct, updated_at = now()
  returning * into r;
  return r;
end $$;

-- REQ-046.3 familia que retiene a sus miembros: tiene un periodo activo que no ha terminado
-- (vigente o pagado por adelantado)
create or replace function family_is_current(p_membership_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership_periods where membership_id = p_membership_id
                 and status = 'active' and ends_on >= business_day_bogota(now()))
$$;

-- REQ-046.2 ficha por celular: la existente tal cual, o una nueva con el nombre, sin aviso de
-- privacidad ni permiso de WhatsApp (esos los da el cliente al tomar turno)
create or replace function membership_customer(p_business_id uuid, p_phone text, p_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  if p_phone is null or p_phone !~ '^\+573\d{9}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0004';
  end if;
  select id into v_id from customers where business_id = p_business_id and phone_e164 = p_phone for update;
  if v_id is null then
    insert into customers (business_id, phone_e164, name) values (p_business_id, p_phone, trim(p_name))
    on conflict (business_id, phone_e164) do nothing
    returning id into v_id;
    if v_id is null then
      select id into v_id from customers where business_id = p_business_id and phone_e164 = p_phone for update;
    end if;
  end if;
  return v_id;
end $$;

-- REQ-046.3 entra a una familia: si está en otra que lo retiene, no; si la otra ya no tiene
-- periodo, sale de ella. REQ-046.1 máximo 5 contando al titular. Devuelve la fila del miembro.
create or replace function membership_join(p_membership_id uuid, p_customer_id uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from membership_members
   where membership_id = p_membership_id and customer_id = p_customer_id and removed_at is null;
  if v_id is not null then
    return v_id;
  end if;
  if exists (select 1 from membership_members
             where customer_id = p_customer_id and removed_at is null and membership_id <> p_membership_id
               and family_is_current(membership_id)) then
    raise exception 'MEMBER_IN_OTHER_FAMILY' using errcode = 'P0004';
  end if;
  if (select count(*) from membership_members where membership_id = p_membership_id and removed_at is null) >= 5 then
    raise exception 'FAMILY_FULL' using errcode = 'P0004';
  end if;
  update membership_members set removed_at = now()
   where customer_id = p_customer_id and removed_at is null and membership_id <> p_membership_id;
  insert into membership_members (business_id, membership_id, customer_id)
  select business_id, id, p_customer_id from family_memberships where id = p_membership_id
  returning id into v_id;
  return v_id;
end $$;

-- REQ-046.1 / REQ-046.2 el dueño crea la familia con su titular
create or replace function create_membership(p_business_id uuid, p_holder_phone text, p_holder_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid;
  v_id uuid;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_customer := membership_customer(p_business_id, p_holder_phone, p_holder_name);
  insert into family_memberships (business_id, holder_customer_id, created_by)
  values (p_business_id, v_customer, auth.uid())
  returning id into v_id;
  perform membership_join(v_id, v_customer);
  return v_id;
end $$;

-- REQ-046.2 / REQ-046.4 el dueño agrega a alguien en cualquier momento
create or replace function add_membership_member(p_membership_id uuid, p_phone text, p_name text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  f family_memberships%rowtype;
begin
  select * into f from family_memberships where id = p_membership_id for update; -- dos altas a la vez no pasan de 5
  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(f.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return membership_join(f.id, membership_customer(f.business_id, p_phone, p_name));
end $$;

-- REQ-046.4 quitar no devuelve cortes y deja a la persona libre para otra familia
create or replace function remove_membership_member(p_member_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  m membership_members%rowtype;
begin
  select * into m from membership_members where id = p_member_id for update;
  if not found or m.removed_at is not null then
    raise exception 'MEMBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(m.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update membership_members set removed_at = now() where id = m.id;
end $$;

-- REQ-018.6 eliminar la ficha la saca de su familia (si era titular, la familia conserva periodos y ventas)
create or replace function customers_leave_family_on_anonymize() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update membership_members set removed_at = now() where customer_id = new.id and removed_at is null;
  return null;
end $$;
create trigger customers_leave_family_on_anonymize after update of anonymized_at on customers
  for each row when (new.anonymized_at is not null and old.anonymized_at is null)
  execute function customers_leave_family_on_anonymize();

-- ------------------------------------------------------ merge_customers ----
-- REQ-018.5 redefinición de 0036: las filas de la familia pasan a la ficha que se conserva antes
-- de borrar la otra. Dos fichas en familias distintas que las retienen → BOTH_IN_FAMILIES
-- (Henry, 2026-11-02, design.md §13.1): el dueño primero saca a una de su familia.
create or replace function merge_customers(p_keep_id uuid, p_merge_id uuid)
returns customers
language plpgsql security definer set search_path = public as $$
declare
  k customers%rowtype;
  m customers%rowtype;
  kc loyalty_cards%rowtype;
  mc loyalty_cards%rowtype;
  target loyalty_cards%rowtype;
  other loyalty_cards%rowtype;
  prog loyalty_programs%rowtype;
  v_pref uuid;
  v_kfam uuid;
  v_mfam uuid;
begin
  if p_keep_id = p_merge_id then
    raise exception 'SAME_CUSTOMER' using errcode = 'P0004';
  end if;
  select * into k from customers where id = p_keep_id for update;
  select * into m from customers where id = p_merge_id for update;
  if k.id is null or m.id is null or k.business_id <> m.business_id then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(k.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if k.anonymized_at is not null or m.anonymized_at is not null then
    raise exception 'CUSTOMER_ANONYMIZED' using errcode = 'P0004';
  end if;

  select * into kc from loyalty_cards where customer_id = k.id and status in ('active', 'completed') for update;
  select * into mc from loyalty_cards where customer_id = m.id and status in ('active', 'completed') for update;
  if kc.status = 'completed' and mc.status = 'completed' then
    raise exception 'BOTH_REWARDS_PENDING' using errcode = 'P0004';
  end if;

  -- Familias: cada ficha está a lo sumo en una (membership_join la saca de las demás)
  select membership_id into v_kfam from membership_members where customer_id = k.id and removed_at is null;
  select membership_id into v_mfam from membership_members where customer_id = m.id and removed_at is null;
  if v_kfam is not null and v_mfam is not null and v_kfam <> v_mfam then
    if family_is_current(v_kfam) and family_is_current(v_mfam) then
      raise exception 'BOTH_IN_FAMILIES' using errcode = 'P0004';
    end if;
    -- Se queda la familia que la retiene; si ninguna, la de la ficha que se conserva
    if family_is_current(v_mfam) then
      update membership_members set removed_at = now() where customer_id = k.id and removed_at is null;
    else
      update membership_members set removed_at = now() where customer_id = m.id and removed_at is null;
    end if;
  elsif v_kfam is not null and v_kfam = v_mfam then
    update membership_members set removed_at = now() where customer_id = m.id and removed_at is null;
  end if;
  update membership_members set customer_id = k.id where customer_id = m.id;
  update family_memberships set holder_customer_id = k.id where holder_customer_id = m.id;

  -- Historial
  update tickets set customer_id = k.id where customer_id = m.id;
  update reminders set customer_id = k.id where customer_id = m.id;
  update loyalty_cards set customer_id = k.id where customer_id = m.id and status = 'redeemed';

  -- Tarjetas abiertas: se juntan en una (ADR-016)
  if mc.id is not null and kc.id is null then
    update loyalty_cards set customer_id = k.id where id = mc.id;
  elsif mc.id is not null and kc.id is not null then
    if mc.status = 'completed' then
      target := mc; other := kc;
    else
      target := kc; other := mc;
    end if;
    update loyalty_stamps set card_id = target.id where card_id = other.id;
    delete from loyalty_cards where id = other.id;
    update loyalty_cards set customer_id = k.id, stamps = target.stamps + other.stamps
     where id = target.id returning * into target;
    select * into prog from loyalty_programs where business_id = k.business_id and enabled;
    if found and target.status = 'active' and target.stamps >= prog.visits_required then
      update loyalty_cards set status = 'completed', completed_at = now() where id = target.id;
    end if;
  end if;

  -- Preferido: el más elegido en los últimos 5 turnos terminados de la ficha unida
  select s.assigned_barber_id into v_pref
  from (
    select assigned_barber_id, count(*) as c
    from (select assigned_barber_id from tickets
          where customer_id = k.id and status = 'done' and assigned_barber_id is not null
          order by finished_at desc nulls last limit 5) last5
    group by assigned_barber_id order by c desc limit 1
  ) s;

  delete from customers where id = m.id;

  perform set_config('turnos.internal', '1', true);
  update customers
     set visits_count = k.visits_count + m.visits_count,
         first_visit_at = least(k.first_visit_at, m.first_visit_at),
         last_visit_at = greatest(k.last_visit_at, m.last_visit_at),
         notes = nullif(concat_ws(E'\n', nullif(trim(k.notes), ''), nullif(trim(m.notes), '')), ''),
         privacy_version = case when coalesce(m.privacy_version, 0) > coalesce(k.privacy_version, 0)
                                then m.privacy_version else k.privacy_version end,
         privacy_accepted_at = case when coalesce(m.privacy_version, 0) > coalesce(k.privacy_version, 0)
                                    then m.privacy_accepted_at else k.privacy_accepted_at end,
         do_not_contact = k.do_not_contact or m.do_not_contact,
         birthday_month = coalesce(k.birthday_month, m.birthday_month),
         birthday_day = coalesce(k.birthday_day, m.birthday_day),
         whatsapp_opt_in_at = greatest(k.whatsapp_opt_in_at, m.whatsapp_opt_in_at),
         whatsapp_opt_out_at = greatest(k.whatsapp_opt_out_at, m.whatsapp_opt_out_at),
         preferred_barber_id = case when k.preferred_barber_manual then k.preferred_barber_id
                                    else coalesce(v_pref, k.preferred_barber_id, m.preferred_barber_id) end
   where id = k.id
  returning * into k;
  perform set_config('turnos.internal', '', true);
  return k;
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  save_membership_plan(uuid, boolean, int, int, int),
  family_is_current(uuid),
  membership_customer(uuid, text, text),
  membership_join(uuid, uuid),
  create_membership(uuid, text, text),
  add_membership_member(uuid, text, text),
  remove_membership_member(uuid),
  customers_leave_family_on_anonymize()
from public, anon, authenticated;
grant execute on function
  save_membership_plan(uuid, boolean, int, int, int),
  family_is_current(uuid),
  membership_customer(uuid, text, text),
  membership_join(uuid, uuid),
  create_membership(uuid, text, text),
  add_membership_member(uuid, text, text),
  remove_membership_member(uuid),
  customers_leave_family_on_anonymize()
to service_role;
-- Dueño (cada una valida el negocio por dentro)
grant execute on function
  save_membership_plan(uuid, boolean, int, int, int),
  create_membership(uuid, text, text),
  add_membership_member(uuid, text, text),
  remove_membership_member(uuid)
to authenticated;
