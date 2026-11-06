-- 0068 · Daviplata como medio de pago (T-140, ADR-045)
-- Cubre: REQ-023.1, REQ-027.1. Diseño: design.md §20. Las funciones de cobro convierten el medio con
-- `::payment_method`, así que solo cambian el tipo y el resumen del día. cash_day_summary es la de
-- 0062 con dos cambios: `daviplata` en byMethod y su etiqueta en el detalle de ventas.

alter type payment_method add value if not exists 'daviplata' after 'nequi';

-- ------------------------------------------------------ cash_day_summary ----
create or replace function cash_day_summary(p_business_id uuid, p_day date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_day date := coalesce(p_day, business_day_bogota(now()));
  v jsonb;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with day_sales as (
    select * from sales where business_id = p_business_id and business_day = v_day
  ),
  active as (select * from day_sales where status = 'active'),
  pay as (
    select p.method, sum(p.amount)::int as amount
    from sale_payments p join active s on s.id = p.sale_id group by p.method
  ),
  -- REQ-048.3 cortes de membresía: cantidad y valor de lista (el descuento es todo el precio)
  cuts as (
    select coalesce(sum(i.qty), 0)::int as count, coalesce(sum(i.unit_price * i.qty), 0)::int as list_value
    from sale_items i join active s on s.id = i.sale_id where i.membership_benefit = 'cut'
  ),
  rewards as (
    select coalesce(sum(i.discount), 0)::int as amount
    from sale_items i join active s on s.id = i.sale_id where i.is_reward
  ),
  per_barber as (
    select s.barber_id, b.display_name as name, b.commission_pct as pct,
           count(*) filter (where exists (select 1 from sale_items i where i.sale_id = s.id and i.kind = 'service'))::int as services,
           sum(s.services_total)::int as sold,
           sum(s.commission_amount)::int as commission,
           sum(s.business_amount)::int as business,
           -- REQ-069.2 comisión de productos aparte; el % solo si fue el mismo en todo el día
           sum(s.product_commission_base)::int as products_sold,
           sum(s.product_commission_amount)::int as product_commission,
           case when count(distinct s.product_commission_pct) filter (where s.product_commission_base > 0) = 1
                then max(s.product_commission_pct) filter (where s.product_commission_base > 0) end as product_pct
    from active s join barbers b on b.id = s.barber_id
    group by s.barber_id, b.display_name, b.commission_pct
  ),
  -- REQ-069.3 compras de barberos (REQ-068)
  staff as (
    select count(*)::int as count, coalesce(sum(total), 0)::int as total,
           coalesce(sum(staff_discount_total), 0)::int as discount
    from active where staff_buyer_id is not null
  ),
  detail as (
    select s.id, s.created_at, s.status, s.voided_reason, s.total, s.commission_amount,
           s.product_commission_amount, sb.display_name as staff_buyer_name,
           b.display_name as barber_name, c.name as customer_name,
           (select string_agg(i.name || case when i.qty > 1 then ' ×' || i.qty else '' end
                              || case when i.is_reward then ' (premio)' when i.membership_benefit is not null then ' (membresía)' else '' end,
                              ', ' order by i.id)
            from sale_items i where i.sale_id = s.id) as items,
           (select string_agg(case p.method when 'cash' then 'Efectivo' when 'nequi' then 'Nequi'
                                             when 'daviplata' then 'Daviplata' when 'transfer' then 'Transferencia' when 'card' then 'Tarjeta'
                                             else 'Tarjeta de regalo' end, ' + ' order by p.id)
            from sale_payments p where p.sale_id = s.id) as methods,
           exists (select 1 from sale_items i where i.sale_id = s.id and i.membership_benefit = 'cut') as has_cut
    from day_sales s
    left join barbers b on b.id = s.barber_id
    left join barbers sb on sb.id = s.staff_buyer_id
    left join customers c on c.id = s.customer_id
  )
  select jsonb_build_object(
    'day', v_day,
    'byMethod', jsonb_build_object(
      'cash', coalesce((select amount from pay where method = 'cash'), 0),
      'nequi', coalesce((select amount from pay where method = 'nequi'), 0),
      'daviplata', coalesce((select amount from pay where method = 'daviplata'), 0),
      'transfer', coalesce((select amount from pay where method = 'transfer'), 0),
      'card', coalesce((select amount from pay where method = 'card'), 0),
      'giftCard', coalesce((select amount from pay where method = 'gift_card'), 0)),
    'total', coalesce((select sum(total) from active), 0),
    'services', coalesce((select sum(services_total) from active), 0),
    'products', coalesce((select sum(products_total) from active), 0),
    'rewards', (select amount from rewards),
    'membershipFees', coalesce((select sum(membership_total) from active), 0),
    'membershipCuts', (select jsonb_build_object('count', count, 'listValue', list_value) from cuts),
    -- REQ-059.1 / REQ-059.2 tarjetas vendidas, lo pagado con ellas (no es plata nueva) y lo que entró
    'giftCardsSold', coalesce((select sum(gift_card_total) from active), 0),
    'giftCardsRedeemed', coalesce((select amount from pay where method = 'gift_card'), 0),
    'moneyIn', coalesce((select sum(total) from active), 0) - coalesce((select amount from pay where method = 'gift_card'), 0),
    'commission', coalesce((select sum(commission_amount) from active), 0),
    'productCommission', coalesce((select sum(product_commission_amount) from active), 0),
    'staffPurchases', (select jsonb_build_object('count', count, 'total', total, 'discount', discount) from staff),
    'cashExpected', coalesce((select amount from pay where method = 'cash'), 0),
    'barbers', coalesce((select jsonb_agg(jsonb_build_object(
        'barberId', barber_id, 'name', name, 'pct', pct, 'services', services, 'sold', sold,
        'commission', commission, 'business', business, 'productsSold', products_sold,
        'productCommission', product_commission, 'productPct', product_pct,
        'toPay', commission + product_commission) order by name)
      from per_barber where services > 0 or commission > 0 or product_commission > 0), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'at', created_at, 'status', status, 'voidedReason', voided_reason, 'total', total,
        'commission', commission_amount, 'productCommission', product_commission_amount,
        'barberName', barber_name, 'staffBuyerName', staff_buyer_name, 'customerName', customer_name,
        'items', items, 'methods', coalesce(methods, case when has_cut then 'Sin pago (membresía)' else 'Sin pago (premio)' end))
        order by created_at desc)
      from detail), '[]'::jsonb),
    'closure', (select jsonb_build_object('id', c.id, 'closedAt', c.closed_at, 'cashCounted', c.cash_counted,
                                          'cashExpected', c.cash_expected, 'difference', c.difference, 'totals', c.totals)
                from cash_closures c
                where c.business_id = p_business_id and c.business_day = v_day and c.status = 'active')
  ) into v;
  return v;
end $$;
