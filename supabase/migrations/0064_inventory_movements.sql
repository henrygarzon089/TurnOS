-- 0064 · Hito 13, inventario: entradas, transferencias, reposición y resumen (T-121, ADR-039)
-- Cubre: REQ-071.1–071.6, REQ-072.5, REQ-073.7 (estaciones por cerrar en el resumen).
-- Diseño: design.md §18.1 y §18.3.

-- REQ-071.1 los movimientos no se editan ni se borran (como sales_guard)
create or replace function stock_movements_guard() returns trigger
language plpgsql as $$
begin
  raise exception 'STOCK_IMMUTABLE' using errcode = 'P0004';
end $$;
create trigger stock_movements_guard before update or delete on stock_movements
  for each row execute function stock_movements_guard();

-- Stock de un ítem en un sitio (design.md §18.1)
create or replace function stock_qty(p_location_id uuid, p_item_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select coalesce(sum(case when to_location_id = p_location_id then qty else -qty end), 0)::int
  from stock_movements
  where item_id = p_item_id and p_location_id in (from_location_id, to_location_id)
$$;

-- REQ-071.3 / REQ-071.5 valida y registra un paso de un sitio a otro. Lo usan transfer_stock y
-- refill_station; quien llama ya validó al dueño y bloqueó el ítem.
create or replace function inventory_transfer(p_item inventory_items, p_from_location_id uuid,
                                              p_to_location_id uuid, p_qty int, p_kind stock_movement_kind)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  f inventory_locations%rowtype;
  t inventory_locations%rowtype;
  v_id uuid;
begin
  if p_qty is null or p_qty <= 0 then
    raise exception 'INVALID_QTY' using errcode = 'P0004';
  end if;
  select * into f from inventory_locations where id = p_from_location_id and business_id = p_item.business_id;
  select * into t from inventory_locations where id = p_to_location_id and business_id = p_item.business_id;
  if f.id is null or t.id is null or not (
       (p_item.use = 'sale' and f.kind = 'warehouse' and t.kind = 'shelf')
    or (p_item.use = 'sale' and f.kind = 'shelf' and t.kind = 'warehouse')
    or (p_item.use = 'internal' and f.kind = 'warehouse' and t.kind = 'station')
    or (p_item.use = 'internal' and f.kind = 'station' and t.kind = 'warehouse')) then
    raise exception 'INVALID_TRANSFER' using errcode = 'P0004';
  end if;
  if (t.kind = 'station' and t.status <> 'open') or (f.kind = 'station' and f.status = 'closed') then
    raise exception 'STATION_CLOSED' using errcode = 'P0004';
  end if;
  if stock_qty(f.id, p_item.id) < p_qty then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0004';
  end if;
  if t.kind = 'station' and stock_qty(t.id, p_item.id) + p_qty > p_item.station_qty then
    raise exception 'OVER_ALLOWANCE' using errcode = 'P0004';
  end if;
  insert into stock_movements (business_id, item_id, kind, from_location_id, to_location_id, qty, created_by)
  values (p_item.business_id, p_item.id, p_kind, f.id, t.id, p_qty, auth.uid())
  returning id into v_id;
  return v_id;
end $$;

-- El ítem del dueño, bloqueado para que dos cambios a la vez no pasen del stock
create or replace function inventory_owned_item(p_item_id uuid) returns inventory_items
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items%rowtype;
begin
  select * into i from inventory_items where id = p_item_id for update;
  if not found then
    raise exception 'INVALID_ITEM' using errcode = 'P0004';
  end if;
  if auth.uid() is not null and not is_owner_of(i.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return i;
end $$;

-- REQ-071.2 entrada a bodega con el precio pagado por unidad (queda como precio del ítem)
create or replace function register_stock_purchase(p_item_id uuid, p_qty int, p_unit_cost int) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items%rowtype := inventory_owned_item(p_item_id);
  v_id uuid;
begin
  if p_qty is null or p_qty <= 0 or p_unit_cost is null or p_unit_cost < 0 then
    raise exception 'INVALID_QTY' using errcode = 'P0004';
  end if;
  insert into stock_movements (business_id, item_id, kind, to_location_id, qty, unit_cost, created_by)
  select i.business_id, i.id, 'purchase', l.id, p_qty, p_unit_cost, auth.uid()
  from inventory_locations l where l.business_id = i.business_id and l.kind = 'warehouse'
  returning id into v_id;
  update inventory_items set unit_cost = p_unit_cost where id = i.id;
  return v_id;
end $$;

-- REQ-071.3 transferencia entre bodega y vitrina, o entre bodega y estación
create or replace function transfer_stock(p_item_id uuid, p_from_location_id uuid, p_to_location_id uuid,
                                          p_qty int) returns uuid
language plpgsql security definer set search_path = public as $$
begin
  return inventory_transfer(inventory_owned_item(p_item_id), p_from_location_id, p_to_location_id, p_qty,
                            'transfer');
end $$;

-- REQ-071.4 reposición: sin envase vacío no hay; sale el vacío (consumo) y entra el lleno
create or replace function refill_station(p_barber_id uuid, p_item_id uuid, p_qty int, p_empty_returned boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items%rowtype := inventory_owned_item(p_item_id);
  st inventory_locations%rowtype;
begin
  select * into st from inventory_locations
  where kind = 'station' and barber_id = p_barber_id and business_id = i.business_id;
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not coalesce(p_empty_returned, false) then
    raise exception 'EMPTY_REQUIRED' using errcode = 'P0004';
  end if;
  if p_qty is null or p_qty <= 0 then
    raise exception 'INVALID_QTY' using errcode = 'P0004';
  end if;
  if st.status <> 'open' then
    raise exception 'STATION_CLOSED' using errcode = 'P0004';
  end if;
  if i.use <> 'internal' then
    raise exception 'INVALID_TRANSFER' using errcode = 'P0004';
  end if;
  if stock_qty(st.id, i.id) < p_qty then
    raise exception 'INSUFFICIENT_STOCK' using errcode = 'P0004';
  end if;
  insert into stock_movements (business_id, item_id, kind, from_location_id, qty, created_by)
  values (i.business_id, i.id, 'empty', st.id, p_qty, auth.uid());
  perform inventory_transfer(i, (select id from inventory_locations where business_id = i.business_id and kind = 'warehouse'),
                             st.id, p_qty, 'refill');
end $$;

-- Panel del dueño: stock por sitio, negativos, "Surtir vitrina", alertas del último conteo de cada
-- estación abierta y estaciones por cerrar (REQ-072.3, REQ-072.5, REQ-073.4, REQ-073.7)
create or replace function inventory_overview(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_items jsonb;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with st as (select * from inventory_stock(p_business_id)),
  base as (
    select i.*,
           coalesce((select s.qty from st s join inventory_locations l on l.id = s.location_id
                     where s.item_id = i.id and l.kind = 'warehouse'), 0) as warehouse,
           coalesce((select s.qty from st s join inventory_locations l on l.id = s.location_id
                     where s.item_id = i.id and l.kind = 'shelf'), 0) as shelf,
           exists (select 1 from st s where s.item_id = i.id and s.qty < 0) as negative,
           coalesce((select jsonb_object_agg(s.location_id, s.qty) from st s where s.item_id = i.id), '{}') as stock
    from inventory_items i
    where i.business_id = p_business_id and i.is_active
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', b.id, 'name', b.name, 'group', b."group", 'use', b.use, 'presentation', b.presentation,
           'unitLabel', b.unit_label, 'unitCost', b.unit_cost, 'supplier', b.supplier, 'minQty', b.min_qty,
           'maxQty', b.max_qty, 'shelfMin', b.shelf_min, 'stationQty', b.station_qty, 'productId', b.product_id,
           'warehouse', b.warehouse, 'shelf', b.shelf, 'stock', b.stock, 'negative', b.negative,
           'shelfToFill', case when b.use = 'sale' and b.shelf_min is not null and b.shelf <= b.shelf_min
                               then b.shelf_min - b.shelf end)
           order by b.sort_order, b.name), '[]')
  into v_items from base b;

  return jsonb_build_object(
    'items', v_items,
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object('id', l.id, 'kind', l.kind, 'barberId', l.barber_id,
                                          'barberName', br.display_name, 'status', l.status)
                       order by l.kind, br.sort_order)
      from inventory_locations l left join barbers br on br.id = l.barber_id
      where l.business_id = p_business_id and l.status <> 'closed'), '[]'),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object('locationId', l.id, 'barberName', br.display_name, 'itemId', i.id,
                                          'itemName', i.name, 'countedAt', c.counted_at,
                                          'expectedUse', cl.expected_use, 'realUse', cl.real_use)
                       order by br.sort_order, i.name)
      from inventory_locations l
      join barbers br on br.id = l.barber_id
      join lateral (select * from stock_counts c where c.location_id = l.id
                    order by c.counted_at desc limit 1) c on true
      join stock_count_lines cl on cl.count_id = c.id and cl.alert
      join inventory_items i on i.id = cl.item_id
      where l.business_id = p_business_id and l.kind = 'station' and l.status = 'open'), '[]'),
    'closingStations', coalesce((
      select jsonb_agg(jsonb_build_object('locationId', l.id, 'barberId', l.barber_id, 'barberName', br.display_name)
                       order by br.sort_order)
      from inventory_locations l join barbers br on br.id = l.barber_id
      where l.business_id = p_business_id and l.status = 'closing'), '[]'));
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  stock_movements_guard(),
  stock_qty(uuid, uuid),
  inventory_transfer(inventory_items, uuid, uuid, int, stock_movement_kind),
  inventory_owned_item(uuid),
  register_stock_purchase(uuid, int, int),
  transfer_stock(uuid, uuid, uuid, int),
  refill_station(uuid, uuid, int, boolean),
  inventory_overview(uuid)
from public, anon, authenticated;
grant execute on function
  stock_qty(uuid, uuid),
  inventory_transfer(inventory_items, uuid, uuid, int, stock_movement_kind),
  inventory_owned_item(uuid),
  register_stock_purchase(uuid, int, int),
  transfer_stock(uuid, uuid, uuid, int),
  refill_station(uuid, uuid, int, boolean),
  inventory_overview(uuid)
to service_role;
-- Personal (cada una valida al dueño por dentro)
grant execute on function
  register_stock_purchase(uuid, int, int),
  transfer_stock(uuid, uuid, uuid, int),
  refill_station(uuid, uuid, int, boolean),
  inventory_overview(uuid)
to authenticated;
