-- T-040 · Caja: ventas, líneas, pagos, cierres, historial de comisión
-- REQ-023.3, REQ-024.2, REQ-025.2–25.4, REQ-026.1, REQ-027.2, NFR-010 · design.md §2.2, §5
begin;
select plan(44);

-- ---------------------------------------------------------------- estructura (NFR-010) ----
select has_table('sales', 'NFR-010 tabla sales');
select has_table('sale_items', 'NFR-010 tabla sale_items');
select has_table('sale_payments', 'NFR-010 tabla sale_payments');
select has_table('cash_closures', 'NFR-010 tabla cash_closures');
select has_table('commission_changes', 'NFR-010 tabla commission_changes');
select enum_has_labels('payment_method', array['cash', 'nequi', 'transfer', 'card'], 'REQ-023.1 medios de pago: efectivo, Nequi, transferencia, tarjeta');
select enum_has_labels('sale_status', array['active', 'voided'], 'REQ-026.1 estados de venta como enum');
select enum_has_labels('sale_item_kind', array['service', 'product'], 'REQ-024.2 líneas de servicio o producto');
select enum_has_labels('closure_status', array['active', 'voided'], 'REQ-027.3 estados de cierre como enum');
select is(
  (select count(*)::int from information_schema.columns
   where table_schema = 'public'
     and (table_name, column_name) in (
       ('sales', 'services_total'), ('sales', 'products_total'), ('sales', 'discount_total'), ('sales', 'total'),
       ('sales', 'commission_base'), ('sales', 'commission_amount'), ('sales', 'business_amount'),
       ('sale_items', 'unit_price'), ('sale_items', 'discount'), ('sale_items', 'line_total'),
       ('sale_payments', 'amount'), ('cash_closures', 'cash_expected'), ('cash_closures', 'cash_counted'),
       ('cash_closures', 'difference'))
     and data_type = 'integer'), 14, 'NFR-010 todos los montos son integer (COP sin decimales)');
select is(
  (select count(*)::int from pg_class
   where relname in ('sales', 'sale_items', 'sale_payments', 'cash_closures', 'commission_changes')
     and relrowsecurity and relforcerowsecurity), 5, 'NFR-010 RLS activada y forzada en las 5 tablas de caja');
select fk_ok('loyalty_cards', 'redeemed_sale_id', 'sales', 'id', 'REQ-019.4 el canje apunta a la venta');
select ok(exists (select 1 from pg_indexes where tablename = 'sales' and indexname = 'sales_ticket_active_uniq'),
  'REQ-023.3 una venta activa por turno (0022)');

create temp table ctx as
select z.id as biz,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from products p where p.business_id = z.id order by name limit 1) as producto,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- --------------------------------------------- REQ-025.3 historial de cambios de comisión ----
select auth.test_login((select owner_u from ctx));
update barbers set commission_pct = 55 where id = (select juan from ctx);
update barbers set display_name = display_name where id = (select juan from ctx); -- sin cambio de %
select auth.test_logout();
select is((select count(*)::int from commission_changes where barber_id = (select juan from ctx)), 1,
  'REQ-025.3 cambiar el porcentaje deja un registro (y solo cuando cambia)');
select is((select new_pct from commission_changes where barber_id = (select juan from ctx)), 55, 'REQ-025.3 guarda el valor nuevo');
select is((select changed_by from commission_changes where barber_id = (select juan from ctx)), (select owner_u from ctx),
  'REQ-025.3 guarda quién lo cambió');
select ok((select old_pct is not null and at is not null from commission_changes where barber_id = (select juan from ctx)),
  'REQ-025.3 guarda el valor anterior y la fecha');

-- ------------------------------------------------- venta válida (ejemplo A de design §5.1) ----
-- Corte $ 25.000, Juan 60 %, Nequi. Los montos los calcula register_sale (T-041); aquí se insertan.
-- `set constraints all immediate` fuerza el chequeo diferido de pagos; luego se vuelve a `deferred`
-- (si no, el modo inmediato dura hasta el fin de la transacción de la prueba).
create or replace function _sale_a(p_day date default current_date) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into sales (business_id, business_day, barber_id, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  values ((select biz from ctx), p_day, (select juan from ctx), 25000, 0, 0, 25000, 60, 25000, 15000, 10000)
  returning id into v;
  insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total)
  values ((select biz from ctx), v, 'service', (select corte from ctx), 'Corte', 1, 25000, 0, 25000);
  insert into sale_payments (business_id, sale_id, method, amount) values ((select biz from ctx), v, 'nequi', 25000);
  return v;
end $$;

select lives_ok($$ select _sale_a(); set constraints all immediate; set constraints all deferred $$, 'REQ-023.3 crea una venta con líneas y pago');
create temp table s as select id from sales where business_id = (select biz from ctx) order by created_at desc limit 1;
grant select on s to public;
select is((select business_day from sales where id = (select id from s)), current_date, 'REQ-023.3 la venta lleva su día de caja');

-- Venta solo de productos, sin barbero (REQ-024.2)
select lives_ok($$
  with v as (
    insert into sales (business_id, business_day, services_total, products_total, discount_total, total,
                       commission_pct, commission_base, commission_amount, business_amount)
    values ((select biz from ctx), current_date, 0, 8000, 0, 8000, 0, 0, 0, 0) returning id)
  , i as (insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total)
          select (select biz from ctx), id, 'product', (select producto from ctx), 'Gaseosa', 2, 4000, 0, 8000 from v)
  insert into sale_payments (business_id, sale_id, method, amount) select (select biz from ctx), id, 'cash', 8000 from v
$$, 'REQ-024.2 venta de productos sin barbero');

-- Premio de fidelidad: total 0 sin pagos (ejemplo C)
select lives_ok($$
  insert into sales (business_id, business_day, barber_id, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  values ((select biz from ctx), current_date, (select juan from ctx), 0, 0, 25000, 0, 60, 25000, 15000, 10000);
  set constraints all immediate; set constraints all deferred
$$, 'REQ-025.4 venta de premio en $ 0 sin pagos (comisión sobre precio de lista)');

-- ------------------------------------------------------- pagos ≠ total → error (diferido) ----
create or replace function _bad_payment(p_amount int) returns void language plpgsql as $$
declare v uuid;
begin
  insert into sales (business_id, business_day, barber_id, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  values ((select biz from ctx), current_date, (select juan from ctx), 25000, 0, 0, 25000, 60, 25000, 15000, 10000)
  returning id into v;
  insert into sale_payments (business_id, sale_id, method, amount) values ((select biz from ctx), v, 'cash', p_amount);
  set constraints all immediate;
end $$;
select throws_ok($$ select _bad_payment(20000) $$, 'P0004', null, 'REQ-023.3 si los pagos no suman el total, la venta no se guarda');
select throws_ok($$
  insert into sales (business_id, business_day, barber_id, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  values ((select biz from ctx), current_date, (select juan from ctx), 25000, 0, 0, 25000, 60, 25000, 15000, 10000);
  set constraints all immediate; set constraints all deferred
$$, 'P0004', null, 'REQ-023.3 una venta con total > 0 sin pagos no se guarda');
-- Pago dividido (REQ-023.5): dos medios que suman el total
select lives_ok($$
  with v as (
    insert into sales (business_id, business_day, barber_id, services_total, products_total, discount_total, total,
                       commission_pct, commission_base, commission_amount, business_amount)
    values ((select biz from ctx), current_date, (select juan from ctx), 25000, 0, 0, 25000, 60, 25000, 15000, 10000) returning id)
  insert into sale_payments (business_id, sale_id, method, amount)
  select (select biz from ctx), id, m, a from v, (values ('cash'::payment_method, 10000), ('nequi'::payment_method, 15000)) p(m, a);
  set constraints all immediate; set constraints all deferred
$$, 'REQ-023.5 el modelo soporta pago dividido en dos medios');

-- ------------------------------------------------------------ consistencia de los montos ----
select throws_ok($$
  insert into sales (business_id, business_day, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  values ((select biz from ctx), current_date, 25000, 4000, 0, 30000, 60, 25000, 15000, 10000)
$$, '23514', null, 'REQ-025.2 total = servicios + productos');
select throws_ok($$
  insert into sales (business_id, business_day, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  values ((select biz from ctx), current_date, 25000, 0, 0, 25000, 60, 25000, 15000, 9000)
$$, '23514', null, 'REQ-025.2 parte del negocio = base − comisión');
select throws_ok($$
  insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total)
  values ((select biz from ctx), (select id from s), 'service', (select corte from ctx), 'Corte', 1, 25000, 5000, 25000)
$$, '23514', null, 'REQ-023.3 línea: total = precio × cantidad − descuento');
select throws_ok($$
  insert into sale_payments (business_id, sale_id, method, amount) values ((select biz from ctx), (select id from s), 'cash', -1)
$$, '23514', null, 'NFR-010 un pago no puede ser negativo ni cero');
select throws_ok($$
  insert into sales (business_id, business_day, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  values ((select biz from ctx), current_date, 0, 0, 0, 0, 101, 0, 0, 0)
$$, '23514', null, 'REQ-025.1 porcentaje entre 0 y 100');

-- ---------------------------------------------------------- inmutabilidad (ADR-005, P9) ----
select throws_ok($$ update sales set total = 1 where id = (select id from s) $$, 'P0004', null,
  'REQ-023.3 una venta no se edita');
select throws_ok($$ update sale_items set unit_price = 1 where sale_id = (select id from s) $$, 'P0004', null,
  'REQ-023.3 las líneas de una venta no se editan');
select throws_ok($$ update sale_payments set amount = 1 where sale_id = (select id from s) $$, 'P0004', null,
  'REQ-023.3 los pagos de una venta no se editan');
select throws_ok($$ update sales set status = 'voided' where id = (select id from s) $$, 'P0004', null,
  'REQ-026.1 anular exige motivo, quién y cuándo');

-- ------------------------------------------------------------ REQ-026.1 anular una venta ----
select lives_ok($$
  update sales set status = 'voided', voided_reason = 'Se cobró dos veces', voided_by = (select owner_u from ctx), voided_at = now()
  where id = (select id from s)
$$, 'REQ-026.1 la venta se anula con motivo (no se borra)');
select is((select status::text from sales where id = (select id from s)), 'voided', 'REQ-026.1 queda marcada anulada y visible');
select throws_ok($$ update sales set status = 'active', voided_reason = null, voided_by = null, voided_at = null where id = (select id from s) $$,
  'P0004', null, 'REQ-026.1 una venta anulada no vuelve a activarse');

-- ------------------------------------------------ REQ-027.2 / REQ-027.3 cierre de caja ----
create or replace function _close(p_day date) returns uuid language sql as $$
  insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
  values ((select biz from ctx), p_day, '{"total": 0}', 32000, 30000, -2000, (select owner_u from ctx)) returning id
$$;
select lives_ok($$ select _close(current_date - 1) $$, 'REQ-027.2 crea un cierre con totales, efectivo contado y diferencia');
select throws_ok($$ select _close(current_date - 1) $$, '23505', null, 'REQ-027.2 un solo cierre activo por día');
select throws_ok($$
  insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
  values ((select biz from ctx), current_date - 2, '{}', 32000, 30000, 0, (select owner_u from ctx))
$$, '23514', null, 'REQ-027.2 diferencia = contado − esperado');
select throws_ok($$ update cash_closures set cash_counted = 32000 where business_day = current_date - 1 $$, 'P0004', null,
  'REQ-027.2 un cierre no se edita');
select throws_ok($$ select _sale_a(current_date - 1) $$, 'P0009', null, 'REQ-027.3 no se registran ventas en un día cerrado');
-- Reabrir: se anula el cierre con motivo y se permite otro
select lives_ok($$
  update cash_closures set status = 'voided', reopen_reason = 'Faltó una venta', voided_at = now()
  where business_day = current_date - 1 and status = 'active'
$$, 'REQ-027.3 reabrir anula el cierre con motivo');
select lives_ok($$ select _sale_a(current_date - 1); set constraints all immediate; set constraints all deferred $$, 'REQ-027.3 reabierto, se puede vender de nuevo');

-- REQ-026.2 no se anula una venta de un día con cierre
create temp table s3 as select _sale_a(current_date - 3) as id;
grant select on s3 to public;
set constraints all immediate;
set constraints all deferred;
select _close(current_date - 3);
select throws_ok($$
  update sales set status = 'voided', voided_reason = 'x', voided_by = (select owner_u from ctx), voided_at = now()
  where id = (select id from s3)
$$, 'P0009', null, 'REQ-026.2 no se anulan ventas de un día con cierre de caja');

select * from finish();
rollback;
