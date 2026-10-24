-- 0025 · Caja del día (T-045)
-- Cubre: REQ-026.1 (anuladas fuera de totales, visibles en el detalle), REQ-027.1 (totales en vivo),
-- REQ-027.5 (día de Bogotá). Diseño: design.md §5.2 (mismas fórmulas que el cierre de T-046).

-- "En vivo" con el mismo mecanismo de ADR-008: cada venta (o anulación) avisa por el canal del
-- negocio con kind = 'sale' (sin datos personales) y las pantallas vuelven a leer.
create or replace function sales_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_queue_changed(new.business_id, 'sale');
  return new;
end $$;
create trigger sales_broadcast after insert or update of status on sales
  for each row execute function sales_broadcast();

-- Resumen de un día de caja. Solo el dueño (REQ-029.1: el barbero nunca ve totales del negocio).
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
  rewards as (
    select coalesce(sum(i.discount), 0)::int as amount
    from sale_items i join active s on s.id = i.sale_id where i.is_reward
  ),
  per_barber as (
    select s.barber_id, b.display_name as name, b.commission_pct as pct,
           count(*) filter (where exists (select 1 from sale_items i where i.sale_id = s.id and i.kind = 'service'))::int as services,
           sum(s.services_total)::int as sold,
           sum(s.commission_amount)::int as commission,
           sum(s.business_amount)::int as business
    from active s join barbers b on b.id = s.barber_id
    group by s.barber_id, b.display_name, b.commission_pct
  ),
  detail as (
    select s.id, s.created_at, s.status, s.voided_reason, s.total, s.commission_amount,
           b.display_name as barber_name, c.name as customer_name,
           (select string_agg(i.name || case when i.qty > 1 then ' ×' || i.qty else '' end || case when i.is_reward then ' (premio)' else '' end,
                              ', ' order by i.id)
            from sale_items i where i.sale_id = s.id) as items,
           (select string_agg(case p.method when 'cash' then 'Efectivo' when 'nequi' then 'Nequi'
                                             when 'transfer' then 'Transferencia' else 'Tarjeta' end, ' + ' order by p.id)
            from sale_payments p where p.sale_id = s.id) as methods
    from day_sales s
    left join barbers b on b.id = s.barber_id
    left join customers c on c.id = s.customer_id
  )
  select jsonb_build_object(
    'day', v_day,
    'byMethod', jsonb_build_object(
      'cash', coalesce((select amount from pay where method = 'cash'), 0),
      'nequi', coalesce((select amount from pay where method = 'nequi'), 0),
      'transfer', coalesce((select amount from pay where method = 'transfer'), 0),
      'card', coalesce((select amount from pay where method = 'card'), 0)),
    'total', coalesce((select sum(total) from active), 0),
    'services', coalesce((select sum(services_total) from active), 0),
    'products', coalesce((select sum(products_total) from active), 0),
    'rewards', (select amount from rewards),
    'commission', coalesce((select sum(commission_amount) from active), 0),
    'cashExpected', coalesce((select amount from pay where method = 'cash'), 0),
    'barbers', coalesce((select jsonb_agg(jsonb_build_object(
        'barberId', barber_id, 'name', name, 'pct', pct, 'services', services, 'sold', sold,
        'commission', commission, 'business', business) order by name)
      from per_barber where services > 0 or commission > 0), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'at', created_at, 'status', status, 'voidedReason', voided_reason, 'total', total,
        'commission', commission_amount, 'barberName', barber_name, 'customerName', customer_name,
        'items', items, 'methods', coalesce(methods, 'Sin pago (premio)')) order by created_at desc)
      from detail), '[]'::jsonb),
    'closure', (select jsonb_build_object('id', c.id, 'closedAt', c.closed_at, 'cashCounted', c.cash_counted,
                                          'cashExpected', c.cash_expected, 'difference', c.difference, 'totals', c.totals)
                from cash_closures c
                where c.business_id = p_business_id and c.business_day = v_day and c.status = 'active')
  ) into v;
  return v;
end $$;

revoke all on function cash_day_summary(uuid, date) from public;
grant execute on function cash_day_summary(uuid, date) to authenticated, service_role;
