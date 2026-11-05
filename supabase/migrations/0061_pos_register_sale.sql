-- 0061 · Hito 12, punto de venta: register_sale con la comisión de productos y la compra de un barbero
-- (T-111, T-112, ADR-038). Cubre: REQ-065.5, REQ-066.1, REQ-066.4–066.6, REQ-067.1–067.5,
-- REQ-068.2–068.4. Diseño: design.md §17.3–§17.4. Copia register_sale de 0052 y solo agrega lo del POS.
-- La firma cambia (p_staff_buyer_id al final, con default): se borra la anterior y se repiten los
-- permisos de ADR-019. El stock de la vitrina es del Hito 13 (triggers propios sobre sale_items).

drop function register_sale(uuid, uuid, uuid, jsonb, jsonb, uuid);

-- ------------------------------------------------------------ register_sale ----
-- p_payments: [{"method":"cash"|"nequi"|"transfer"|"card","amount":n}
--              | {"method":"gift_card","amount":n,"code":"K7QM4XPA"}] (a lo sumo una tarjeta)
-- p_staff_buyer_id: el barbero que compra (REQ-068); entonces p_ticket_id y p_barber_id van null.
create or replace function register_sale(
  p_business_id uuid,
  p_ticket_id uuid,
  p_barber_id uuid,
  p_items jsonb,
  p_payments jsonb,
  p_customer_id uuid default null,
  p_staff_buyer_id uuid default null
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
  v_staff boolean := p_staff_buyer_id is not null;
  v_staff_pct int := 0;
  v_staff_discount int := 0;
  v_commissionable boolean;
  v_prod_pct int := 0;
  v_prod_base int := 0;
  v_prod_commission int := 0;
begin
  -- Quién (REQ-023.7): barbero → solo lo suyo; dueño → cualquiera. Sin JWT = service_role/pruebas.
  if v_uid is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_owner := v_uid is null or is_owner_of(p_business_id);
  if v_uid is not null then v_my := my_barber_id(p_business_id); end if;

  -- REQ-068.2 / REQ-068.3 compra de un barbero: solo el dueño, solo productos, sin turno ni vendedor
  if v_staff then
    if not v_owner then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
    select staff_discount_pct into v_staff_pct from businesses where id = p_business_id;
    if coalesce(v_staff_pct, 0) = 0 then raise exception 'STAFF_DISCOUNT_OFF' using errcode = 'P0004'; end if;
    if p_ticket_id is not null or p_barber_id is not null then
      raise exception 'INVALID_STAFF_PURCHASE' using errcode = 'P0004';
    end if;
    if not exists (select 1 from barbers where id = p_staff_buyer_id and business_id = p_business_id and is_active) then
      raise exception 'BARBER_NOT_FOUND' using errcode = 'P0002';
    end if;
    v_customer := null;
  end if;

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
    if v_staff and v_kind <> 'product' then raise exception 'INVALID_STAFF_PURCHASE' using errcode = 'P0004'; end if;
    v_commissionable := false;

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
      -- REQ-066.1 solo los que están a la venta (la cortesía no se cobra)
      select price, name, commissionable into v_price, v_name, v_commissionable from products
      where id = v_ref and business_id = p_business_id and is_active and for_sale;
      if not found then raise exception 'PRODUCT_NOT_FOUND' using errcode = 'P0002'; end if;
      if v_discount > 0 or v_reward then raise exception 'INVALID_LINE' using errcode = 'P0004'; end if;
      v_reason := null;
      if v_staff then
        -- REQ-068.3 descuento de empleado por línea, al peso, .5 hacia arriba
        v_discount := (v_price * v_qty * v_staff_pct + 50) / 100;
        v_reason := 'Compra de barbero';
        v_staff_discount := v_staff_discount + v_discount;
      end if;
      -- REQ-067.2 la línea guarda si dio comisión: marcada, con barbero y sin ser compra de barbero
      v_commissionable := v_commissionable and v_barber is not null and not v_staff;
      if v_commissionable then v_prod_base := v_prod_base + v_price * v_qty; end if;
      v_products := v_products + v_price * v_qty - v_discount;
    end if;

    v_lines := v_lines || jsonb_build_object(
      'kind', v_kind, 'ref_id', v_ref, 'name', v_name, 'qty', v_qty, 'unit_price', v_price,
      'discount', v_discount, 'line_total', v_price * v_qty - v_discount, 'is_reward', v_reward,
      'discount_reason', v_reason, 'membership_benefit', v_benefit,
      'membership_period_id', case when v_benefit is not null then v_period end,
      'commissionable', v_commissionable);
  end loop;

  if jsonb_array_length(v_lines) = 0 then raise exception 'EMPTY_SALE' using errcode = 'P0004'; end if;
  if v_has_service and v_barber is null then raise exception 'BARBER_REQUIRED' using errcode = 'P0004'; end if;

  -- design.md §5.1 y §13.4
  v_services_total := v_services_list - v_services_discount;
  v_base := v_services_total + v_rewards;                       -- REQ-025.4 / REQ-047.4: sobre precio de lista
  v_commission := (v_base * v_pct + 50) / 100;                  -- redondeo al peso, .5 hacia arriba

  -- design.md §17.4 comisión de productos: un solo redondeo por venta (REQ-067.1, REQ-067.3)
  if v_barber is not null and not v_staff then
    select product_commission_pct into v_prod_pct from businesses where id = p_business_id;
    v_prod_commission := (v_prod_base * v_prod_pct + 50) / 100;
  end if;

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
                     loyalty_card_id, created_by, product_commission_pct, product_commission_base,
                     product_commission_amount, staff_buyer_id, staff_discount_total)
  values (p_business_id, business_day_bogota(now()), p_ticket_id, v_barber, v_customer, v_services_total, v_products,
          v_services_discount, v_services_total + v_products, case when v_barber is null then 0 else v_pct end,
          v_base, v_commission, v_base - v_commission,
          case when v_reward_lines > 0 then card.id end, v_uid, v_prod_pct, v_prod_base,
          v_prod_commission, p_staff_buyer_id, v_staff_discount)
  returning * into s;

  insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total, is_reward,
                          discount_reason, membership_benefit, membership_period_id, commissionable)
  select p_business_id, s.id, (l ->> 'kind')::sale_item_kind, (l ->> 'ref_id')::uuid, l ->> 'name', (l ->> 'qty')::int,
         (l ->> 'unit_price')::int, (l ->> 'discount')::int, (l ->> 'line_total')::int, (l ->> 'is_reward')::boolean,
         l ->> 'discount_reason', (l ->> 'membership_benefit')::membership_benefit, (l ->> 'membership_period_id')::uuid,
         (l ->> 'commissionable')::boolean
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


-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function register_sale(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid) from public, anon, authenticated;
grant execute on function register_sale(uuid, uuid, uuid, jsonb, jsonb, uuid, uuid) to authenticated, service_role;
