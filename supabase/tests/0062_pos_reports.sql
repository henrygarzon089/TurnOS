-- T-113 · Comisión de productos y compras de barberos en la caja y la semana (REQ-068.5, REQ-069.2–069.4,
-- ADR-038) · design.md §17.3, ejemplo R (ventas M, N, O y P de §17.4).
begin;
select plan(14);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update barbers set commission_pct = 60 where id = (select juan from ctx);
update services set price = 25000 where id = (select corte from ctx);
update businesses set product_commission_pct = 10, staff_discount_pct = 20 where id = (select biz from ctx);

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
with x as (
  insert into products (business_id, name, price, sort_order, commissionable) values
    ((select biz from ctx), 'Cera', 35000, 20, true),
    ((select biz from ctx), 'Aceite de barba', 42500, 21, true)
  returning name, id)
insert into ids select name, id from x;
create temp table res (k text primary key, v jsonb);
grant all on res to public;

create function pg_temp.r(p_k text) returns jsonb language sql as $$ select v from res where k = p_k $$;
-- Un campo de un barbero en un resumen (0 si el barbero no sale)
create function pg_temp.b(p_k text, p_name text, p_field text) returns int language sql as $$
  select coalesce((select (e ->> p_field)::int from jsonb_array_elements(pg_temp.r(p_k) -> 'barbers') e
                   where e ->> 'name' = p_name), 0)
$$;
create function pg_temp.d(p_name text, p_field text) returns int language sql as $$
  select pg_temp.b('R', p_name, p_field) - pg_temp.b('antes', p_name, p_field)
$$;
create function pg_temp.p(p_name text) returns jsonb language sql as $$
  select jsonb_build_object('kind', 'product', 'ref_id', (select v from ids where k = p_name), 'qty', 1)
$$;
create function pg_temp.cash(p_amount int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', p_amount))
$$;

-- Lo que ya había vendido el seed hoy
select auth.test_login((select owner_u from ctx));
insert into res select 'antes', cash_day_summary((select biz from ctx));
insert into res select 'semana_antes', weekly_summary((select biz from ctx));

-- ------------------------------------------------------ ejemplo R ----
select auth.test_login((select juan_u from ctx));
select register_sale((select biz from ctx), null, null,                                  -- M
  jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1), pg_temp.p('Cera'),
                    jsonb_build_object('kind', 'product', 'ref_id', (select gaseosa from ctx), 'qty', 1)),
  pg_temp.cash(64000));
select auth.test_login((select owner_u from ctx));
select register_sale((select biz from ctx), null, (select pedro from ctx),             -- N
  jsonb_build_array(pg_temp.p('Cera'), pg_temp.p('Aceite de barba')), pg_temp.cash(77500));
select register_sale((select biz from ctx), null, null,                                 -- O
  jsonb_build_array(pg_temp.p('Cera'), pg_temp.p('Aceite de barba')), pg_temp.cash(77500));
select register_sale((select biz from ctx), null, null, jsonb_build_array(pg_temp.p('Cera')),  -- P
  pg_temp.cash(28000), null, (select juan from ctx));
insert into res select 'R', cash_day_summary((select biz from ctx));
insert into res select 'semana', weekly_summary((select biz from ctx));

select is(pg_temp.d('Juan', 'commission') || ' · ' || pg_temp.d('Juan', 'productsSold') || ' · '
          || pg_temp.d('Juan', 'productCommission') || ' · ' || pg_temp.d('Juan', 'toPay'),
  '15000 · 35000 · 3500 · 18500', 'REQ-069.2 Juan: servicios y productos en renglones aparte y total a pagar');
select is(pg_temp.d('Pedro', 'productsSold') || ' · ' || pg_temp.d('Pedro', 'productCommission') || ' · '
          || pg_temp.d('Pedro', 'toPay'),
  '77500 · 7750 · 7750', 'REQ-069.2 Pedro: solo productos, también sale para liquidar');
select is((select (e ->> 'productPct')::int from jsonb_array_elements(pg_temp.r('R') -> 'barbers') e
           where e ->> 'name' = 'Pedro'), 10, 'REQ-069.2 el renglón de productos dice el % del día');
select is(pg_temp.d('Juan', 'sold'), 25000,
  'REQ-068.5 la compra de Juan no cuenta como venta de Juan');
select is((pg_temp.r('R') ->> 'productCommission')::int - (pg_temp.r('antes') ->> 'productCommission')::int, 11250,
  'REQ-069.2 el total de comisión de productos del día (3.500 + 7.750)');
select is((pg_temp.r('R') -> 'staffPurchases' ->> 'total')::int || ' · ' || (pg_temp.r('R') -> 'staffPurchases' ->> 'discount')::int,
  '28000 · 7000', 'REQ-069.3 el cierre muestra las compras de barberos y su descuento');
select is((pg_temp.r('R') ->> 'products')::int - (pg_temp.r('antes') ->> 'products')::int, 222000,
  'REQ-069.3 "Nadie" y las compras de barberos cuentan en productos');
select is((pg_temp.r('R') ->> 'total')::int - (pg_temp.r('antes') ->> 'total')::int, 247000,
  'REQ-069.3 total vendido del ejemplo R');
select is((select e ->> 'staffBuyerName' from jsonb_array_elements(pg_temp.r('R') -> 'sales') e
           where e ->> 'staffBuyerName' is not null limit 1), 'Juan',
  'REQ-069.3 en el detalle del día la compra dice quién compró');

-- -------------------------------------------------------------- semana ----
select is(pg_temp.b('semana', 'Juan', 'productCommission') - pg_temp.b('semana_antes', 'Juan', 'productCommission'), 3500,
  'REQ-069.4 la semana muestra la comisión de productos de Juan');
select is(pg_temp.b('semana', 'Juan', 'toPay') - pg_temp.b('semana_antes', 'Juan', 'toPay'), 18500,
  'REQ-069.4 y su total a pagar');
select is((pg_temp.r('semana') -> 'staffPurchases' ->> 'discount')::int - (pg_temp.r('semana_antes') -> 'staffPurchases' ->> 'discount')::int, 7000,
  'REQ-069.4 las compras de barberos de la semana');

-- --------------------------------------------------- anular y cerrar ----
select void_sale((select id from sales where business_id = (select biz from ctx) and barber_id = (select pedro from ctx)
                   and product_commission_amount = 7750 order by created_at desc limit 1), 'Prueba');
insert into res select 'V', cash_day_summary((select biz from ctx));
select is(pg_temp.b('V', 'Pedro', 'productCommission') - pg_temp.b('antes', 'Pedro', 'productCommission'), 0,
  'REQ-069.1 la venta anulada sale de la comisión de productos del cierre');
select close_cash_day((select biz from ctx), (select today from ctx), (pg_temp.r('V') ->> 'cashExpected')::int);
select is((select (totals ->> 'productCommission')::int from cash_closures
           where business_id = (select biz from ctx) and business_day = (select today from ctx) and status = 'active'),
  (pg_temp.r('V') ->> 'productCommission')::int, 'REQ-069.2 el cierre guarda la comisión de productos');

select auth.test_logout();
select * from finish();
rollback;
