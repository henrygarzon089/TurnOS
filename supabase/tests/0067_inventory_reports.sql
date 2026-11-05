-- T-124 · Inventario: orden de compra, costo por servicio y "Mi estación" (REQ-074.1, REQ-074.3,
-- REQ-074.4, ADR-039, design.md §18.3 y §18.5, ejemplos O y P).
begin;
select plan(24);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from products p where p.business_id = z.id and p.name = 'Agua') as agua_p,
       (select id from services s where s.business_id = z.id order by sort_order offset 1 limit 1) as barba
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
insert into ids select 'bodega', id from inventory_locations where business_id = (select biz from ctx) and kind = 'warehouse';
insert into ids select 'vitrina', id from inventory_locations where business_id = (select biz from ctx) and kind = 'shelf';
insert into ids select 'est_juan', id from inventory_locations where barber_id = (select juan from ctx);
insert into ids select 'est_pedro', id from inventory_locations where barber_id = (select pedro from ctx);

insert into businesses (name, slug) values ('Otra Barbería', 'otra-0067');

create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
create function pg_temp.item(p jsonb) returns uuid language sql as $$
  select save_inventory_item((select biz from ctx), jsonb_build_object('group', 'finishing', 'use', 'internal',
    'presentation', 'Unidad', 'unitLabel', 'unidad', 'minQty', 0, 'maxQty', 0, 'stationQty', 0) || p)
$$;
create function pg_temp.order_line(p_item text) returns text language sql as $$
  select coalesce(supplier, '—') || ' · ' || on_hand || ' · ' || qty || ' · ' || amount
  from purchase_order((select biz from ctx)) where item_id = pg_temp.id(p_item)
$$;

select auth.test_login((select owner_u from ctx));

-- --------------------------------------------- ejemplo P: orden de compra ----
insert into ids values
  ('cera', pg_temp.item('{"name": "Cera mate", "unitCost": 18000, "minQty": 3, "maxQty": 10, "stationQty": 1, "supplier": "Distri Sabaneta"}')),
  ('agua', pg_temp.item(jsonb_build_object('name', 'Agua 600 ml', 'group', 'for_sale', 'use', 'sale', 'unitCost', 1200,
                                           'minQty', 12, 'maxQty', 48, 'shelfMin', 6, 'productId', (select agua_p from ctx)))),
  ('alcohol', pg_temp.item('{"name": "Alcohol galón", "unitCost": 30000, "minQty": 1, "maxQty": 3}')),
  ('viejo', pg_temp.item('{"name": "Talco viejo", "unitCost": 5000, "minQty": 2, "maxQty": 5, "isActive": false}')),
  ('libre', pg_temp.item('{"name": "Sin máximo", "unitCost": 1000}'));
select register_stock_purchase(pg_temp.id('cera'), 3, 18000);
select transfer_stock(pg_temp.id('cera'), pg_temp.id('bodega'), pg_temp.id('est_juan'), 1);
select register_stock_purchase(pg_temp.id('agua'), 26, 1200);
select transfer_stock(pg_temp.id('agua'), pg_temp.id('bodega'), pg_temp.id('vitrina'), 6);

select is(pg_temp.order_line('cera'), 'Distri Sabaneta · 2 · 8 · 144000',
  'REQ-074.1 cera: bodega 2 + vitrina 0 ≤ 3 → pedir 10 − 2 = 8 × $ 18.000 (ejemplo P)');
select is(pg_temp.order_line('agua'), null, 'REQ-074.1 agua: 20 + 6 = 26 > 12 → no se pide');
select is(pg_temp.order_line('alcohol'), '— · 0 · 3 · 90000', 'REQ-074.1 sin stock se pide hasta el máximo');
select is(pg_temp.order_line('viejo'), null, 'REQ-070.6 un ítem desactivado no sale en la orden');
select is(pg_temp.order_line('libre'), null, 'REQ-074.1 un ítem con máximo 0 no se pide');
select is((select string_agg(name, ', ' order by ord) from (select name, row_number() over () as ord
           from purchase_order((select biz from ctx))) x),
  'Cera mate, Alcohol galón', 'REQ-074.1 agrupada por proveedor (sin proveedor al final)');
select is((select qty from purchase_order((select biz from ctx)) where item_id = pg_temp.id('cera')), 8,
  'REQ-074.1 la estación no cuenta: lo de las estaciones ya está en uso');

-- --------------------------------------------- ejemplo O: costo por servicio ----
insert into ids values
  ('guantes', pg_temp.item('{"name": "Guantes caja 50 pares", "unitCost": 30000}')),
  ('papel', pg_temp.item('{"name": "Papel cuello rollo", "unitCost": 8000}')),
  ('aceite', pg_temp.item('{"name": "Aceite barba", "unitCost": 25000}')),
  ('cuchilla', pg_temp.item('{"name": "Cuchillas paquete 10", "unitCost": 12000}'));
select set_item_usage(pg_temp.id(k), jsonb_build_array(jsonb_build_object('serviceId', (select barba from ctx),
                                                                           'servicesPerUnit', y)))
from (values ('guantes', 50), ('papel', 100), ('aceite', 50)) v (k, y);
select is((select cost || ' · ' || incomplete from service_supply_cost((select biz from ctx)) where service_id = (select barba from ctx)),
  '1180 · false', 'REQ-074.3 barba: 600 + 80 + 500 = $ 1.180 en insumos (ejemplo O)');
select set_item_usage(pg_temp.id('cuchilla'), jsonb_build_array(jsonb_build_object('serviceId', (select barba from ctx),
                                                                                     'servicesPerUnit', null)));
select is((select cost || ' · ' || incomplete from service_supply_cost((select biz from ctx)) where service_id = (select barba from ctx)),
  '1180 · true', 'REQ-074.3 con un insumo en "Midiendo" queda "Incompleto"');
select set_item_usage(pg_temp.id('papel'), jsonb_build_array(jsonb_build_object('serviceId', (select barba from ctx),
                                                                                  'servicesPerUnit', 3)));
select is((select cost from service_supply_cost((select biz from ctx)) where service_id = (select barba from ctx)),
  3767, 'REQ-074.3 redondeado al peso: 600 + 2.666,67 + 500 = 3.767');
select save_inventory_item((select biz from ctx), jsonb_build_object('id', pg_temp.id('aceite'), 'name', 'Aceite barba',
  'group', 'finishing', 'use', 'internal', 'presentation', 'Unidad', 'unitLabel', 'unidad', 'unitCost', 25000,
  'minQty', 0, 'maxQty', 0, 'isActive', false));
select is((select cost from service_supply_cost((select biz from ctx)) where service_id = (select barba from ctx)),
  3267, 'REQ-070.6 un insumo desactivado ya no suma al costo del servicio');
select is((select count(*)::int from service_supply_cost((select biz from ctx))),
          (select count(*)::int from services where business_id = (select biz from ctx) and is_active),
  'REQ-074.3 sale un costo por cada servicio activo');

-- ------------------------------------------------------ "Mi estación" ----
select save_inventory_item((select biz from ctx), jsonb_build_object('id', pg_temp.id('guantes'), 'name', 'Guantes caja 50 pares',
  'group', 'biosafety', 'use', 'internal', 'presentation', 'Caja', 'unitLabel', 'caja', 'unitCost', 30000,
  'minQty', 0, 'maxQty', 5, 'stationQty', 1));
select register_stock_purchase(pg_temp.id('guantes'), 4, 30000);
select transfer_stock(pg_temp.id('guantes'), pg_temp.id('bodega'), pg_temp.id('est_juan'), 1);
select transfer_stock(pg_temp.id('guantes'), pg_temp.id('bodega'), pg_temp.id('est_pedro'), 1);
select refill_station((select juan from ctx), pg_temp.id('guantes'), 1, true);
select auth.test_logout();
select record_stock_count(pg_temp.id('est_juan'), jsonb_build_array(
  jsonb_build_object('itemId', pg_temp.id('cera'), 'counted', 1),
  jsonb_build_object('itemId', pg_temp.id('guantes'), 'counted', 1)), now() - interval '1 day');
select record_stock_count(pg_temp.id('est_juan'), jsonb_build_array(
  jsonb_build_object('itemId', pg_temp.id('cera'), 'counted', 1),
  jsonb_build_object('itemId', pg_temp.id('guantes'), 'counted', 0)), now() + interval '1 minute');

select auth.test_login((select owner_u from ctx));
select throws_ok($$ select my_station((select biz from ctx)) $$, '42501', 'FORBIDDEN',
  'REQ-074.4 "Mi estación" es del barbero');

select auth.test_login((select juan_u from ctx));
create temp table mine as select my_station((select biz from ctx)) as v;
select is((select string_agg((x ->> 'name') || ' ' || (x ->> 'stock') || '/' || (x ->> 'allowance'), ', ' order by x ->> 'name')
           from mine, jsonb_array_elements(v -> 'items') x),
  'Cera mate 1/1, Guantes caja 50 pares 0/1', 'REQ-074.4 el barbero ve su dotación y el stock de su estación');
select is((select string_agg((x ->> 'itemName') || ' ×' || (x ->> 'qty'), ', ') from mine, jsonb_array_elements(v -> 'refills') x),
  'Guantes caja 50 pares ×1', 'REQ-074.4 sus reposiciones');
select is((select v -> 'lastCount' ->> 'kind' from mine), 'weekly', 'REQ-074.4 y el resultado de su último conteo');
select is((select (x ->> 'realUse')::int from mine, jsonb_array_elements(v -> 'lastCount' -> 'lines') x
           where x ->> 'itemId' = pg_temp.id('guantes')::text),
  2, 'REQ-074.4 con el consumo real de cada insumo (1 vacío + 1 faltante)');
select ok((select v::text not like '%unitCost%' and v::text not like '%30000%' and v::text not like '%18000%' from mine),
  'REQ-074.4 sin precios');
select ok((select v::text not like '%' || pg_temp.id('est_pedro')::text || '%'
                  and v::text not like '%' || pg_temp.id('bodega')::text || '%'
                  and v::text not like '%' || pg_temp.id('vitrina')::text || '%' from mine),
  'REQ-074.4 sin bodega, vitrina ni estaciones de otros');
select ok((select (v -> 'items')::text not like '%Agua%' from mine),
  'REQ-074.4 sin los productos de la vitrina');
select throws_ok($$ select purchase_order((select biz from ctx)) $$, '42501', 'FORBIDDEN',
  'REQ-074.4 el barbero no ve la orden de compra');
select throws_ok($$ select service_supply_cost((select biz from ctx)) $$, '42501', 'FORBIDDEN',
  'REQ-074.4 ni los costos');
select throws_ok($$ select my_station((select id from businesses where slug = 'otra-0067')) $$, '42501', 'FORBIDDEN',
  'REQ-074.4 ni la estación de otro negocio');
select auth.test_logout();

select ok(not has_function_privilege('anon', 'purchase_order(uuid)', 'execute')
          and not has_function_privilege('anon', 'service_supply_cost(uuid)', 'execute')
          and not has_function_privilege('anon', 'my_station(uuid)', 'execute'),
  'REQ-074.5 sin cuenta no se llama ningún reporte de inventario');

select * from finish();
rollback;
