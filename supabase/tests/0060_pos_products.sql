-- T-110 · Punto de venta: datos (REQ-065, REQ-068.1, checks de REQ-067/068; ADR-038, design.md §17.1–§17.2).
-- register_sale con la comisión de productos es T-111; la compra de un barbero, T-112.
begin;
select plan(24);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- ----------------------------------------------------------- negocio ----
select col_default_is('businesses', 'product_commission_pct', '10',
  'REQ-065.1 el % de comisión por productos arranca en 10');
select is((select product_commission_pct from businesses where id = (select biz from ctx)), 10,
  'REQ-065.1 los negocios que ya existen quedan con 10 %');
select throws_ok($$ update businesses set product_commission_pct = 101 where id = (select biz from ctx) $$,
  '23514', null, 'REQ-065.1 el % de productos es un entero entre 0 y 100');
select col_default_is('businesses', 'staff_discount_pct', '20',
  'REQ-068.1 el % de descuento de empleado arranca en 20');
select throws_ok($$ update businesses set staff_discount_pct = -1 where id = (select biz from ctx) $$,
  '23514', null, 'REQ-068.1 el % de descuento de empleado es un entero entre 0 y 100');

-- --------------------------------------------------------- historial ----
select auth.test_login((select owner_u from ctx));
update businesses set product_commission_pct = 15 where id = (select biz from ctx);
update businesses set staff_discount_pct = 0 where id = (select biz from ctx);
update businesses set name = name where id = (select biz from ctx);
select is((select count(*)::int from business_pct_changes where business_id = (select biz from ctx)), 2,
  'REQ-065.4 cada cambio de % queda en el historial (y nada más)');
select is((select old_pct || '→' || new_pct || ' ' || (changed_by = (select owner_u from ctx))::text
           from business_pct_changes where kind = 'product_commission'),
  '10→15 true', 'REQ-065.4 el historial guarda valor anterior, nuevo y quién');
select is((select old_pct || '→' || new_pct from business_pct_changes where kind = 'staff_discount'),
  '20→0', 'REQ-065.4 el historial del descuento de empleado va aparte');
select throws_ok($$ insert into business_pct_changes (business_id, kind, new_pct) values ((select biz from ctx), 'staff_discount', 5) $$,
  '42501', null, 'REQ-065.4 el historial solo lo escribe el sistema');

select auth.test_login((select juan_u from ctx));
select is((select count(*)::int from business_pct_changes), 0,
  'REQ-065.4 el barbero no ve el historial de los % del negocio');
select is((select product_commission_pct from businesses where id = (select biz from ctx)), 15,
  'REQ-067.1 el barbero lee el % vigente del negocio');
select auth.test_logout();

-- ---------------------------------------------------------- productos ----
select col_default_is('products', 'commissionable', 'false',
  'REQ-065.2 "Da comisión al que vende" viene apagada');
select is((select count(*)::int from products where business_id = (select biz from ctx) and commissionable), 0,
  'REQ-065.2 los productos que ya existen no dan comisión hasta marcarlos');
select lives_ok($$ update products set category = 'Bebidas', commissionable = true
                   where business_id = (select biz from ctx) and sort_order = (select min(sort_order) from products) $$,
  'REQ-065.3 un producto puede tener categoría');
select throws_ok($$ update products set category = '  ' where business_id = (select biz from ctx) $$,
  '23514', null, 'REQ-065.3 la categoría no puede quedar en blanco');
select throws_ok($$ update products set category = repeat('x', 31) where business_id = (select biz from ctx) $$,
  '23514', null, 'REQ-065.3 la categoría tiene a lo sumo 30 caracteres');
select lives_ok($$ update products set category = null where business_id = (select biz from ctx) $$,
  'REQ-065.3 sin categoría el producto queda solo en "Todos"');

-- -------------------------------------------------------------- ventas ----
create temp table ids (k text primary key, v uuid);
grant all on ids to public;
with x as (
  insert into sales (business_id, business_day, services_total, products_total, total)
  values ((select biz from ctx), (select today from ctx), 0, 4000, 4000) returning id)
insert into ids select 'S', id from x;

select col_default_is('sale_items', 'commissionable', 'false',
  'REQ-067.2 las líneas de siempre no dieron comisión');
select throws_ok($$ insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, line_total, commissionable)
                   values ((select biz from ctx), (select v from ids where k = 'S'), 'service',
                           gen_random_uuid(), 'Corte', 1, 25000, 25000, true) $$,
  '23514', null, 'REQ-067.2 solo una línea de producto puede marcar que dio comisión');
select throws_ok($$ insert into sales (business_id, business_day, services_total, products_total, total, product_commission_amount)
                   values ((select biz from ctx), (select today from ctx), 0, 35000, 35000, 3500) $$,
  '23514', null, 'REQ-067.3 una venta sin barbero no tiene comisión de productos');
select throws_ok($$ insert into sales (business_id, business_day, barber_id, staff_buyer_id, services_total, products_total, total)
                   values ((select biz from ctx), (select today from ctx), (select juan from ctx), (select juan from ctx), 0, 28000, 28000) $$,
  '23514', null, 'REQ-068.4 la compra de un barbero no queda a nombre de un barbero vendedor');
select throws_ok($$ insert into sales (business_id, business_day, staff_buyer_id, services_total, products_total, total)
                   values ((select biz from ctx), (select today from ctx), (select juan from ctx), 25000, 0, 25000) $$,
  '23514', null, 'REQ-068.3 la compra de un barbero es solo de productos');
select throws_ok($$ insert into sales (business_id, business_day, services_total, products_total, total, staff_discount_total)
                   values ((select biz from ctx), (select today from ctx), 0, 28000, 28000, 7000) $$,
  '23514', null, 'REQ-068.3 el descuento de empleado solo va en una compra de un barbero');

-- ------------------------------------------------------------ permisos ----
select ok(not has_table_privilege('anon', 'business_pct_changes', 'select'),
  'REQ-065.4 anon no ve el historial de los %');

select * from finish();
rollback;
