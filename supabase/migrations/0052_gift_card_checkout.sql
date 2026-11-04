-- 0052 · Hito 9, tarjetas de regalo: pagar con la tarjeta, cuota y anulación (T-091, ADR-034)
-- Cubre: REQ-057.2, 057.3, 057.5–057.8, REQ-058.1–058.4. Diseño: design.md §15.3 y §15.4 (ejemplos I, K y L).
-- Redefine register_membership_fee, void_sale y register_sale de 0042: solo cambia lo marcado con
-- REQ-057/058. La comisión no cambia (REQ-057.5): sale de las líneas, no de los pagos.

-- ------------------------------------------------- register_membership_fee ----
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
    if pay ->> 'method' = 'gift_card' then
      raise exception 'INVALID_PAYMENT' using errcode = 'P0004';   -- REQ-057.7 la cuota no se paga con tarjeta
    end if;
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
create or replace function void_sale(p_sale_id uuid, p_reason text)
returns sales
language plpgsql security definer set search_path = public as $$
declare
  s sales%rowtype;
  v_new loyalty_cards%rowtype;
  v_period uuid;
  v_gift uuid;
  v_cut_ticket uuid;
  prog loyalty_programs%rowtype;
  card loyalty_cards%rowtype;
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

  -- REQ-058.1 la venta de una tarjeta se anula solo si nadie ha pagado con ella
  select id into v_gift from gift_cards where sale_id = s.id for update;
  if v_gift is not null and exists (
       select 1 from sale_payments p join sales u on u.id = p.sale_id
        where p.gift_card_id = v_gift and u.status = 'active') then
    raise exception 'GIFT_CARD_IN_USE' using errcode = 'P0004';
  end if;

  update sales set status = 'voided', voided_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = s.id
  returning * into s;

  if v_period is not null then
    update membership_periods set status = 'voided' where id = v_period;
  end if;
  if v_gift is not null then
    update gift_cards set status = 'voided' where id = v_gift;
  end if;
  -- REQ-058.2 una venta pagada con tarjeta le devuelve el saldo sola (el saldo cuenta ventas activas)
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

  -- REQ-047.7 el turno de un corte de membresía vuelve a tener su sello, con las mismas reglas con las
  -- que se pone al terminar (tickets_after_done): programa encendido, servicio que cuenta y sin premio
  -- pendiente de canje. Sin sello del turno es porque register_sale lo quitó.
  select s.ticket_id into v_cut_ticket from sale_items i
   where i.sale_id = s.id and i.membership_benefit = 'cut' and s.ticket_id is not null and s.customer_id is not null
     and not exists (select 1 from loyalty_stamps where ticket_id = s.ticket_id)
   limit 1;
  if v_cut_ticket is not null then
    select * into prog from loyalty_programs where business_id = s.business_id and enabled;
    if found and exists (select 1 from tickets k join services v on v.id = k.service_id
                          where k.id = v_cut_ticket and v.counts_for_loyalty) then
      select * into card from loyalty_cards where customer_id = s.customer_id and status = 'active' for update;
      if not found and not exists (select 1 from loyalty_cards where customer_id = s.customer_id and status = 'completed') then
        insert into loyalty_cards (business_id, customer_id) values (s.business_id, s.customer_id) returning * into card;
      end if;
      if card.id is not null then
        insert into loyalty_stamps (business_id, card_id, ticket_id) values (s.business_id, card.id, v_cut_ticket);
        update loyalty_cards set stamps = stamps + 1 where id = card.id returning * into card;
        if card.stamps >= prog.visits_required then
          update loyalty_cards set status = 'completed', completed_at = now() where id = card.id;
        end if;
      end if;
    end if;
  end if;
  return s;
end $$;

-- ------------------------------------------------------------ register_sale ----
-- p_payments: [{"method":"cash"|"nequi"|"transfer"|"card","amount":n}
--              | {"method":"gift_card","amount":n,"code":"K7QM4XPA"}] (a lo sumo una tarjeta)
create or replace function register_sale(
  p_business_id uuid,
  p_ticket_id uuid,
  p_barber_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_customer_id uuid default null
) returns sales
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner boolean;
  v_my uuid;
  t tickets%rowtype;
  v_barber uuid := p_barber_id;
  v_customer uuid := p_customer_id;
  v_pct int := 0;
  prog loyalty_programs%rowtype;
  card loyalty_cards%rowtype;
  v_reward_lines int := 0;
  v_member_lines int := 0;
  v_ms jsonb;
  v_period uuid;
  v_benefit membership_benefit;
  v_cut boolean := false;
  v_counts boolean;
  v_ticket_price_used boolean := false;
  it jsonb;
  pay jsonb;
  v_kind sale_item_kind;
  v_ref uuid;
  v_qty int;
  v_discount int;
  v_reward boolean;
  v_member boolean;
  v_reason text;
  v_price int;
  v_name text;
  v_lines jsonb := '[]'::jsonb;
  v_has_service boolean := false;
  v_services_list int := 0;
  v_services_discount int := 0;
  v_rewards int := 0;
  v_products int := 0;
  v_services_total int;
  v_base int;
  v_commission int;
  v_paid int := 0;
  v_gift gift_cards%rowtype;
  v_gift_lines int := 0;
  st loyalty_stamps%rowtype;
  s sales%rowtype;
begin
  -- Quién (REQ-023.7): barbero → solo lo suyo; dueño → cualquiera. Sin JWT = service_role/pruebas.
  if v_uid is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_owner := v_uid is null or is_owner_of(p_business_id);
  if v_uid is not null then v_my := my_barber_id(p_business_id); end if;

  -- Turno (REQ-023.1): terminado y pendiente de cobro; barbero y cliente salen del turno.
  if p_ticket_id is not null then
    select * into t from tickets where id = p_ticket_id and business_id = p_business_id for update;
    if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
    if t.status <> 'done' then raise exception 'TICKET_NOT_DONE' using errcode = 'P0004'; end if;
    if t.payment_status = 'paid' then raise exception 'ALREADY_PAID' using errcode = 'P0004'; end if;
    if v_barber is null then v_barber := t.assigned_barber_id; end if;
    if v_barber is distinct from t.assigned_barber_id then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    v_customer := coalesce(t.customer_id, v_customer);
  end if;

  if not v_owner then
    v_barber := coalesce(v_barber, v_my); -- una venta de productos de un barbero queda a su nombre
    if v_barber is distinct from v_my then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  end if;
  if v_barber is not null then
    select commission_pct into v_pct from barbers where id = v_barber and business_id = p_business_id;
    if not found then raise exception 'BARBER_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  if v_customer is not null and not exists (select 1 from customers where id = v_customer and business_id = p_business_id) then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;

  -- Líneas: el servidor pone precio y nombre.
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    -- La cuota va por register_membership_fee (design.md §13.3)
    if it ->> 'kind' = 'membership' then raise exception 'INVALID_LINE' using errcode = 'P0004'; end if;
    v_kind := (it ->> 'kind')::sale_item_kind;
    v_ref := (it ->> 'ref_id')::uuid;
    v_qty := coalesce((it ->> 'qty')::int, 1);
    v_discount := coalesce((it ->> 'discount')::int, 0);
    v_reward := coalesce((it ->> 'is_reward')::boolean, false);
    v_member := coalesce((it ->> 'membership')::boolean, false);
    v_reason := nullif(trim(coalesce(it ->> 'discount_reason', '')), '');
    v_benefit := null;
    if v_qty < 1 or v_discount < 0 then raise exception 'INVALID_LINE' using errcode = 'P0004'; end if;

    if v_kind = 'service' then
      v_has_service := true;
      if t.id is not null and v_ref = t.service_id and not v_ticket_price_used then
        v_price := t.service_price; v_name := t.service_name; v_ticket_price_used := true; -- precio congelado
      else
        select price, name into v_price, v_name from services
        where id = v_ref and business_id = p_business_id and is_active;
        if not found then raise exception 'SERVICE_NOT_FOUND' using errcode = 'P0002'; end if;
      end if;

      if v_member then
        -- REQ-047.1–047.3: el valor lo fija el plan, no el que cobra; REQ-047.5 un solo beneficio
        v_member_lines := v_member_lines + 1;
        if v_reward or v_reward_lines > 0 or v_member_lines > 1 or v_qty <> 1 then
          raise exception 'ONE_BENEFIT_PER_SALE' using errcode = 'P0004';
        end if;
        select counts_for_membership into v_counts from services where id = v_ref and business_id = p_business_id;
        if not coalesce(v_counts, false) then raise exception 'NOT_MEMBERSHIP_SERVICE' using errcode = 'P0004'; end if;
        if v_customer is not null then v_ms := membership_status(p_business_id, v_customer); end if;
        if v_ms is null then raise exception 'NO_MEMBERSHIP' using errcode = 'P0004'; end if;
        v_period := (v_ms ->> 'periodId')::uuid;
        -- Dos cobros a la vez no gastan el mismo corte: se cuentan de nuevo con el periodo bloqueado
        perform 1 from membership_periods where id = v_period for update;
        if (select count(*) from sale_items i join sales u on u.id = i.sale_id
             where i.membership_period_id = v_period and i.membership_benefit = 'cut' and u.status = 'active')
           < (v_ms ->> 'cutsTotal')::int then
          v_benefit := 'cut';
          v_discount := v_price;
          v_cut := true;
        else
          v_benefit := 'discount';
          v_discount := (v_price * (v_ms ->> 'discountPct')::int + 50) / 100; -- redondeo al peso, .5 hacia arriba
        end if;
        v_reason := null;
        v_rewards := v_rewards + v_discount;                      -- REQ-047.4 comisión sobre la lista
      elsif v_reward then
        -- REQ-019.4: premio disponible del cliente; el valor lo pone el programa
        v_reward_lines := v_reward_lines + 1;
        if v_member_lines > 0 then raise exception 'ONE_BENEFIT_PER_SALE' using errcode = 'P0004'; end if;
        if v_reward_lines > 1 or v_qty <> 1 then raise exception 'ONE_REWARD_PER_SALE' using errcode = 'P0004'; end if;
        select * into prog from loyalty_programs where business_id = p_business_id and enabled;
        if not found or v_customer is null then raise exception 'NO_REWARD_AVAILABLE' using errcode = 'P0004'; end if;
        select * into card from loyalty_cards where customer_id = v_customer and status = 'completed' for update;
        if not found then raise exception 'NO_REWARD_AVAILABLE' using errcode = 'P0004'; end if;
        if prog.reward_type = 'free_service' then
          if prog.reward_service_id is distinct from v_ref then
            raise exception 'REWARD_SERVICE_MISMATCH' using errcode = 'P0004';
          end if;
          v_discount := v_price;
        else
          v_discount := least(coalesce(prog.reward_amount, 0), v_price);
        end if;
        v_reason := null;
        v_rewards := v_rewards + v_discount;
      elsif v_discount > 0 then
        -- PA-13: solo el dueño da descuentos, con motivo
        if not v_owner then raise exception 'DISCOUNT_NOT_ALLOWED' using errcode = 'P0004'; end if;
        if v_reason is null then raise exception 'DISCOUNT_REQUIRES_REASON' using errcode = 'P0004'; end if;
      end if;
      if v_discount > v_price * v_qty then raise exception 'DISCOUNT_TOO_BIG' using errcode = 'P0004'; end if;
      v_services_list := v_services_list + v_price * v_qty;
      v_services_discount := v_services_discount + v_discount;
    else
      -- REQ-047.2 la membresía no toca productos
      if v_member then raise exception 'NOT_MEMBERSHIP_SERVICE' using errcode = 'P0004'; end if;
      select price, name into v_price, v_name from products
      where id = v_ref and business_id = p_business_id and is_active;
      if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
      if v_discount > 0 or v_reward then raise exception 'INVALID_LINE' using errcode = 'P0004'; end if;
      v_reason := null;
      v_products := v_products + v_price * v_qty;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'kind', v_kind, 'ref_id', v_ref, 'name', v_name, 'qty', v_qty, 'unit_price', v_price,
      'discount', v_discount, 'line_total', v_price * v_qty - v_discount, 'is_reward', v_reward,
      'discount_reason', v_reason, 'membership_benefit', v_benefit,
      'membership_period_id', case when v_benefit is not null then v_period end);
  end loop;

  if jsonb_array_length(v_lines) = 0 then raise exception 'EMPTY_SALE' using errcode = 'P0004'; end if;
  if v_has_service and v_barber is null then raise exception 'BARBER_REQUIRED' using errcode = 'P0004'; end if;

  -- design.md §5.1 y §13.4
  v_services_total := v_services_list - v_services_discount;
  v_base := v_services_total + v_rewards;                       -- REQ-025.4 / REQ-047.4: sobre precio de lista
  v_commission := (v_base * v_pct + 50) / 100;                  -- redondeo al peso, .5 hacia arriba

  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    -- REQ-057.2 / REQ-057.3 / REQ-057.8 la tarjeta, bloqueada, con el saldo de este momento
    if pay ->> 'method' = 'gift_card' then
      v_gift_lines := v_gift_lines + 1;
      if v_gift_lines > 1 then
        raise exception 'ONE_GIFT_CARD_PER_SALE' using errcode = 'P0004';
      end if;
      if coalesce((pay ->> 'amount')::int, 0) <= 0 then
        raise exception 'INVALID_PAYMENT' using errcode = 'P0004';
      end if;
      select * into v_gift from gift_cards
       where business_id = p_business_id and code = gift_card_normalize_code(pay ->> 'code') for update;
      if not found then
        raise exception 'GIFT_CARD_NOT_FOUND' using errcode = 'P0004';
      elsif v_gift.status = 'voided' then
        raise exception 'GIFT_CARD_VOIDED' using errcode = 'P0004';
      elsif v_gift.expires_on < business_day_bogota(now()) then
        raise exception 'GIFT_CARD_EXPIRED' using errcode = 'P0004';
      elsif (pay ->> 'amount')::int > gift_card_balance(v_gift.id) then
        raise exception 'GIFT_CARD_INSUFFICIENT' using errcode = 'P0004';
      end if;
    end if;
    v_paid := v_paid + (pay ->> 'amount')::int;
  end loop;
  if v_paid <> v_services_total + v_products then
    raise exception 'PAYMENTS_MISMATCH' using errcode = 'P0004';
  end if;

  insert into sales (business_id, business_day, ticket_id, barber_id, customer_id, services_total, products_total,
                     discount_total, total, commission_pct, commission_base, commission_amount, business_amount,
                     loyalty_card_id, created_by)
  values (p_business_id, business_day_bogota(now()), p_ticket_id, v_barber, v_customer, v_services_total, v_products,
          v_services_discount, v_services_total + v_products, case when v_barber is null then 0 else v_pct end,
          v_base, v_commission, v_base - v_commission,
          case when v_reward_lines > 0 then card.id end, v_uid)
  returning * into s;

  insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total, is_reward,
                          discount_reason, membership_benefit, membership_period_id)
  select p_business_id, s.id, (l ->> 'kind')::sale_item_kind, (l ->> 'ref_id')::uuid, l ->> 'name', (l ->> 'qty')::int,
         (l ->> 'unit_price')::int, (l ->> 'discount')::int, (l ->> 'line_total')::int, (l ->> 'is_reward')::boolean,
         l ->> 'discount_reason', (l ->> 'membership_benefit')::membership_benefit, (l ->> 'membership_period_id')::uuid
  from jsonb_array_elements(v_lines) l;

  insert into sale_payments (business_id, sale_id, method, amount, gift_card_id)
  select p_business_id, s.id, (p ->> 'method')::payment_method, (p ->> 'amount')::int,
         case when p ->> 'method' = 'gift_card' then v_gift.id end
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) p
  where (p ->> 'amount')::int > 0;

  if v_reward_lines > 0 then
    perform redeem_loyalty_card(card.id, s.id);                 -- REQ-019.4: canjeada + nueva en cero
  end if;
  -- REQ-047.7 el sello que puso el turno al terminar no cuenta si el corte lo pagó la membresía. Si
  -- ese sello completó la tarjeta (y el premio no se canjeó), la tarjeta vuelve a activa.
  if v_cut and p_ticket_id is not null then
    delete from loyalty_stamps where ticket_id = p_ticket_id returning * into st;
    if found then
      update loyalty_cards
         set stamps = greatest(stamps - 1, 0),
             status = case when status = 'completed' then 'active'::loyalty_card_status else status end,
             completed_at = case when status = 'completed' then null else completed_at end
       where id = st.card_id;
    end if;
  end if;
  if p_ticket_id is not null then
    update tickets set payment_status = 'paid' where id = p_ticket_id;
  end if;
  return s;
end $$;

-- Los permisos de 0042 se conservan (create or replace no los cambia).
