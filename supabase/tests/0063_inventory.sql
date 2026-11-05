-- T-120 · Inventario: catálogo, sitios y RLS (REQ-070, REQ-071.6, REQ-073.1, REQ-074.5, ADR-039,
-- design.md §18.1–§18.3). Movimientos, caja y conteos son T-121…T-123.
begin;
select plan(52);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from products p where p.business_id = z.id and p.name = 'Agua') as agua,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from services s where s.business_id = z.id order by sort_order limit 1) as corte,
       (select id from services s where s.business_id = z.id order by sort_order offset 1 limit 1) as barba
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

insert into businesses (name, slug) values ('Otra Barbería', 'otra-0063');
insert into ids select 'otra', id from businesses where slug = 'otra-0063';
insert into products (business_id, name, price) select (select v from ids where k = 'otra'), 'Agua otra', 2000;
insert into ids select 'agua_otra', id from products where name = 'Agua otra';
insert into services (business_id, name, duration_min, price)
select (select v from ids where k = 'otra'), 'Corte otra', 30, 20000;
insert into ids select 'corte_otra', id from services where name = 'Corte otra';

create function pg_temp.item(p jsonb) returns uuid language sql as $$
  select save_inventory_item((select biz from ctx),
    jsonb_build_object('name', 'Ítem', 'group', 'finishing', 'use', 'internal', 'presentation', 'Frasco 150 g',
                       'unitLabel', 'frasco', 'unitCost', 18000, 'minQty', 3, 'maxQty', 10, 'stationQty', 1) || p)
$$;

-- ------------------------------------------------------------------ datos ----
select has_table('inventory_items', 'REQ-070.1 el catálogo de inventario existe');
select enum_has_labels('inventory_group',
  array['biosafety', 'shave_beard', 'finishing', 'wash_comfort', 'machines', 'facials', 'manicure',
        'women_chemicals', 'for_sale'],
  'REQ-070.1 los nueve grupos del plan operativo');
select enum_has_labels('inventory_use', array['internal', 'sale'], 'REQ-070.1 uso interno o para la venta');
select col_type_is('stock_movements', 'qty', 'integer', 'REQ-070.5 las cantidades son unidades enteras');
select col_type_is('stock_count_lines', 'counted_qty', 'integer', 'REQ-070.5 lo contado son unidades enteras');
select col_default_is('businesses', 'inventory_alert_pct', '10', 'REQ-073.4 la alerta es del 10 % por defecto');

-- --------------------------------------------------------------- sitios ----
select is((select count(*)::int from inventory_locations where business_id = (select biz from ctx) and kind = 'warehouse'),
  1, 'REQ-070.3 el negocio que ya existía tiene una bodega');
select is((select count(*)::int from inventory_locations where business_id = (select biz from ctx) and kind = 'shelf'),
  1, 'REQ-070.3 y una vitrina');
select is((select count(*)::int from inventory_locations l join barbers b on b.id = l.barber_id
           where l.business_id = (select biz from ctx) and l.kind = 'station' and l.status = 'open' and b.is_active),
          (select count(*)::int from barbers where business_id = (select biz from ctx) and is_active),
  'REQ-070.3 una estación abierta por cada barbero activo');
select is((select count(*)::int from inventory_locations where business_id = (select v from ids where k = 'otra')
           and kind in ('warehouse', 'shelf')),
  2, 'REQ-070.3 un negocio nuevo nace con bodega y vitrina');
select throws_ok($$ insert into inventory_locations (business_id, kind) values ((select biz from ctx), 'warehouse') $$,
  '23505', null, 'REQ-070.3 una sola bodega por negocio');
select throws_ok($$ insert into inventory_locations (business_id, kind) values ((select biz from ctx), 'station') $$,
  '23514', null, 'REQ-070.3 una estación es de un barbero');

insert into barbers (business_id, display_name, commission_pct) values ((select biz from ctx), 'Nuevo 0063', 50);
insert into ids select 'nuevo', id from barbers where display_name = 'Nuevo 0063';
select is((select status from inventory_locations where barber_id = (select v from ids where k = 'nuevo')),
  'open', 'REQ-070.3 al crear un barbero se abre su estación');
update barbers set is_active = false where id = (select v from ids where k = 'nuevo');
select is((select status from inventory_locations where barber_id = (select v from ids where k = 'nuevo')),
  'closing', 'REQ-073.7 al desactivar al barbero su estación queda por cerrar');
update barbers set is_active = true where id = (select v from ids where k = 'nuevo');
select is((select string_agg(status, ',') from inventory_locations where barber_id = (select v from ids where k = 'nuevo')),
  'open', 'REQ-070.3 la estación es del barbero: al volver se abre la suya, no otra');
update barbers set sort_order = 99 where id = (select v from ids where k = 'nuevo');
select is((select status from inventory_locations where barber_id = (select v from ids where k = 'nuevo')),
  'open', 'REQ-070.3 otros cambios del barbero no tocan su estación');

-- ------------------------------------------------------ catálogo: dueño ----
select auth.test_login((select owner_u from ctx));
select lives_ok($$ insert into ids select 'cera', pg_temp.item('{"name": "Cera mate", "supplier": "Distri Sabaneta"}') $$,
  'REQ-070.1 el dueño crea un insumo de uso interno');
select is((select name || ' · ' || "group" || ' · ' || use || ' · ' || presentation || ' · ' || unit_label || ' · '
                  || unit_cost || ' · ' || supplier || ' · ' || min_qty || '-' || max_qty || ' · ' || station_qty
           from inventory_items where id = (select v from ids where k = 'cera')),
  'Cera mate · finishing · internal · Frasco 150 g · frasco · 18000 · Distri Sabaneta · 3-10 · 1',
  'REQ-070.1 guarda grupo, uso, presentación, unidad, precio, proveedor, mínimo, máximo y dotación');
select lives_ok($$ select pg_temp.item(jsonb_build_object('id', (select v from ids where k = 'cera'), 'name', 'Cera mate',
                                                         'unitCost', 19000, 'supplier', null)) $$,
  'REQ-070.1 el dueño edita un insumo');
select is((select unit_cost::text || ' ' || coalesce(supplier, '—') from inventory_items where id = (select v from ids where k = 'cera')),
  '19000 —', 'REQ-070.1 el proveedor es opcional');
select throws_ok($$ select pg_temp.item('{"minQty": 5, "maxQty": 4}') $$, 'P0004', 'INVALID_ITEM',
  'REQ-070.1 el mínimo no puede pasar del máximo');
select throws_ok($$ select pg_temp.item('{"unitCost": -1}') $$, 'P0004', 'INVALID_ITEM',
  'REQ-070.1 el precio por unidad es un entero ≥ 0');
select throws_ok($$ select pg_temp.item('{"stationQty": -1}') $$, 'P0004', 'INVALID_ITEM',
  'REQ-070.1 la dotación es un entero ≥ 0');
select throws_ok($$ select pg_temp.item('{"name": "  "}') $$, 'P0004', 'INVALID_ITEM', 'REQ-070.1 el nombre es obligatorio');

-- -------------------------------------------------- productos de vitrina ----
select lives_ok($$ insert into ids select 'agua', pg_temp.item(jsonb_build_object(
    'name', 'Agua 600 ml', 'group', 'for_sale', 'use', 'sale', 'unitLabel', 'botella', 'unitCost', 1200,
    'minQty', 12, 'maxQty', 48, 'shelfMin', 6, 'stationQty', 0, 'productId', (select agua from ctx))) $$,
  'REQ-070.2 un ítem para la venta se enlaza con su producto de la caja');
select is((select product_id from inventory_items where id = (select v from ids where k = 'agua')), (select agua from ctx),
  'REQ-070.2 queda enlazado al producto');
select is((select shelf_min from inventory_items where id = (select v from ids where k = 'agua')), 6,
  'REQ-070.2 y con su mínimo de vitrina');
select throws_ok($$ select pg_temp.item(jsonb_build_object('use', 'sale', 'stationQty', 0, 'productId', (select agua from ctx))) $$,
  'P0004', 'PRODUCT_TAKEN', 'REQ-070.2 un producto se enlaza con un solo ítem');
select throws_ok($$ select pg_temp.item(jsonb_build_object('use', 'sale', 'stationQty', 0,
                                                          'productId', (select v from ids where k = 'agua_otra'))) $$,
  'P0004', 'PRODUCT_TAKEN', 'REQ-070.2 no se enlaza un producto de otro negocio');
select throws_ok($$ select pg_temp.item(jsonb_build_object('productId', (select gaseosa from ctx))) $$,
  'P0004', 'INVALID_ITEM', 'REQ-070.2 un insumo de uso interno no se enlaza con un producto');
select throws_ok($$ select pg_temp.item('{"shelfMin": 2}') $$, 'P0004', 'INVALID_ITEM',
  'REQ-070.2 el mínimo de vitrina es solo de los ítems para la venta');
select throws_ok($$ select pg_temp.item('{"use": "sale", "stationQty": 1}') $$, 'P0004', 'INVALID_ITEM',
  'REQ-070.4 los ítems para la venta no van en la dotación de las estaciones');

-- -------------------------------------------------------------- dotación ----
select lives_ok($$ insert into ids select 'guantes', pg_temp.item('{"name": "Guantes caja 50 pares", "group": "biosafety", "unitLabel": "caja"}') $$,
  'REQ-070.4 segundo insumo de la dotación');
select lives_ok($$ insert into ids select 'alcohol', pg_temp.item('{"name": "Alcohol galón", "group": "biosafety", "stationQty": 0}') $$,
  'REQ-070.4 un insumo que solo vive en bodega');
select is((select string_agg(i.name || ' ×' || a.qty, ', ' order by i.name)
           from station_allowance((select biz from ctx)) a join inventory_items i on i.id = a.item_id),
  'Cera mate ×1, Guantes caja 50 pares ×1',
  'REQ-070.4 la dotación de toda estación son los insumos activos con dotación > 0');

select lives_ok($$ select pg_temp.item(jsonb_build_object('id', (select v from ids where k = 'guantes'),
                                                         'name', 'Guantes caja 50 pares', 'isActive', false)) $$,
  'REQ-070.6 el dueño desactiva un insumo');
select is((select count(*)::int from station_allowance((select biz from ctx))), 1,
  'REQ-070.6 el insumo desactivado sale de la dotación');
select ok(exists (select 1 from inventory_items where id = (select v from ids where k = 'guantes') and not is_active),
  'REQ-070.6 y se conserva con su historial');

-- ------------------------------------------------- servicios que gastan ----
select lives_ok($$ select set_item_usage((select v from ids where k = 'cera'),
                    jsonb_build_array(jsonb_build_object('serviceId', (select corte from ctx), 'servicesPerUnit', 40),
                                      jsonb_build_object('serviceId', (select barba from ctx), 'servicesPerUnit', null))) $$,
  'REQ-073.1 el dueño escoge qué servicios gastan el insumo');
select is((select string_agg(coalesce(services_per_unit::text, 'midiendo'), ',' order by services_per_unit nulls last)
           from inventory_usage where item_id = (select v from ids where k = 'cera')),
  '40,midiendo', 'REQ-073.1 con su rendimiento o "Midiendo"');
select lives_ok($$ select set_item_usage((select v from ids where k = 'cera'),
                    jsonb_build_array(jsonb_build_object('serviceId', (select corte from ctx), 'servicesPerUnit', 35))) $$,
  'REQ-073.1 cambiar los servicios reemplaza la lista');
select is((select string_agg(services_per_unit::text, ',') from inventory_usage where item_id = (select v from ids where k = 'cera')),
  '35', 'REQ-073.1 queda solo lo nuevo');
select throws_ok($$ select set_item_usage((select v from ids where k = 'cera'),
                     jsonb_build_array(jsonb_build_object('serviceId', (select corte from ctx), 'servicesPerUnit', 0))) $$,
  'P0004', 'INVALID_YIELD', 'REQ-073.1 el rendimiento es un entero ≥ 1');
select throws_ok($$ select set_item_usage((select v from ids where k = 'agua'),
                     jsonb_build_array(jsonb_build_object('serviceId', (select corte from ctx), 'servicesPerUnit', 10))) $$,
  'P0004', 'INVALID_ITEM', 'REQ-073.1 solo los insumos de uso interno se gastan en servicios');
select throws_ok($$ select set_item_usage((select v from ids where k = 'cera'),
                     jsonb_build_array(jsonb_build_object('serviceId', (select v from ids where k = 'corte_otra'), 'servicesPerUnit', 10))) $$,
  '42501', 'FORBIDDEN', 'REQ-073.1 no se usa un servicio de otro negocio');

-- -------------------------------------------------------- solo el dueño ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select pg_temp.item('{"name": "Del barbero"}') $$, '42501', 'FORBIDDEN',
  'REQ-071.6 el barbero no cambia el catálogo');
select throws_ok($$ select set_item_usage((select v from ids where k = 'cera'), '[]') $$, '42501', 'FORBIDDEN',
  'REQ-071.6 el barbero no cambia los servicios de un insumo');
select is((select count(*)::int from inventory_items), 0, 'REQ-074.4 el barbero no ve el catálogo ni sus precios');
select is((select count(*)::int from inventory_locations), 0, 'REQ-074.4 ni los sitios');
select auth.test_logout();

select ok(not has_table_privilege('authenticated', 'inventory_items', 'insert')
          and not has_table_privilege('authenticated', 'inventory_items', 'update')
          and not has_table_privilege('authenticated', 'stock_movements', 'insert')
          and not has_table_privilege('authenticated', 'inventory_usage', 'delete'),
  'REQ-071.6 los cambios pasan solo por funciones que validan al dueño');
select ok(not has_table_privilege('anon', 'inventory_items', 'select')
          and not has_table_privilege('anon', 'inventory_locations', 'select')
          and not has_table_privilege('anon', 'inventory_usage', 'select')
          and not has_table_privilege('anon', 'stock_movements', 'select')
          and not has_table_privilege('anon', 'stock_counts', 'select')
          and not has_table_privilege('anon', 'stock_count_lines', 'select'),
  'REQ-074.5 sin cuenta no se lee nada de inventario');
select ok(not has_function_privilege('anon', 'save_inventory_item(uuid, jsonb)', 'execute')
          and not has_function_privilege('anon', 'set_item_usage(uuid, jsonb)', 'execute')
          and not has_function_privilege('anon', 'inventory_stock(uuid)', 'execute')
          and not has_function_privilege('anon', 'station_allowance(uuid)', 'execute'),
  'REQ-074.5 sin cuenta no se llama ninguna función de inventario');

select * from finish();
rollback;
