-- 0065 · Hito 13, inventario: la vitrina se descuenta desde la caja y la cortesía (T-122, ADR-039)
-- Cubre: REQ-072.1–072.4. Diseño: design.md §18.4.
-- No redefine register_sale ni void_sale (son del Hito 12): solo triggers sobre sale_items, sales y
-- tickets. Depende de que las líneas de producto lleven kind = 'product', ref_id = products.id y qty.

-- REQ-072.1 / REQ-072.3 cada línea de un producto enlazado sale de la vitrina; la caja nunca se
-- bloquea, así que la vitrina puede quedar negativa
create or replace function stock_on_sale_item() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into stock_movements (business_id, item_id, kind, from_location_id, qty, sale_id, sale_item_id, created_by)
  select new.business_id, i.id, 'sale', l.id, new.qty, new.sale_id, new.id, auth.uid()
  from inventory_items i
  join inventory_locations l on l.business_id = i.business_id and l.kind = 'shelf'
  where i.business_id = new.business_id and i.product_id = new.ref_id and i.is_active and new.qty > 0;
  return new;
end $$;
create trigger stock_on_sale_item after insert on sale_items
  for each row when (new.kind = 'product') execute function stock_on_sale_item();

-- REQ-072.2 al anular, vuelve a la vitrina lo que la venta sacó, una sola vez; ningún otro cambio
-- de la venta mueve stock
create or replace function stock_on_sale_void() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into stock_movements (business_id, item_id, kind, to_location_id, qty, sale_id, sale_item_id, created_by)
  select m.business_id, m.item_id, 'sale_void', m.from_location_id, m.qty, m.sale_id, m.sale_item_id, auth.uid()
  from stock_movements m
  where m.sale_id = new.id and m.kind = 'sale'
  on conflict (sale_item_id, kind) where sale_item_id is not null do nothing;
  return new;
end $$;
create trigger stock_on_sale_void after update of status on sales
  for each row when (old.status = 'active' and new.status = 'voided') execute function stock_on_sale_void();

-- REQ-072.4 la bebida de cortesía servida sale de la vitrina, una vez por turno
create or replace function stock_on_courtesy() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into stock_movements (business_id, item_id, kind, from_location_id, qty, ticket_id, created_by)
  select new.business_id, i.id, 'courtesy', l.id, 1, new.id, auth.uid()
  from inventory_items i
  join inventory_locations l on l.business_id = i.business_id and l.kind = 'shelf'
  where i.business_id = new.business_id and i.product_id = new.courtesy_product_id and i.is_active
  on conflict (ticket_id) where kind = 'courtesy' do nothing;
  return new;
end $$;
create trigger stock_on_courtesy after update of courtesy_served_at on tickets
  for each row when (old.courtesy_served_at is null and new.courtesy_served_at is not null)
  execute function stock_on_courtesy();

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function stock_on_sale_item(), stock_on_sale_void(), stock_on_courtesy()
  from public, anon, authenticated;
grant execute on function stock_on_sale_item(), stock_on_sale_void(), stock_on_courtesy() to service_role;
