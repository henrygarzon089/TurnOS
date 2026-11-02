-- 0042 · Hito 7, membresía familiar: la cuota en la caja (T-072, ADR-030)
-- Cubre: REQ-045.1–045.7, REQ-044.4/044.5 en la cuota. Diseño: design.md §13.1, §13.3, §13.4 (ejemplo G).
-- El cobro con membresía (register_sale, membership_status) llega en T-073 sobre esta misma migración.
-- El valor 'membership' del enum no se usa en esta transacción (como en 0033/0034): las
-- restricciones comparan `kind::text` y las funciones son plpgsql (el literal se resuelve al ejecutar).

-- ------------------------------------------------------------ columnas ----
alter type sale_item_kind add value if not exists 'membership';
create type membership_benefit as enum ('cut', 'discount');

-- REQ-045.1 la cuota suma al total de la venta, aparte de servicios y productos
alter table sales add column membership_total int not null default 0 check (membership_total >= 0);
alter table sales drop constraint sales_total_ck;
alter table sales add constraint sales_total_ck check (total = services_total + products_total + membership_total);

-- La línea de la cuota apunta a su periodo; una línea de servicio con membresía, al periodo que usó
alter table sale_items add column membership_period_id uuid references membership_periods (id);
alter table sale_items add column membership_benefit membership_benefit;
create index sale_items_membership_period_idx on sale_items (membership_period_id) where membership_period_id is not null;
alter table sale_items add constraint sale_items_membership_ck check (
  (membership_benefit is null or kind = 'service')
  and ((membership_period_id is null) = (membership_benefit is null and kind::text <> 'membership')));
-- REQ-047.3 el valor de la membresía lo fija el plan: no pide motivo de descuento
alter table sale_items drop constraint sale_items_discount_reason_ck;
alter table sale_items add constraint sale_items_discount_reason_ck
  check (discount = 0 or is_reward or membership_benefit is not null
         or length(trim(coalesce(discount_reason, ''))) > 0);

-- ------------------------------------------------- register_membership_fee ----
-- REQ-045.1 / REQ-045.2 el dueño cobra la cuota: venta sin barbero, turno ni comisión, a nombre del
-- titular. REQ-045.3 / REQ-045.4 el periodo empieza hoy (Bogotá) o, si el último periodo activo
-- termina hoy o después, el día siguiente a su fin. REQ-044.4 el periodo copia el plan de hoy.
-- El día cerrado lo rechaza sales_guard (CASH_DAY_CLOSED).
-- p_payments: [{"method":"cash"|"nequi"|"transfer"|"card","amount":80000}]
create or replace function register_membership_fee(p_membership_id uuid, p_payments jsonb)
returns sales
language plpgsql security definer set search_path = public as $$
declare
  f family_memberships%rowtype;
  plan membership_plans%rowtype;
  v_today date := business_day_bogota(now());
  v_last date;
  v_starts date;
  v_paid int := 0;
  pay jsonb;
  v_period uuid;
  s sales%rowtype;
begin
  select * into f from family_memberships where id = p_membership_id for update; -- dos cobros a la vez encadenan bien
  if not found then
    raise exception 'MEMBERSHIP_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(f.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into plan from membership_plans where business_id = f.business_id and enabled;
  if not found then
    raise exception 'PLAN_DISABLED' using errcode = 'P0004';
  end if;

  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    v_paid := v_paid + (pay ->> 'amount')::int;
  end loop;
  if v_paid <> plan.price then
    raise exception 'PAYMENTS_MISMATCH' using errcode = 'P0004';
  end if;

  select max(ends_on) into v_last from membership_periods where membership_id = f.id and status = 'active';
  v_starts := case when v_last >= v_today then v_last + 1 else v_today end;

  insert into sales (business_id, business_day, customer_id, services_total, products_total, membership_total,
                     total, created_by)
  values (f.business_id, v_today, f.holder_customer_id, 0, 0, plan.price, plan.price, auth.uid())
  returning * into s;

  insert into membership_periods (business_id, membership_id, sale_id, starts_on, ends_on, cuts_total, price, discount_pct)
  values (f.business_id, f.id, s.id, v_starts, v_starts + 29, plan.cuts_per_period, plan.price, plan.discount_pct)
  returning id into v_period;

  insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total,
                          membership_period_id)
  values (f.business_id, s.id, 'membership', f.id, 'Membresía familiar', 1, plan.price, 0, plan.price, v_period);

  insert into sale_payments (business_id, sale_id, method, amount)
  select f.business_id, s.id, (p ->> 'method')::payment_method, (p ->> 'amount')::int
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) p
  where (p ->> 'amount')::int > 0;
  return s;
end $$;

-- --------------------------------------------------------------- void_sale ----
-- Redefinición de 0022. REQ-026.1 como siempre; además REQ-045.7: la venta de una cuota se anula
-- solo si su periodo no tiene cortes usados en ventas activas, y el periodo pasa a 'voided'.
create or replace function void_sale(p_sale_id uuid, p_reason text)
returns sales
language plpgsql security definer set search_path = public as $$
declare
  s sales%rowtype;
  v_new loyalty_cards%rowtype;
  v_period uuid;
begin
  select * into s from sales where id = p_sale_id for update;
  if not found then raise exception 'SALE_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not is_owner_of(s.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if s.status = 'voided' then raise exception 'ALREADY_VOIDED' using errcode = 'P0004'; end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'VOID_REQUIRES_REASON' using errcode = 'P0004'; end if;
  if s.business_day <> business_day_bogota(now()) then
    raise exception 'ONLY_TODAY' using errcode = 'P0004';
  end if;

  select id into v_period from membership_periods where sale_id = s.id for update;
  if v_period is not null and exists (
       select 1 from sale_items i join sales u on u.id = i.sale_id
        where i.membership_period_id = v_period and i.membership_benefit = 'cut' and u.status = 'active') then
    raise exception 'MEMBERSHIP_IN_USE' using errcode = 'P0004';
  end if;

  update sales set status = 'voided', voided_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = s.id
  returning * into s;

  if v_period is not null then
    update membership_periods set status = 'voided' where id = v_period;
  end if;
  if s.ticket_id is not null then
    update tickets set payment_status = 'pending' where id = s.ticket_id;
  end if;
  if s.loyalty_card_id is not null then
    select * into v_new from loyalty_cards
     where customer_id = s.customer_id and status = 'active' and created_at >= (select redeemed_at from loyalty_cards where id = s.loyalty_card_id)
     order by created_at desc limit 1;
    if found and v_new.stamps = 0 then
      delete from loyalty_cards where id = v_new.id;
      update loyalty_cards set status = 'completed', redeemed_at = null, redeemed_sale_id = null where id = s.loyalty_card_id;
    end if;
  end if;
  return s;
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function register_membership_fee(uuid, jsonb), void_sale(uuid, text)
from public, anon, authenticated;
-- Dueño (cada una valida el negocio por dentro)
grant execute on function register_membership_fee(uuid, jsonb), void_sale(uuid, text)
to authenticated, service_role;
