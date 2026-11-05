-- T-111 / T-112 · register_sale con la comisión de productos y la compra de un barbero (REQ-065.5, REQ-066,
-- REQ-067, REQ-068, REQ-069.1; ADR-038) · design.md §17.3–§17.4, ejemplos M, N, O, P y Q.
begin;
select plan(30);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from products p where p.business_id = z.id and p.name = 'Tinto') as tinto,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Mateo') as mateo,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update barbers set commission_pct = 60 where id = (select juan from ctx);
update services set price = 25000 where id = (select corte from ctx);
update businesses set product_commission_pct = 10, staff_discount_pct = 20 where id = (select biz from ctx);
update products set commissionable = false where business_id = (select biz from ctx);

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
with x as (
  insert into products (business_id, name, price, sort_order, commissionable, category) values
    ((select biz from ctx), 'Cera', 35000, 20, true, 'Vitrina'),
    ((select biz from ctx), 'Aceite de barba', 42500, 21, true, 'Vitrina'),
    ((select biz from ctx), 'Peinilla', 4005, 22, true, null)
  returning name, id)
insert into ids select name, id from x;

create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
create function pg_temp.sale(p_k text) returns sales language sql security definer as $$
  select * from sales where id = pg_temp.id(p_k)
$$;
create function pg_temp.p(p_name text, p_qty int default 1) returns jsonb language sql as $$
  select jsonb_build_object('kind', 'product', 'ref_id', pg_temp.id(p_name), 'qty', p_qty)
$$;
create function pg_temp.cash(p_amount int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', p_amount))
$$;
create function pg_temp.corte() returns jsonb language sql as $$
  select jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1)
$$;

-- ------------------------------------------ ejemplo M: corte + vitrina ----
select auth.test_login((select juan_u from ctx));
select lives_ok($$ insert into ids select 'M', (register_sale((select biz from ctx), null, null,
                     jsonb_build_array(pg_temp.corte(), pg_temp.p('Cera'),
                       jsonb_build_object('kind', 'product', 'ref_id', (select gaseosa from ctx), 'qty', 1)),
                     pg_temp.cash(64000))).id $$,
  'REQ-066.4 el barbero vende productos y quedan a su nombre sin decir quién vendió');
select is((select barber_id from pg_temp.sale('M')), (select juan from ctx),
  'REQ-066.4 la venta del barbero queda a su nombre');
select is((select services_total || ' · ' || products_total || ' · ' || total from pg_temp.sale('M')),
  '25000 · 39000 · 64000', 'REQ-067.5 el cliente paga lo mismo: la comisión de productos no se suma al total');
select is((select commission_amount || ' · ' || business_amount from pg_temp.sale('M')),
  '15000 · 10000', 'REQ-067.4 la comisión de servicios no cambia con los productos');
select is((select product_commission_pct || ' · ' || product_commission_base || ' · ' || product_commission_amount
           from pg_temp.sale('M')),
  '10 · 35000 · 3500', 'REQ-067.1 la cera (marcada) deja 10 % y la gaseosa (sin marcar) nada');
select is((select string_agg(name || ':' || commissionable, ', ' order by name) from sale_items
           where sale_id = pg_temp.id('M') and kind = 'product'),
  'Cera:true, Gaseosa:false', 'REQ-067.2 cada línea de producto guarda si dio comisión');
select is((select (ref_id = pg_temp.id('Cera'))::text || ' · ' || qty from sale_items
           where sale_id = pg_temp.id('M') and name = 'Cera'),
  'true · 1', 'REQ-066.6 la línea de producto guarda el producto y la cantidad');
select throws_ok($$ select register_sale((select biz from ctx), null, (select pedro from ctx),
                      jsonb_build_array(pg_temp.p('Cera')), pg_temp.cash(35000)) $$,
  '42501', 'FORBIDDEN', 'REQ-066.4 el barbero no registra una venta a nombre de otro');
select throws_ok($$ select register_sale((select biz from ctx), null, null,
                      jsonb_build_array(jsonb_build_object('kind', 'product', 'ref_id', (select tinto from ctx), 'qty', 1)),
                      pg_temp.cash(0)) $$,
  'P0002', 'PRODUCT_NOT_FOUND', 'REQ-066.1 un producto de cortesía no se vende en la vitrina');

-- --------------------------------- ejemplo N: el dueño vende para Pedro ----
select auth.test_login((select owner_u from ctx));
insert into ids select 'N', (register_sale((select biz from ctx), null, (select pedro from ctx),
  jsonb_build_array(pg_temp.p('Cera'), pg_temp.p('Aceite de barba')), pg_temp.cash(77500))).id;
select is((select barber_id = (select pedro from ctx) from pg_temp.sale('N')), true,
  'REQ-066.3 el dueño deja la venta a nombre del barbero que escogió');
select is((select commission_amount || ' · ' || product_commission_base || ' · ' || product_commission_amount
           from pg_temp.sale('N')),
  '0 · 77500 · 7750', 'REQ-067.1 sin servicios, el barbero gana solo la comisión de productos');

-- ------------------------------------------- ejemplo O: "Nadie (el negocio)" ----
insert into ids select 'O', (register_sale((select biz from ctx), null, null,
  jsonb_build_array(pg_temp.p('Cera'), pg_temp.p('Aceite de barba')), pg_temp.cash(77500))).id;
select is((select coalesce(barber_id::text, 'nadie') || ' · ' || product_commission_amount || ' · ' || total
           from pg_temp.sale('O')),
  'nadie · 0 · 77500', 'REQ-067.3 "Nadie (el negocio)" no deja comisión de productos');
select is((select bool_or(commissionable) from sale_items where sale_id = pg_temp.id('O')), false,
  'REQ-067.3 sin barbero ninguna línea dio comisión');

-- --------------------------------------------- ejemplo Q: un redondeo ----
insert into ids select 'Q', (register_sale((select biz from ctx), null, (select pedro from ctx),
  jsonb_build_array(pg_temp.p('Peinilla', 3)), pg_temp.cash(12015))).id;
select is((select product_commission_amount from pg_temp.sale('Q')), 1202,
  'REQ-067.1 un solo redondeo por venta: 12.015 × 10 % = 1.201,5 → 1.202 (no 3 × 401)');

-- ------------------------- descuento de servicio y tarjeta de regalo ----
select lives_ok($$ insert into ids select 'G', (register_sale((select biz from ctx), null, (select juan from ctx),
                     jsonb_build_array(pg_temp.corte() || '{"discount": 5000, "discount_reason": "Cliente frecuente"}',
                                       pg_temp.p('Cera')),
                     jsonb_build_array(jsonb_build_object('method', 'gift_card', 'amount', 30000,
                                         'code', sell_gift_card((select biz from ctx), 30000, '+573209993001', 'Ana',
                                                   null, '[{"method":"cash","amount":30000}]') ->> 'code'),
                                       jsonb_build_object('method', 'nequi', 'amount', 25000)))).id $$,
  'REQ-067.4 se cobra con descuento de servicio y tarjeta de regalo');
select is((select commission_base || ' · ' || product_commission_amount from pg_temp.sale('G')),
  '20000 · 3500', 'REQ-067.4 el descuento y el medio de pago no cambian la comisión de productos');

-- -------------------------------------- cambios después de la venta ----
update businesses set product_commission_pct = 20 where id = (select biz from ctx);
update products set commissionable = false where id = pg_temp.id('Cera');
select is((select product_commission_pct || ' · ' || product_commission_amount from pg_temp.sale('M')),
  '10 · 3500', 'REQ-065.5 cambiar la casilla o el % no cambia las ventas ya registradas');
select is((select commissionable from sale_items where sale_id = pg_temp.id('M') and name = 'Cera'), true,
  'REQ-065.5 la línea vieja sigue diciendo que dio comisión');
insert into ids select 'M2', (register_sale((select biz from ctx), null, (select juan from ctx),
  jsonb_build_array(pg_temp.p('Cera'), pg_temp.p('Aceite de barba')), pg_temp.cash(77500))).id;
select is((select product_commission_pct || ' · ' || product_commission_base || ' · ' || product_commission_amount
           from pg_temp.sale('M2')),
  '20 · 42500 · 8500', 'REQ-065.4 las ventas siguientes usan el % y la casilla nuevos');
update businesses set product_commission_pct = 10 where id = (select biz from ctx);
update products set commissionable = true where id = pg_temp.id('Cera');

-- ------------------------------------------------------------ anular ----
select lives_ok($$ select void_sale(pg_temp.id('M2'), 'Prueba') $$, 'REQ-069.1 se anula una venta con productos');
select is((select coalesce(sum(product_commission_amount), 0)::int from sales
           where barber_id = (select juan from ctx) and status = 'active' and id in (select v from ids)),
  7000, 'REQ-069.1 la comisión de productos de la venta anulada sale de los totales (quedan M y G)');

-- ------------------------------------ ejemplo P: compra de un barbero ----
insert into ids select 'P', (register_sale((select biz from ctx), null, null, jsonb_build_array(pg_temp.p('Cera')),
  pg_temp.cash(28000), null, (select juan from ctx))).id;
select is((select coalesce(barber_id::text, 'sin vendedor') || ' · ' || (staff_buyer_id = (select juan from ctx))::text
                  || ' · ' || products_total || ' · ' || staff_discount_total || ' · ' || total
           from pg_temp.sale('P')),
  'sin vendedor · true · 28000 · 7000 · 28000', 'REQ-068.3 la compra lleva el 20 % de descuento por línea');
select is((select commission_amount + product_commission_amount from pg_temp.sale('P')), 0,
  'REQ-068.4 la compra de un barbero no da comisión a nadie');
select is((select discount || ' · ' || line_total || ' · ' || discount_reason || ' · ' || commissionable
           from sale_items where sale_id = pg_temp.id('P')),
  '7000 · 28000 · Compra de barbero · false', 'REQ-068.3 la línea dice el descuento y que no dio comisión');
select throws_ok($$ select register_sale((select biz from ctx), null, null, jsonb_build_array(pg_temp.p('Cera')),
                      pg_temp.cash(35000), null, (select juan from ctx)) $$,
  'P0004', 'PAYMENTS_MISMATCH', 'REQ-068.4 se paga en ese momento lo que vale con descuento');
select throws_ok($$ select register_sale((select biz from ctx), null, null,
                      jsonb_build_array(pg_temp.corte()), pg_temp.cash(25000), null, (select juan from ctx)) $$,
  'P0004', 'INVALID_STAFF_PURCHASE', 'REQ-068.3 la compra de un barbero es solo de productos');
select throws_ok($$ select register_sale((select biz from ctx), null, (select pedro from ctx),
                      jsonb_build_array(pg_temp.p('Cera')), pg_temp.cash(28000), null, (select juan from ctx)) $$,
  'P0004', 'INVALID_STAFF_PURCHASE', 'REQ-068.2 en la compra se escoge quién compra, no quién vendió');
update barbers set is_active = false where id = (select mateo from ctx);
select throws_ok($$ select register_sale((select biz from ctx), null, null, jsonb_build_array(pg_temp.p('Cera')),
                      pg_temp.cash(28000), null, (select mateo from ctx)) $$,
  'P0002', 'BARBER_NOT_FOUND', 'REQ-068.2 solo compra un barbero activo del negocio');
update businesses set staff_discount_pct = 0 where id = (select biz from ctx);
select throws_ok($$ select register_sale((select biz from ctx), null, null, jsonb_build_array(pg_temp.p('Cera')),
                      pg_temp.cash(35000), null, (select juan from ctx)) $$,
  'P0004', 'STAFF_DISCOUNT_OFF', 'REQ-068.2 con 0 % no hay compra de un barbero');
update businesses set staff_discount_pct = 20 where id = (select biz from ctx);

select auth.test_login((select juan_u from ctx));
select throws_ok($$ select register_sale((select biz from ctx), null, null, jsonb_build_array(pg_temp.p('Cera')),
                      pg_temp.cash(28000), null, (select juan from ctx)) $$,
  '42501', 'FORBIDDEN', 'REQ-068.2 solo el dueño registra una compra de un barbero');

select auth.test_logout();
select * from finish();
rollback;
