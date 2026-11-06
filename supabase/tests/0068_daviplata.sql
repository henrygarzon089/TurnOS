-- T-140 · Daviplata como medio de pago (REQ-023.1, REQ-027.1, ADR-045)
begin;
select plan(7);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

select ok('daviplata' = any (enum_range(null::payment_method)::text[]),
  'REQ-023.1 Daviplata es un medio de pago');
select is((select array_position(enum_range(null::payment_method)::text[], 'daviplata')
               - array_position(enum_range(null::payment_method)::text[], 'nequi')), 1,
  'REQ-023.1 Daviplata va justo después de Nequi');

-- Un corte de $ 25.000: $ 15.000 por Daviplata y $ 10.000 en efectivo
select lives_ok($$
  select register_sale((select biz from ctx), null, (select juan from ctx),
    jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1)),
    jsonb_build_array(jsonb_build_object('method', 'daviplata', 'amount', 15000),
                      jsonb_build_object('method', 'cash', 'amount', 10000)))
$$, 'REQ-023.1 se puede cobrar con Daviplata, también dividido con efectivo');

select is((cash_day_summary((select biz from ctx)) -> 'byMethod' ->> 'daviplata')::int, 15000,
  'REQ-027.1 Caja de hoy suma Daviplata aparte');
select is((cash_day_summary((select biz from ctx)) ->> 'cashExpected')::int, 10000,
  'REQ-027.1 Daviplata no cuenta como efectivo esperado');
select ok(exists (select 1 from jsonb_array_elements(cash_day_summary((select biz from ctx)) -> 'sales') v
                  where v ->> 'methods' = 'Daviplata + Efectivo'),
  'REQ-027.1 el detalle de ventas dice "Daviplata"');

select auth.test_login((select owner_u from ctx));
select is((select (totals -> 'byMethod' ->> 'daviplata')::int from close_cash_day((select biz from ctx), null, 10000)), 15000,
  'REQ-027.1 el cierre guarda la línea de Daviplata');
select auth.test_logout();

select * from finish();
rollback;
