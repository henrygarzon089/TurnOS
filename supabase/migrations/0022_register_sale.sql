-- 0022 · register_sale y void_sale (T-041)
-- Cubre: REQ-019.4, REQ-023.1–23.4, REQ-023.7, REQ-024.2–24.3, REQ-025.2–25.4, REQ-026.1
-- Diseño: design.md §5.1 (fórmulas y ejemplos A–D), §6.3 (registerSale/voidSale), ADR-005, ADR-018.
-- `src/lib/domain/commission.ts` es el espejo en TS de estas fórmulas (mismas pruebas).

-- PA-13: el descuento (que no es premio) lo da el dueño y exige motivo (ADR-018).
alter table sale_items add column discount_reason text;
alter table sale_items add constraint sale_items_discount_reason_ck
  check (discount = 0 or is_reward or length(trim(coalesce(discount_reason, ''))) > 0);

-- Una venta ACTIVA por turno: anular libera el turno para cobrarlo de nuevo (ADR-018).
alter table sales drop constraint sales_ticket_id_key;
create unique index sales_ticket_active_uniq on sales (ticket_id) where status = 'active' and ticket_id is not null;

-- ------------------------------------------------------------ register_sale ----
-- p_items:    [{"kind":"service"|"product","ref_id":uuid,"qty":1,"discount":0,"is_reward":false,
--               "discount_reason":null}]   (el precio lo pone el servidor, nunca el cliente)
-- p_payments: [{"method":"cash"|"nequi"|"transfer"|"card","amount":25000}]
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
  v_ticket_price_used boolean := false;
  it jsonb;
  pay jsonb;
  v_kind sale_item_kind;
  v_ref uuid;
  v_qty int;
  v_discount int;
  v_reward boolean;
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
    v_kind := (it ->> 'kind')::sale_item_kind;
    v_ref := (it ->> 'ref_id')::uuid;
    v_qty := coalesce((it ->> 'qty')::int, 1);
    v_discount := coalesce((it ->> 'discount')::int, 0);
    v_reward := coalesce((it ->> 'is_reward')::boolean, false);
    v_reason := nullif(trim(coalesce(it ->> 'discount_reason', '')), '');
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

      if v_reward then
        -- REQ-019.4: premio disponible del cliente; el valor lo pone el programa
        v_reward_lines := v_reward_lines + 1;
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
      'discount_reason', v_reason);
  end loop;

  if jsonb_array_length(v_lines) = 0 then raise exception 'EMPTY_SALE' using errcode = 'P0004'; end if;
  if v_has_service and v_barber is null then raise exception 'BARBER_REQUIRED' using errcode = 'P0004'; end if;

  -- design.md §5.1
  v_services_total := v_services_list - v_services_discount;
  v_base := v_services_total + v_rewards;                       -- REQ-025.4: premio sobre precio de lista
  v_commission := (v_base * v_pct + 50) / 100;                  -- redondeo al peso, .5 hacia arriba

  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
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

  insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total, is_reward, discount_reason)
  select p_business_id, s.id, (l ->> 'kind')::sale_item_kind, (l ->> 'ref_id')::uuid, l ->> 'name', (l ->> 'qty')::int,
         (l ->> 'unit_price')::int, (l ->> 'discount')::int, (l ->> 'line_total')::int, (l ->> 'is_reward')::boolean,
         l ->> 'discount_reason'
  from jsonb_array_elements(v_lines) l;

  insert into sale_payments (business_id, sale_id, method, amount)
  select p_business_id, s.id, (p ->> 'method')::payment_method, (p ->> 'amount')::int
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) p
  where (p ->> 'amount')::int > 0;

  if v_reward_lines > 0 then
    perform redeem_loyalty_card(card.id, s.id);                 -- REQ-019.4: canjeada + nueva en cero
  end if;
  if p_ticket_id is not null then
    update tickets set payment_status = 'paid' where id = p_ticket_id;
  end if;
  return s;
end $$;

-- --------------------------------------------------------------- void_sale ----
-- REQ-026.1: el dueño anula una venta del día con motivo. El turno vuelve a "cobro pendiente" y, si
-- la venta usó el premio y la tarjeta nueva no tiene sellos, el premio vuelve a quedar disponible.
create or replace function void_sale(p_sale_id uuid, p_reason text)
returns sales
language plpgsql security definer set search_path = public as $$
declare
  s sales%rowtype;
  v_new loyalty_cards%rowtype;
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

  update sales set status = 'voided', voided_reason = trim(p_reason), voided_by = auth.uid(), voided_at = now()
   where id = s.id
  returning * into s;

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

revoke all on function register_sale(uuid, uuid, uuid, jsonb, jsonb, uuid), void_sale(uuid, text) from public;
grant execute on function register_sale(uuid, uuid, uuid, jsonb, jsonb, uuid), void_sale(uuid, text) to authenticated, service_role;
