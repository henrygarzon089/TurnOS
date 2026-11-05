-- 0063 · Hito 13, inventario: datos, sitios, catálogo y RLS (T-120, ADR-039)
-- Cubre: REQ-070.1–070.6, REQ-071.6, REQ-073.1, REQ-074.5. Diseño: design.md §18.1–§18.3.
-- Movimientos (0064), caja (0065), conteos (0066) y reportes (0067) van aparte. Sin ítems nada cambia.

-- ---------------------------------------------------------------- enums ----
create type inventory_group as enum ('biosafety', 'shave_beard', 'finishing', 'wash_comfort', 'machines',
                                     'facials', 'manicure', 'women_chemicals', 'for_sale');
create type inventory_use as enum ('internal', 'sale');
create type inventory_location_kind as enum ('warehouse', 'shelf', 'station');
create type stock_movement_kind as enum ('purchase', 'transfer', 'empty', 'refill', 'use', 'adjustment',
                                         'sale', 'sale_void', 'courtesy');
create type stock_adjustment_reason as enum ('initial', 'expired', 'damaged', 'missing', 'surplus', 'other');
create type stock_count_kind as enum ('initial', 'weekly', 'monthly', 'closing');

-- REQ-073.4 porcentaje de la alerta de consumo, por negocio
alter table businesses add column inventory_alert_pct int not null default 10
  check (inventory_alert_pct between 1 and 100);

-- ----------------------------------------------------- inventory_items ----
-- REQ-070.1 / REQ-070.2 / REQ-070.4 un catálogo: insumos de uso interno y productos de vitrina
create table inventory_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  "group" inventory_group not null,
  use inventory_use not null,
  presentation text not null check (length(trim(presentation)) between 1 and 60),
  unit_label text not null check (length(trim(unit_label)) between 1 and 20),
  unit_cost int not null default 0 check (unit_cost >= 0),
  supplier text check (length(trim(supplier)) between 1 and 60),
  min_qty int not null default 0 check (min_qty >= 0),
  max_qty int not null default 0,
  shelf_min int check (shelf_min >= 0),
  station_qty int not null default 0 check (station_qty >= 0),
  product_id uuid,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (business_id, id),
  unique (business_id, product_id),
  constraint inventory_items_max_ck check (max_qty >= min_qty),
  constraint inventory_items_internal_ck check (use = 'sale' or (product_id is null and shelf_min is null)),
  constraint inventory_items_sale_ck check (use = 'internal' or station_qty = 0),
  foreign key (business_id, product_id) references products (business_id, id)
);
create index inventory_items_business_idx on inventory_items (business_id, is_active, sort_order);

-- ------------------------------------------------- inventory_locations ----
-- REQ-070.3 bodega, vitrina y una estación por barbero (del barbero, no de la silla)
create table inventory_locations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  kind inventory_location_kind not null,
  barber_id uuid,
  status text not null default 'open' check (status in ('open', 'closing', 'closed')),
  created_at timestamptz not null default now(),
  unique (business_id, id),
  constraint inventory_locations_station_ck check ((kind = 'station') = (barber_id is not null)),
  foreign key (business_id, barber_id) references barbers (business_id, id)
);
create unique index inventory_locations_base_uniq on inventory_locations (business_id, kind) where kind <> 'station';
create unique index inventory_locations_station_uniq on inventory_locations (business_id, barber_id)
  where kind = 'station';

-- ----------------------------------------------------- inventory_usage ----
-- REQ-073.1 qué servicios gastan un insumo y cuántos alcanza una unidad (null = "Midiendo")
create table inventory_usage (
  business_id uuid not null,
  item_id uuid not null,
  service_id uuid not null,
  services_per_unit int check (services_per_unit >= 1),
  primary key (item_id, service_id),
  foreign key (business_id, item_id) references inventory_items (business_id, id),
  foreign key (business_id, service_id) references services (business_id, id)
);
create index inventory_usage_service_idx on inventory_usage (service_id);

-- -------------------------------------------------------- stock_counts ----
-- REQ-073.3 / REQ-073.6 conteos de un sitio y sus líneas (las llena record_stock_count, 0066)
create table stock_counts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  location_id uuid not null,
  kind stock_count_kind not null,
  window_start timestamptz,
  counted_at timestamptz not null default now(),
  created_by uuid,
  unique (business_id, id),
  foreign key (business_id, location_id) references inventory_locations (business_id, id)
);
create index stock_counts_location_idx on stock_counts (location_id, counted_at);

create table stock_count_lines (
  count_id uuid not null,
  business_id uuid not null,
  item_id uuid not null,
  system_qty int not null,
  counted_qty int not null check (counted_qty >= 0),
  difference int not null,
  reason stock_adjustment_reason,
  services int,
  expected_use numeric(10, 2),
  real_use int,
  measuring boolean not null default false,
  alert boolean not null default false,
  primary key (count_id, item_id),
  foreign key (business_id, count_id) references stock_counts (business_id, id),
  foreign key (business_id, item_id) references inventory_items (business_id, id)
);

-- ----------------------------------------------------- stock_movements ----
-- REQ-071.1 el stock se calcula de movimientos (los vuelve inmutables 0064)
create table stock_movements (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  item_id uuid not null,
  kind stock_movement_kind not null,
  from_location_id uuid,
  to_location_id uuid,
  qty int not null check (qty > 0),
  unit_cost int check (unit_cost >= 0),
  reason stock_adjustment_reason,
  sale_id uuid references sales (id),
  sale_item_id bigint references sale_items (id),
  ticket_id uuid references tickets (id),
  count_id uuid,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint stock_movements_place_ck check (from_location_id is not null or to_location_id is not null),
  foreign key (business_id, item_id) references inventory_items (business_id, id),
  foreign key (business_id, from_location_id) references inventory_locations (business_id, id),
  foreign key (business_id, to_location_id) references inventory_locations (business_id, id),
  foreign key (business_id, count_id) references stock_counts (business_id, id)
);
create index stock_movements_item_idx on stock_movements (business_id, item_id);
create index stock_movements_from_idx on stock_movements (from_location_id) where from_location_id is not null;
create index stock_movements_to_idx on stock_movements (to_location_id) where to_location_id is not null;
create index stock_movements_sale_idx on stock_movements (sale_id) where sale_id is not null;
-- REQ-072.2 / REQ-072.4 una línea de venta o una cortesía mueve la vitrina una sola vez por tipo
create unique index stock_movements_sale_item_uniq on stock_movements (sale_item_id, kind) where sale_item_id is not null;
create unique index stock_movements_courtesy_uniq on stock_movements (ticket_id) where kind = 'courtesy';

-- --------------------------------------------------------------- sitios ----
-- REQ-070.3 bodega y vitrina de cada negocio (los nuevos, por trigger; sin tocar create_business)
create or replace function inventory_base_locations(p_business_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into inventory_locations (business_id, kind)
  select p_business_id, k::inventory_location_kind from unnest(array['warehouse', 'shelf']) k
  where not exists (select 1 from inventory_locations l where l.business_id = p_business_id and l.kind::text = k)
$$;

create or replace function businesses_inventory_locations() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform inventory_base_locations(new.id);
  return new;
end $$;
create trigger businesses_inventory_locations after insert on businesses
  for each row execute function businesses_inventory_locations();

-- REQ-070.3 / REQ-073.7 la estación sigue al barbero: abierta si está activo, por cerrar si se va
create or replace function barbers_inventory_station() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.is_active then
    update inventory_locations set status = 'open'
    where kind = 'station' and business_id = new.business_id and barber_id = new.id;
    if not found then
      insert into inventory_locations (business_id, kind, barber_id) values (new.business_id, 'station', new.id);
    end if;
  else
    update inventory_locations set status = 'closing'
    where kind = 'station' and business_id = new.business_id and barber_id = new.id and status = 'open';
  end if;
  return new;
end $$;
create trigger barbers_inventory_station_ins after insert on barbers
  for each row when (new.is_active) execute function barbers_inventory_station();
create trigger barbers_inventory_station_upd after update of is_active on barbers
  for each row when (old.is_active is distinct from new.is_active) execute function barbers_inventory_station();

select inventory_base_locations(id) from businesses;
insert into inventory_locations (business_id, kind, barber_id)
select b.business_id, 'station', b.id from barbers b
where b.is_active
  and not exists (select 1 from inventory_locations l where l.kind = 'station' and l.barber_id = b.id);

-- ------------------------------------------------------------------ RLS ----
-- §18.2 el dueño lee; el barbero no ve nada (usa my_station, 0067); cambios solo con funciones
alter table inventory_items enable row level security;
alter table inventory_items force row level security;
alter table inventory_locations enable row level security;
alter table inventory_locations force row level security;
alter table inventory_usage enable row level security;
alter table inventory_usage force row level security;
alter table stock_movements enable row level security;
alter table stock_movements force row level security;
alter table stock_counts enable row level security;
alter table stock_counts force row level security;
alter table stock_count_lines enable row level security;
alter table stock_count_lines force row level security;

create policy inventory_items_owner_select on inventory_items for select to authenticated
  using (is_owner_of(business_id));
create policy inventory_locations_owner_select on inventory_locations for select to authenticated
  using (is_owner_of(business_id));
create policy inventory_usage_owner_select on inventory_usage for select to authenticated
  using (is_owner_of(business_id));
create policy stock_movements_owner_select on stock_movements for select to authenticated
  using (is_owner_of(business_id));
create policy stock_counts_owner_select on stock_counts for select to authenticated
  using (is_owner_of(business_id));
create policy stock_count_lines_owner_select on stock_count_lines for select to authenticated
  using (is_owner_of(business_id));

revoke all on inventory_items, inventory_locations, inventory_usage, stock_movements, stock_counts,
  stock_count_lines from public, anon, authenticated;
grant select on inventory_items, inventory_locations, inventory_usage, stock_movements, stock_counts,
  stock_count_lines to authenticated;
grant all on inventory_items, inventory_locations, inventory_usage, stock_movements, stock_counts,
  stock_count_lines to service_role;

-- ------------------------------------------------------------ funciones ----
-- REQ-070.1 / REQ-070.2 / REQ-070.4 / REQ-070.6 el dueño crea o edita un ítem (con "id", edita).
-- p_item: {id?, name, group, use, presentation, unitLabel, unitCost, supplier?, minQty, maxQty,
--          shelfMin?, stationQty, productId?, isActive?, sortOrder?}
create or replace function save_inventory_item(p_business_id uuid, p_item jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid := nullif(p_item ->> 'id', '')::uuid;
  v_name text := trim(coalesce(p_item ->> 'name', ''));
  v_presentation text := trim(coalesce(p_item ->> 'presentation', ''));
  v_unit text := trim(coalesce(p_item ->> 'unitLabel', ''));
  v_supplier text := nullif(trim(coalesce(p_item ->> 'supplier', '')), '');
  v_use text := p_item ->> 'use';
  v_group text := p_item ->> 'group';
  v_cost int := coalesce((p_item ->> 'unitCost')::int, 0);
  v_min int := coalesce((p_item ->> 'minQty')::int, 0);
  v_max int := coalesce((p_item ->> 'maxQty')::int, 0);
  v_shelf int := (p_item ->> 'shelfMin')::int;
  v_station int := coalesce((p_item ->> 'stationQty')::int, 0);
  v_product uuid := nullif(p_item ->> 'productId', '')::uuid;
  v_active boolean := coalesce((p_item ->> 'isActive')::boolean, true);
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(v_name) not between 1 and 60 or length(v_presentation) not between 1 and 60
     or length(v_unit) not between 1 and 20 or length(coalesce(v_supplier, 'x')) > 60
     or v_use is null or v_use <> all (enum_range(null::inventory_use)::text[])
     or v_group is null or v_group <> all (enum_range(null::inventory_group)::text[])
     or v_cost < 0 or v_min < 0 or v_max < v_min or v_station < 0 or v_shelf < 0
     or (v_use = 'internal' and (v_product is not null or v_shelf is not null))
     or (v_use = 'sale' and v_station <> 0) then
    raise exception 'INVALID_ITEM' using errcode = 'P0004';
  end if;
  if v_product is not null and (
       not exists (select 1 from products where id = v_product and business_id = p_business_id)
       or exists (select 1 from inventory_items where product_id = v_product and id is distinct from v_id)) then
    raise exception 'PRODUCT_TAKEN' using errcode = 'P0004';
  end if;

  if v_id is null then
    insert into inventory_items (business_id, name, "group", use, presentation, unit_label, unit_cost, supplier,
                                 min_qty, max_qty, shelf_min, station_qty, product_id, is_active, sort_order)
    values (p_business_id, v_name, v_group::inventory_group, v_use::inventory_use, v_presentation, v_unit, v_cost,
            v_supplier, v_min, v_max, v_shelf, v_station, v_product, v_active,
            coalesce((p_item ->> 'sortOrder')::int,
                     (select coalesce(max(sort_order), 0) + 1 from inventory_items where business_id = p_business_id)))
    returning id into v_id;
  else
    update inventory_items
    set name = v_name, "group" = v_group::inventory_group, use = v_use::inventory_use,
        presentation = v_presentation, unit_label = v_unit, unit_cost = v_cost, supplier = v_supplier,
        min_qty = v_min, max_qty = v_max, shelf_min = v_shelf, station_qty = v_station, product_id = v_product,
        is_active = v_active, sort_order = coalesce((p_item ->> 'sortOrder')::int, sort_order)
    where id = v_id and business_id = p_business_id;
    if not found then
      raise exception 'INVALID_ITEM' using errcode = 'P0004';
    end if;
  end if;
  return v_id;
end $$;

-- REQ-073.1 reemplaza los servicios que gastan un insumo: [{serviceId, servicesPerUnit | null}]
create or replace function set_item_usage(p_item_id uuid, p_usage jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items%rowtype;
  u jsonb;
begin
  select * into i from inventory_items where id = p_item_id;
  if not found then
    raise exception 'INVALID_ITEM' using errcode = 'P0004';
  end if;
  if auth.uid() is not null and not is_owner_of(i.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if i.use <> 'internal' then
    raise exception 'INVALID_ITEM' using errcode = 'P0004';
  end if;
  for u in select * from jsonb_array_elements(coalesce(p_usage, '[]'::jsonb)) loop
    if not exists (select 1 from services where id = (u ->> 'serviceId')::uuid and business_id = i.business_id) then
      raise exception 'FORBIDDEN' using errcode = '42501';
    end if;
    if (u ->> 'servicesPerUnit')::int < 1 then
      raise exception 'INVALID_YIELD' using errcode = 'P0004';
    end if;
  end loop;

  delete from inventory_usage where item_id = i.id;
  insert into inventory_usage (business_id, item_id, service_id, services_per_unit)
  select i.business_id, i.id, (e ->> 'serviceId')::uuid, (e ->> 'servicesPerUnit')::int
  from jsonb_array_elements(coalesce(p_usage, '[]'::jsonb)) e;
end $$;

-- REQ-071.1 stock por sitio = lo que entra − lo que sale (design.md §18.1)
create or replace function inventory_stock(p_business_id uuid)
returns table (location_id uuid, item_id uuid, qty int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select x.loc, x.item, sum(x.q)::int
  from (select m.to_location_id as loc, m.item_id as item, m.qty as q from stock_movements m
        where m.business_id = p_business_id and m.to_location_id is not null
        union all
        select m.from_location_id, m.item_id, -m.qty from stock_movements m
        where m.business_id = p_business_id and m.from_location_id is not null) x
  group by x.loc, x.item;
end $$;

-- REQ-070.4 dotación de toda estación: insumos activos de uso interno con dotación > 0
create or replace function station_allowance(p_business_id uuid)
returns table (item_id uuid, qty int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select i.id, i.station_qty from inventory_items i
  where i.business_id = p_business_id and i.is_active and i.use = 'internal' and i.station_qty > 0
  order by i.sort_order, i.name;
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  inventory_base_locations(uuid),
  businesses_inventory_locations(),
  barbers_inventory_station(),
  save_inventory_item(uuid, jsonb),
  set_item_usage(uuid, jsonb),
  inventory_stock(uuid),
  station_allowance(uuid)
from public, anon, authenticated;
grant execute on function
  inventory_base_locations(uuid),
  businesses_inventory_locations(),
  barbers_inventory_station(),
  save_inventory_item(uuid, jsonb),
  set_item_usage(uuid, jsonb),
  inventory_stock(uuid),
  station_allowance(uuid)
to service_role;
-- Personal (cada una valida el negocio por dentro)
grant execute on function
  save_inventory_item(uuid, jsonb),
  set_item_usage(uuid, jsonb),
  inventory_stock(uuid),
  station_allowance(uuid)
to authenticated;
