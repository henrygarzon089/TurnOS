-- T-121 · Inventario: entradas, transferencias y reposición (REQ-071, REQ-072.5, ADR-039,
-- design.md §18.1 y §18.3). Caja (0065) y conteos (0066) van aparte.
begin;
select plan(46);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Mateo') as mateo,
       (select id from products p where p.business_id = z.id and p.name = 'Agua') as agua_p
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
insert into ids select 'bodega', id from inventory_locations where business_id = (select biz from ctx) and kind = 'warehouse';
insert into ids select 'vitrina', id from inventory_locations where business_id = (select biz from ctx) and kind = 'shelf';
insert into ids select 'est_juan', id from inventory_locations where barber_id = (select juan from ctx);
insert into ids select 'est_pedro', id from inventory_locations where barber_id = (select pedro from ctx);
insert into ids select 'est_mateo', id from inventory_locations where barber_id = (select mateo from ctx);

insert into businesses (name, slug) values ('Otra Barbería', 'otra-0064');
insert into barbers (business_id, display_name, commission_pct)
select id, 'Barbero otra', 50 from businesses where slug = 'otra-0064';
insert into ids select 'barbero_otra', id from barbers where display_name = 'Barbero otra';

-- stock de un ítem en un sitio, leído como superusuario
create function pg_temp.stock(p_loc text, p_item text) returns int language sql as $$
  select coalesce(sum(case when to_location_id = (select v from ids where k = p_loc) then qty else -qty end), 0)::int
  from stock_movements
  where item_id = (select v from ids where k = p_item)
    and (select v from ids where k = p_loc) in (from_location_id, to_location_id)
$$;
create function pg_temp.mov(p_item text, p_from text, p_to text, p_qty int) returns uuid language sql as $$
  select transfer_stock((select v from ids where k = p_item), (select v from ids where k = p_from),
                        (select v from ids where k = p_to), p_qty)
$$;

select auth.test_login((select owner_u from ctx));
insert into ids select 'cera', save_inventory_item((select biz from ctx), '{"name": "Cera mate", "group": "finishing",
  "use": "internal", "presentation": "Frasco 150 g", "unitLabel": "frasco", "unitCost": 18000, "minQty": 3,
  "maxQty": 10, "stationQty": 1}');
insert into ids select 'agua', save_inventory_item((select biz from ctx), jsonb_build_object('name', 'Agua 600 ml',
  'group', 'for_sale', 'use', 'sale', 'presentation', 'Botella 600 ml', 'unitLabel', 'botella', 'unitCost', 1200,
  'minQty', 12, 'maxQty', 48, 'shelfMin', 6, 'productId', (select agua_p from ctx)));

-- ------------------------------------------------------ entrada a bodega ----
select lives_ok($$ select register_stock_purchase((select v from ids where k = 'cera'), 10, 19000) $$,
  'REQ-071.2 el dueño registra una entrada a bodega');
select is(pg_temp.stock('bodega', 'cera'), 10, 'REQ-071.2 la entrada suma a la bodega');
select is((select unit_cost from inventory_items where id = (select v from ids where k = 'cera')), 19000,
  'REQ-071.2 y actualiza el precio por unidad del ítem');
select is((select kind::text || ' · ' || qty || ' · ' || unit_cost || ' · ' || (from_location_id is null)::text
                  || ' · ' || (to_location_id = (select v from ids where k = 'bodega'))::text
                  || ' · ' || (created_by = (select owner_u from ctx))::text
           from stock_movements where item_id = (select v from ids where k = 'cera')),
  'purchase · 10 · 19000 · true · true · true',
  'REQ-071.1 el movimiento guarda quién, el ítem, la cantidad, el origen y el destino');
select ok((select created_at is not null from stock_movements where item_id = (select v from ids where k = 'cera')),
  'REQ-071.1 y cuándo');
select throws_ok($$ select register_stock_purchase((select v from ids where k = 'cera'), 0, 19000) $$,
  'P0004', 'INVALID_QTY', 'REQ-071.2 la cantidad es un entero mayor que 0');
select throws_ok($$ select register_stock_purchase((select v from ids where k = 'cera'), 1, -1) $$,
  'P0004', 'INVALID_QTY', 'REQ-071.2 el precio pagado no es negativo');
select lives_ok($$ select register_stock_purchase((select v from ids where k = 'agua'), 24, 1100) $$,
  'REQ-071.2 entrada de un producto para la venta');

-- --------------------------------------------------------- transferencias ----
select lives_ok($$ select pg_temp.mov('agua', 'bodega', 'vitrina', 10) $$, 'REQ-071.3 de bodega a vitrina');
select is(pg_temp.stock('bodega', 'agua') || ' / ' || pg_temp.stock('vitrina', 'agua'), '14 / 10',
  'REQ-071.3 sale de la bodega y entra a la vitrina');
select lives_ok($$ select pg_temp.mov('agua', 'vitrina', 'bodega', 2) $$, 'REQ-071.3 y de vitrina a bodega');
select is(pg_temp.stock('vitrina', 'agua'), 8, 'REQ-071.3 la vitrina baja');
select lives_ok($$ select pg_temp.mov('cera', 'bodega', 'est_juan', 1) $$,
  'REQ-071.3 de bodega a una estación hasta completar la dotación');
select is(pg_temp.stock('est_juan', 'cera'), 1, 'REQ-071.3 la estación queda con su dotación');
select throws_ok($$ select pg_temp.mov('cera', 'bodega', 'est_juan', 1) $$, 'P0004', 'OVER_ALLOWANCE',
  'REQ-071.5 no se pasa de la dotación de la estación');
select throws_ok($$ select pg_temp.mov('cera', 'bodega', 'est_pedro', 2) $$, 'P0004', 'OVER_ALLOWANCE',
  'REQ-071.5 ni de una vez');
select throws_ok($$ select pg_temp.mov('agua', 'bodega', 'vitrina', 20) $$, 'P0004', 'INSUFFICIENT_STOCK',
  'REQ-071.5 no se transfiere más de lo que hay en el origen');
select throws_ok($$ select pg_temp.mov('cera', 'bodega', 'vitrina', 1) $$, 'P0004', 'INVALID_TRANSFER',
  'REQ-071.3 un insumo de uso interno no va a la vitrina');
select throws_ok($$ select pg_temp.mov('agua', 'bodega', 'est_juan', 1) $$, 'P0004', 'INVALID_TRANSFER',
  'REQ-071.3 un producto para la venta no va a una estación');
select throws_ok($$ select pg_temp.mov('cera', 'est_juan', 'est_pedro', 1) $$, 'P0004', 'INVALID_TRANSFER',
  'REQ-071.3 no se pasa de una estación a otra');
select throws_ok($$ select pg_temp.mov('cera', 'bodega', 'bodega', 1) $$, 'P0004', 'INVALID_TRANSFER',
  'REQ-071.3 origen y destino son distintos');
select throws_ok($$ select pg_temp.mov('cera', 'bodega', 'est_juan', 0) $$, 'P0004', 'INVALID_QTY',
  'REQ-071.3 la cantidad es mayor que 0');
select lives_ok($$ select pg_temp.mov('cera', 'bodega', 'est_pedro', 1) $$, 'REQ-071.3 dotación de Pedro');
select lives_ok($$ select pg_temp.mov('cera', 'est_pedro', 'bodega', 1) $$, 'REQ-071.3 de una estación a la bodega');
select is(pg_temp.stock('est_pedro', 'cera'), 0, 'REQ-071.3 la estación queda vacía');

-- -------------------------------------------- reposición con envase vacío ----
select throws_ok($$ select refill_station((select juan from ctx), (select v from ids where k = 'cera'), 1, false) $$,
  'P0004', 'EMPTY_REQUIRED', 'REQ-071.4 sin envase vacío no hay reposición');
select lives_ok($$ select refill_station((select juan from ctx), (select v from ids where k = 'cera'), 1, true) $$,
  'REQ-071.4 con el envase vacío se repone');
select is(pg_temp.stock('est_juan', 'cera'), 1, 'REQ-071.4 la estación sigue con su dotación: sale el vacío y entra el lleno');
select is(pg_temp.stock('bodega', 'cera'), 8, 'REQ-071.4 lo lleno sale de la bodega (10 − 1 − 1 + 1 − 1)');
select is((select string_agg(kind::text || ':' || qty, ',' order by kind) from stock_movements
           where item_id = (select v from ids where k = 'cera') and kind in ('empty', 'refill')),
  'empty:1,refill:1', 'REQ-071.4 queda el consumo del vacío y la transferencia del lleno, por la misma cantidad');
select ok((select from_location_id = (select v from ids where k = 'est_juan') and to_location_id is null
           from stock_movements where item_id = (select v from ids where k = 'cera') and kind = 'empty'),
  'REQ-071.4 el vacío sale de la estación como consumo');
select throws_ok($$ select refill_station((select juan from ctx), (select v from ids where k = 'cera'), 2, true) $$,
  'P0004', 'INSUFFICIENT_STOCK', 'REQ-071.5 no se entregan más vacíos de los que tiene la estación');
select throws_ok($$ select refill_station((select pedro from ctx), (select v from ids where k = 'cera'), 1, true) $$,
  'P0004', 'INSUFFICIENT_STOCK', 'REQ-071.5 una estación vacía se completa con una transferencia, no con reposición');
select throws_ok($$ select refill_station((select v from ids where k = 'barbero_otra'), (select v from ids where k = 'cera'), 1, true) $$,
  '42501', 'FORBIDDEN', 'REQ-071.6 no se repone a un barbero de otro negocio');

-- ------------------------------------------------------ estación cerrada ----
select auth.test_logout();
update barbers set is_active = false where id = (select mateo from ctx);
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select pg_temp.mov('cera', 'bodega', 'est_mateo', 1) $$, 'P0004', 'STATION_CLOSED',
  'REQ-071.5 a la estación de un barbero que se fue no se le entrega nada');
select throws_ok($$ select refill_station((select mateo from ctx), (select v from ids where k = 'cera'), 1, true) $$,
  'P0004', 'STATION_CLOSED', 'REQ-071.5 ni se le repone');

-- ------------------------------------------------------------- resumen ----
select is((select (x ->> 'shelf')::int from jsonb_array_elements(inventory_overview((select biz from ctx)) -> 'items') x
           where x ->> 'id' = (select v::text from ids where k = 'agua')),
  8, 'REQ-071.1 el resumen muestra el stock de la vitrina');
select ok((select (x -> 'shelfToFill') = 'null'::jsonb from jsonb_array_elements(inventory_overview((select biz from ctx)) -> 'items') x
           where x ->> 'id' = (select v::text from ids where k = 'agua')),
  'REQ-072.5 con la vitrina por encima del mínimo no pide surtir');
select lives_ok($$ select pg_temp.mov('agua', 'vitrina', 'bodega', 3) $$, 'REQ-072.5 la vitrina baja a 5');
select is((select (x ->> 'shelfToFill')::int from jsonb_array_elements(inventory_overview((select biz from ctx)) -> 'items') x
           where x ->> 'id' = (select v::text from ids where k = 'agua')),
  1, 'REQ-072.5 vitrina en el mínimo o por debajo → "Surtir vitrina" con lo que falta para el mínimo');
select is((select string_agg(x ->> 'barberName', ',') from jsonb_array_elements(inventory_overview((select biz from ctx)) -> 'closingStations') x),
  'Mateo', 'REQ-073.7 el resumen muestra las estaciones por cerrar');

-- --------------------------------------------------------- solo el dueño ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select register_stock_purchase((select v from ids where k = 'cera'), 1, 1) $$, '42501', 'FORBIDDEN',
  'REQ-071.6 el barbero no registra entradas');
select throws_ok($$ select refill_station((select juan from ctx), (select v from ids where k = 'cera'), 1, true) $$,
  '42501', 'FORBIDDEN', 'REQ-071.6 ni reposiciones, aunque sean suyas');
select throws_ok($$ select inventory_overview((select biz from ctx)) $$, '42501', 'FORBIDDEN',
  'REQ-074.4 el barbero no ve el resumen de inventario');
select auth.test_logout();

-- ------------------------------------------------------------ inmutable ----
select throws_ok($$ update stock_movements set qty = 99 where item_id = (select v from ids where k = 'cera') $$,
  'P0004', 'STOCK_IMMUTABLE', 'REQ-071.1 un movimiento no se edita');
select throws_ok($$ delete from stock_movements where item_id = (select v from ids where k = 'cera') $$,
  'P0004', 'STOCK_IMMUTABLE', 'REQ-071.1 ni se borra');

select * from finish();
rollback;
