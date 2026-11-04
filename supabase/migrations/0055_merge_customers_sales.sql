-- Corrección (REQ-018.5, ADR-005, ADR-016): fusionar fichas con ventas.
-- Hasta aquí `delete from customers` de la ficha fusionada disparaba `on delete set null` en
-- sales.customer_id y sales_guard lo rechazaba (SALE_IMMUTABLE): no se podía fusionar a ningún
-- cliente que hubiera pagado. Ahora merge_customers pasa las ventas a la ficha que queda antes del
-- delete, con un permiso acotado en sales_guard: solo dentro de `turnos.internal` (lo pone
-- merge_customers) y solo cambiando customer_id a otra ficha. Montos, estado, día y cierres no se
-- tocan; el día cerrado no lo impide porque el cierre no depende del cliente (design §2.6).

-- ---------------------------------------------------------- sales_guard ----
create or replace function sales_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Fusión de fichas: la venta cambia de cliente y nada más
  if tg_op = 'UPDATE' and current_setting('turnos.internal', true) = '1'
     and new.customer_id is not null and new.customer_id is distinct from old.customer_id
     and (to_jsonb(new) - 'customer_id') = (to_jsonb(old) - 'customer_id') then
    return new;
  end if;
  if exists (select 1 from cash_closures c
             where c.business_id = new.business_id and c.business_day = new.business_day and c.status = 'active') then
    raise exception 'CASH_DAY_CLOSED' using errcode = 'P0009';
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'voided' or new.status <> 'voided'
       or (to_jsonb(new) - array['status', 'voided_reason', 'voided_by', 'voided_at'])
          <> (to_jsonb(old) - array['status', 'voided_reason', 'voided_by', 'voided_at']) then
      raise exception 'SALE_IMMUTABLE' using errcode = 'P0004';
    end if;
    if new.voided_at is null or new.voided_by is null or length(trim(coalesce(new.voided_reason, ''))) = 0 then
      raise exception 'VOID_REQUIRES_REASON' using errcode = 'P0004';
    end if;
  end if;
  return new;
end $$;

-- ------------------------------------------------------ merge_customers ----
-- Redefinición de 0041 con un solo cambio: las ventas de la ficha fusionada pasan a la que queda.
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
  -- Ventas (0055): permiso acotado de sales_guard, solo customer_id
  perform set_config('turnos.internal', '1', true);
  update sales set customer_id = k.id where customer_id = m.id;
  perform set_config('turnos.internal', '', true);
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

