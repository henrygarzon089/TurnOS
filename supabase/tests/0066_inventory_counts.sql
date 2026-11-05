-- T-123 · Inventario: conteos, alerta de consumo y rendimiento sugerido (REQ-073.2–073.7, ADR-039,
-- design.md §18.3 y §18.5, ejemplos M y N).
begin;
select plan(46);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from services s where s.business_id = z.id order by sort_order limit 1) as corte,
       (select id from services s where s.business_id = z.id order by sort_order offset 1 limit 1) as barba
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create temp table res (k text primary key, v jsonb);
grant all on res to public;
insert into ids select 'bodega', id from inventory_locations where business_id = (select biz from ctx) and kind = 'warehouse';
insert into ids select 'est_juan', id from inventory_locations where barber_id = (select juan from ctx);
insert into ids select 'est_pedro', id from inventory_locations where barber_id = (select pedro from ctx);

create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
create function pg_temp.stock(p_loc uuid, p_item uuid) returns int language sql as $$
  select coalesce(sum(case when to_location_id = p_loc then qty else -qty end), 0)::int
  from stock_movements where item_id = p_item and p_loc in (from_location_id, to_location_id)
$$;
create function pg_temp.internal(p_name text) returns uuid language sql as $$
  select save_inventory_item((select biz from ctx), jsonb_build_object('name', p_name, 'group', 'finishing',
    'use', 'internal', 'presentation', 'Unidad', 'unitLabel', 'unidad', 'unitCost', 10000, 'minQty', 1,
    'maxQty', 10, 'stationQty', 1))
$$;
create function pg_temp.line(p_item text, p_counted int, p_reason text default null) returns jsonb language sql as $$
  select jsonb_build_object('itemId', pg_temp.id(p_item), 'counted', p_counted, 'reason', p_reason)
$$;
create function pg_temp.cut(p_res text, p_item text) returns jsonb language sql as $$
  select x from res, jsonb_array_elements(v -> 'lines') x where k = p_res and x ->> 'itemId' = pg_temp.id(p_item)::text
$$;
create function pg_temp.services(p_barber uuid, p_service uuid, p_qty int) returns uuid language sql as $$
  select (register_sale((select biz from ctx), null, p_barber,
            jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', p_service, 'qty', p_qty)),
            jsonb_build_array(jsonb_build_object('method', 'cash',
              'amount', p_qty * (select price from services where id = p_service))))).id
$$;

-- ---------------------------------------------------------- preparación ----
select auth.test_login((select owner_u from ctx));
insert into ids values ('cera', pg_temp.internal('Cera mate')), ('guantes', pg_temp.internal('Guantes caja 50')),
                       ('gel', pg_temp.internal('Gel'));
select set_item_usage(pg_temp.id('cera'), jsonb_build_array(jsonb_build_object('serviceId', (select corte from ctx), 'servicesPerUnit', 40)));
select set_item_usage(pg_temp.id('guantes'), jsonb_build_array(jsonb_build_object('serviceId', (select barba from ctx), 'servicesPerUnit', 50)));
select set_item_usage(pg_temp.id('gel'), jsonb_build_array(jsonb_build_object('serviceId', (select corte from ctx), 'servicesPerUnit', null)));
select register_stock_purchase(pg_temp.id(k), 10, 10000) from unnest(array['cera', 'guantes', 'gel']) k;
select transfer_stock(pg_temp.id(k), pg_temp.id('bodega'), pg_temp.id('est_juan'), 1) from unnest(array['cera', 'guantes', 'gel']) k;
select transfer_stock(pg_temp.id('cera'), pg_temp.id('bodega'), pg_temp.id('est_pedro'), 1);

-- ------------------------------------------------ conteo inicial (Q15) ----
select throws_ok($$ select record_stock_count(pg_temp.id('est_juan'), jsonb_build_array(pg_temp.line('cera', 1))) $$,
  'P0004', 'MISSING_LINES', 'REQ-073.3 el conteo de la estación trae toda la dotación');
select auth.test_logout();
insert into res select 'ini', record_stock_count(pg_temp.id('est_juan'),
  jsonb_build_array(pg_temp.line('cera', 1), pg_temp.line('guantes', 1), pg_temp.line('gel', 1)), now() - interval '7 days');
select is((select v ->> 'kind' from res where k = 'ini'), 'initial', 'REQ-073.6 el primer conteo de un sitio es el inicial');
select ok((select (pg_temp.cut('ini', 'cera') -> 'expectedUse') = 'null'::jsonb), 'REQ-073.3 el inicial no compara consumo');

insert into res select 'bod', record_stock_count(pg_temp.id('bodega'),
  (select jsonb_agg(pg_temp.line(k, case when k = 'cera' then 7 else 9 end)) from unnest(array['cera', 'guantes', 'gel']) k),
  now() - interval '7 days');
select is((pg_temp.cut('bod', 'cera') ->> 'reason'), 'initial', 'REQ-073.6 el conteo inicial no pide motivo');
select is(pg_temp.stock(pg_temp.id('bodega'), pg_temp.id('cera')), 7, 'REQ-073.6 el stock queda igual a lo contado');

-- --------------------------------------- semana de Juan (ejemplo M) ----
select auth.test_login((select owner_u from ctx));
select refill_station((select juan from ctx), pg_temp.id(k), 1, true) from unnest(array['cera', 'guantes']) k;
insert into ids select 'v_juan', pg_temp.services((select juan from ctx), (select corte from ctx), 30);
select pg_temp.services((select juan from ctx), (select barba from ctx), 12);
insert into ids select 'anulada', pg_temp.services((select juan from ctx), (select corte from ctx), 10);
select void_sale(pg_temp.id('anulada'), 'Prueba');
select pg_temp.services((select pedro from ctx), (select corte from ctx), 5);
select auth.test_logout();

insert into res select 'M', record_stock_count(pg_temp.id('est_juan'),
  jsonb_build_array(pg_temp.line('cera', 0), pg_temp.line('guantes', 1), pg_temp.line('gel', 1)), now() + interval '1 minute');
select is((select v ->> 'kind' from res where k = 'M'), 'weekly', 'REQ-073.3 el conteo siguiente de la estación es semanal');
select ok((select (v ->> 'windowStart')::timestamptz < now() - interval '6 days' from res where k = 'M'),
  'REQ-073.3 la ventana empieza en el conteo anterior de la estación');
select is((pg_temp.cut('M', 'cera') ->> 'services')::int, 30,
  'REQ-073.2 cuenta los cortes de Juan en la caja, sin la venta anulada ni los de Pedro');
select is((pg_temp.cut('M', 'cera') ->> 'expectedUse')::numeric, 0.75, 'REQ-073.2 esperado = 30 ÷ 40');
select is((pg_temp.cut('M', 'cera') ->> 'realUse')::int, 2, 'REQ-073.3 real = 1 vacío + 1 faltante');
select ok((pg_temp.cut('M', 'cera') ->> 'alert')::boolean, 'REQ-073.4 cera: 2 > 0,825 y 1,25 ≥ 1 → alerta');
select is((pg_temp.cut('M', 'guantes') ->> 'services')::int, 12, 'REQ-073.2 las barbas gastan guantes');
select is((pg_temp.cut('M', 'guantes') ->> 'expectedUse')::numeric, 0.24, 'REQ-073.2 esperado = 12 ÷ 50');
select is((pg_temp.cut('M', 'guantes') ->> 'realUse')::int, 1, 'REQ-073.3 real = el vacío entregado');
select ok(not (pg_temp.cut('M', 'guantes') ->> 'alert')::boolean,
  'REQ-073.4 guantes: una caja abierta no es exceso (1 − 0,24 < 1)');
select ok((pg_temp.cut('M', 'gel') ->> 'measuring')::boolean and not (pg_temp.cut('M', 'gel') ->> 'alert')::boolean,
  'REQ-073.4 un insumo en "Midiendo" no genera alerta');
select is((select qty from stock_movements where kind = 'use' and item_id = pg_temp.id('cera')), 1,
  'REQ-073.3 el faltante del conteo queda como consumo');
select is(pg_temp.stock(pg_temp.id('est_juan'), pg_temp.id('cera')), 0, 'REQ-073.3 y la estación queda con lo contado');

select auth.test_login((select owner_u from ctx));
select is((select string_agg((x ->> 'barberName') || ': ' || (x ->> 'itemName'), ', ')
           from jsonb_array_elements(inventory_overview((select biz from ctx)) -> 'alerts') x),
  'Juan: Cera mate', 'REQ-073.4 el panel del dueño muestra "Revisar con Juan" solo por la cera');
select auth.test_logout();

insert into res select 'M2', record_stock_count(pg_temp.id('est_juan'),
  jsonb_build_array(pg_temp.line('cera', 0), pg_temp.line('guantes', 1), pg_temp.line('gel', 1)), now() + interval '2 minutes');
select is((pg_temp.cut('M2', 'cera') ->> 'services')::int, 0, 'REQ-073.3 lo de la ventana anterior no se vuelve a contar');
select is((pg_temp.cut('M2', 'cera') ->> 'realUse')::int, 0, 'REQ-073.3 ni su consumo');
select ok(not (pg_temp.cut('M2', 'cera') ->> 'alert')::boolean, 'REQ-073.4 sin consumo no hay alerta');

select ok(inventory_is_alert(2, 0.6, 10) and not inventory_is_alert(2, 0.6, 300) and not inventory_is_alert(11, 10, 10)
          and inventory_is_alert(12, 10, 10),
  'REQ-073.4 el porcentaje de alerta es del negocio y la regla exige una unidad entera de exceso');
select throws_ok($$ update businesses set inventory_alert_pct = 0 where id = (select biz from ctx) $$, '23514', null,
  'REQ-073.4 el porcentaje va entre 1 y 100');

-- ------------------------------------------ conteo mensual de bodega ----
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select record_stock_count(pg_temp.id('bodega'),
                     jsonb_build_array(pg_temp.line('cera', 6), pg_temp.line('guantes', 7), pg_temp.line('gel', 9))) $$,
  'P0004', 'REASON_REQUIRED', 'REQ-073.6 una diferencia en la bodega pide motivo');
select throws_ok($$ select record_stock_count(pg_temp.id('bodega'),
                     jsonb_build_array(pg_temp.line('cera', 6), pg_temp.line('guantes', 7, 'initial'), pg_temp.line('gel', 9))) $$,
  'P0004', 'REASON_REQUIRED', 'REQ-073.6 "inicial" solo vale en el primer conteo');
select throws_ok($$ select record_stock_count(pg_temp.id('bodega'), jsonb_build_array(pg_temp.line('cera', 7))) $$,
  'P0004', 'MISSING_LINES', 'REQ-073.6 el conteo de bodega trae todos los ítems activos');
select throws_ok($$ select record_stock_count(pg_temp.id('bodega'),
                     jsonb_build_array(pg_temp.line('cera', -1), pg_temp.line('guantes', 7), pg_temp.line('gel', 9))) $$,
  'P0004', 'INVALID_QTY', 'REQ-070.5 lo contado es un entero ≥ 0');
select lives_ok($$ insert into res select 'mes', record_stock_count(pg_temp.id('bodega'),
                     jsonb_build_array(pg_temp.line('cera', 6), pg_temp.line('guantes', 7, 'damaged'), pg_temp.line('gel', 9))) $$,
  'REQ-073.6 el dueño cuenta la bodega con motivo');
select is((select v ->> 'kind' from res where k = 'mes'), 'monthly', 'REQ-073.6 es el conteo mensual');
select is((select kind::text || ' · ' || qty || ' · ' || reason from stock_movements
           where item_id = pg_temp.id('guantes') and kind = 'adjustment' and count_id = ((select v from res where k = 'mes') ->> 'countId')::uuid),
  'adjustment · 1 · damaged', 'REQ-073.6 la diferencia queda como ajuste con su motivo');
select is(pg_temp.stock(pg_temp.id('bodega'), pg_temp.id('guantes')), 7, 'REQ-073.6 y la bodega queda igual a lo contado');

-- ------------------------------------------------ estación por cerrar ----
select auth.test_logout();
update barbers set is_active = false where id = (select pedro from ctx);
select auth.test_login((select owner_u from ctx));
select lives_ok($$ insert into res select 'cierre', record_stock_count(pg_temp.id('est_pedro'),
                     jsonb_build_array(pg_temp.line('cera', 1), pg_temp.line('guantes', 0), pg_temp.line('gel', 0))) $$,
  'REQ-073.7 el dueño cuenta la estación del barbero que se fue');
select is((select v ->> 'kind' from res where k = 'cierre'), 'closing', 'REQ-073.7 es el conteo de cierre');
select is(pg_temp.stock(pg_temp.id('est_pedro'), pg_temp.id('cera')) || ' / ' || pg_temp.stock(pg_temp.id('bodega'), pg_temp.id('cera')),
  '0 / 7', 'REQ-073.7 lo contado vuelve a la bodega');
select is((select status from inventory_locations where id = pg_temp.id('est_pedro')), 'closed',
  'REQ-073.7 y la estación queda cerrada');
select ok(exists (select 1 from stock_counts where location_id = pg_temp.id('est_pedro')),
  'REQ-073.7 con su historial');
select throws_ok($$ select record_stock_count(pg_temp.id('est_pedro'), '[]') $$, 'P0004', 'STATION_CLOSED',
  'REQ-073.7 una estación cerrada no se vuelve a contar');

-- -------------------------------------------- ejemplo N: rendimiento ----
-- Cuatro conteos semanales con consumo del gel en "Midiendo": 160 cortes y 4 geles → 40
select auth.test_logout();
insert into stock_counts (id, business_id, location_id, kind, counted_at)
select gen_random_uuid(), (select biz from ctx), pg_temp.id('est_juan'), 'weekly', now() + n * interval '1 hour'
from generate_series(1, 4) n;
insert into stock_count_lines (count_id, business_id, item_id, system_qty, counted_qty, difference, services,
                               expected_use, real_use, measuring)
select c.id, (select biz from ctx), pg_temp.id('gel'), 1, 1, 0, 40, 0, 1, true
from stock_counts c where c.location_id = pg_temp.id('est_juan') and c.counted_at > now() + interval '30 minutes'
order by c.counted_at limit 3;
select auth.test_login((select owner_u from ctx));
select is((select count(*)::int from inventory_yield_suggestions((select biz from ctx))), 0,
  'REQ-073.5 con 3 conteos todavía no sugiere');
select auth.test_logout();
insert into stock_count_lines (count_id, business_id, item_id, system_qty, counted_qty, difference, services,
                               expected_use, real_use, measuring)
select c.id, (select biz from ctx), pg_temp.id('gel'), 1, 1, 0, 40, 0, 1, true
from stock_counts c where c.location_id = pg_temp.id('est_juan') and c.counted_at > now() + interval '30 minutes'
order by c.counted_at desc limit 1;
select auth.test_login((select owner_u from ctx));
select is((select windows || ' · ' || services || ' · ' || real_use || ' · ' || suggested
           from inventory_yield_suggestions((select biz from ctx)) where item_id = pg_temp.id('gel')),
  '4 · 160 · 4 · 40', 'REQ-073.5 con 4 conteos sugiere 160 ÷ 4 = 40');
select throws_ok($$ select accept_yield(pg_temp.id('gel'), 0) $$, 'P0004', 'INVALID_YIELD',
  'REQ-073.5 el rendimiento aceptado es ≥ 1');
select lives_ok($$ select accept_yield(pg_temp.id('gel'), 40) $$, 'REQ-073.5 el dueño acepta el rendimiento sugerido');
select is((select services_per_unit from inventory_usage where item_id = pg_temp.id('gel')), 40,
  'REQ-073.5 queda como rendimiento del servicio que estaba "Midiendo"');
select is((select count(*)::int from inventory_yield_suggestions((select biz from ctx))), 0,
  'REQ-073.5 y deja de sugerirse');

-- --------------------------------------------------------- solo el dueño ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select record_stock_count(pg_temp.id('est_juan'), '[]') $$, '42501', 'FORBIDDEN',
  'REQ-071.6 el barbero no registra conteos, ni el de su estación');
select throws_ok($$ select accept_yield(pg_temp.id('gel'), 30) $$, '42501', 'FORBIDDEN',
  'REQ-071.6 ni cambia rendimientos');

select * from finish();
rollback;
