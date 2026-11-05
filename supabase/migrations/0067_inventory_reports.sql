-- 0067 · Hito 13, inventario: orden de compra, costo por servicio y "Mi estación" (T-124, ADR-039)
-- Cubre: REQ-074.1, REQ-074.3, REQ-074.4. Diseño: design.md §18.3 y §18.5 (ejemplos O y P).

-- REQ-074.1 lo que está en el mínimo o por debajo (bodega + vitrina), hasta el máximo, por proveedor
create or replace function purchase_order(p_business_id uuid)
returns table (supplier text, item_id uuid, name text, presentation text, unit_label text, on_hand int,
               min_qty int, max_qty int, qty int, unit_cost int, amount int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  with h as (
    select i.*, coalesce((select sum(s.qty) from inventory_stock(p_business_id) s
                          join inventory_locations l on l.id = s.location_id
                          where s.item_id = i.id and l.kind in ('warehouse', 'shelf')), 0)::int as on_hand
    from inventory_items i
    where i.business_id = p_business_id and i.is_active and i.max_qty > 0
  )
  select h.supplier, h.id, h.name, h.presentation, h.unit_label, h.on_hand, h.min_qty, h.max_qty,
         h.max_qty - h.on_hand, h.unit_cost, (h.max_qty - h.on_hand) * h.unit_cost
  from h
  where h.on_hand <= h.min_qty
  order by h.supplier nulls last, h.name;
end $$;

-- REQ-074.3 costo de insumos por servicio activo: Σ precio por unidad ÷ rendimiento, al peso
create or replace function service_supply_cost(p_business_id uuid)
returns table (service_id uuid, name text, cost int, incomplete boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select s.id, s.name,
         coalesce(round(sum(i.unit_cost::numeric / u.services_per_unit)
                        filter (where i.id is not null and u.services_per_unit is not null)), 0)::int,
         coalesce(bool_or(i.id is not null and u.services_per_unit is null), false)
  from services s
  left join inventory_usage u on u.service_id = s.id
  left join inventory_items i on i.id = u.item_id and i.is_active
  where s.business_id = p_business_id and s.is_active
  group by s.id, s.name, s.sort_order
  order by s.sort_order, s.name;
end $$;

-- REQ-074.4 "Mi estación": dotación, stock, reposiciones de 30 días y último conteo, sin precios
create or replace function my_station(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_barber uuid := my_barber_id(p_business_id);
  st inventory_locations%rowtype;
  c stock_counts%rowtype;
begin
  if v_barber is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into st from inventory_locations where kind = 'station' and barber_id = v_barber;
  if not found then
    return jsonb_build_object('status', null, 'items', '[]'::jsonb, 'refills', '[]'::jsonb, 'lastCount', null);
  end if;
  select * into c from stock_counts where location_id = st.id order by counted_at desc limit 1;

  return jsonb_build_object(
    'status', st.status,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object('itemId', i.id, 'name', i.name, 'unitLabel', i.unit_label,
                                          'allowance', i.station_qty, 'stock', stock_qty(st.id, i.id))
                       order by i.sort_order, i.name)
      from inventory_items i
      where i.business_id = p_business_id and i.use = 'internal'
        and ((i.is_active and i.station_qty > 0) or stock_qty(st.id, i.id) <> 0)), '[]'),
    'refills', coalesce((
      select jsonb_agg(jsonb_build_object('at', m.created_at, 'itemName', i.name, 'qty', m.qty)
                       order by m.created_at desc)
      from stock_movements m join inventory_items i on i.id = m.item_id
      where m.to_location_id = st.id and m.kind = 'refill' and m.created_at > now() - interval '30 days'), '[]'),
    'lastCount', case when c.id is null then null else jsonb_build_object(
      'countedAt', c.counted_at, 'kind', c.kind, 'windowStart', c.window_start,
      'lines', (select coalesce(jsonb_agg(jsonb_build_object(
                  'itemId', i.id, 'name', i.name, 'countedQty', cl.counted_qty, 'services', cl.services,
                  'expectedUse', cl.expected_use, 'realUse', cl.real_use, 'measuring', cl.measuring,
                  'alert', cl.alert) order by i.sort_order, i.name), '[]')
                from stock_count_lines cl join inventory_items i on i.id = cl.item_id
                where cl.count_id = c.id)) end);
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function purchase_order(uuid), service_supply_cost(uuid), my_station(uuid)
  from public, anon, authenticated;
grant execute on function purchase_order(uuid), service_supply_cost(uuid), my_station(uuid)
  to service_role, authenticated;
