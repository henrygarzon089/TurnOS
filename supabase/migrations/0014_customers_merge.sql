-- 0014 · Ficha de cliente: fusión y clientes del barbero (T-033)
-- Cubre: REQ-018.4, REQ-018.5
-- Diseño: design.md §2.6, decisions.md ADR-016

-- REQ-018.5: fusionar dos fichas. `p_keep_id` conserva nombre y celular (lo elige el dueño).
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
         preferred_barber_id = case when k.preferred_barber_manual then k.preferred_barber_id
                                    else coalesce(v_pref, k.preferred_barber_id, m.preferred_barber_id) end
   where id = k.id
  returning * into k;
  perform set_config('turnos.internal', '', true);
  return k;
end $$;

-- REQ-018.4: clientes que el barbero tiene en su fila hoy o que ha atendido (ADR-016).
create or replace function barber_customers(p_q text default null, p_limit int default 50)
returns table (id uuid, name text, phone_last4 text, last_visit_at timestamptz, visits_count int, in_queue_today boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select b.id as barber_id, b.business_id from barbers b
    join memberships ms on ms.barber_id = b.id
    where ms.user_id = auth.uid()
    limit 1
  ),
  queue_today as (
    select distinct t.customer_id from tickets t, me
    where t.business_id = me.business_id
      and t.business_day = business_day_bogota(now())
      and t.status in ('waiting', 'called', 'in_service')
      and (t.preferred_barber_id = me.barber_id or t.preferred_barber_id is null or t.assigned_barber_id = me.barber_id)
      and t.customer_id is not null
  ),
  served as (
    select distinct t.customer_id from tickets t, me
    where t.business_id = me.business_id and t.assigned_barber_id = me.barber_id and t.customer_id is not null
  )
  select c.id, c.name, right(c.phone_e164, 4), c.last_visit_at, c.visits_count,
         c.id in (select customer_id from queue_today)
  from customers c, me
  where c.business_id = me.business_id
    and c.anonymized_at is null
    and (c.id in (select customer_id from queue_today) or c.id in (select customer_id from served))
    and (
      p_q is null or p_q = ''
      or c.name ilike '%' || p_q || '%'
      or word_similarity(p_q, c.name) > 0.5
      or (p_q ~ '^\d{3,10}$' and c.phone_e164 like '%' || p_q)
    )
  order by c.id in (select customer_id from queue_today) desc, c.last_visit_at desc nulls last, c.name
  limit p_limit
$$;

-- REQ-018.4: ¿puede este barbero abrir esta ficha? (misma regla que barber_customers)
create or replace function barber_can_see_customer(p_customer_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from tickets t
    join memberships ms on ms.user_id = auth.uid() and ms.business_id = t.business_id and ms.barber_id is not null
    where t.customer_id = p_customer_id
      and (
        t.assigned_barber_id = ms.barber_id
        or (t.business_day = business_day_bogota(now())
            and t.status in ('waiting', 'called', 'in_service')
            and (t.preferred_barber_id = ms.barber_id or t.preferred_barber_id is null))
      )
  )
$$;

revoke all on function barber_customers(text, int), barber_can_see_customer(uuid) from public;
grant execute on function barber_customers(text, int), barber_can_see_customer(uuid) to authenticated, service_role;
