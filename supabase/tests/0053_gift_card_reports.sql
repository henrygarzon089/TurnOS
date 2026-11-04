-- T-092 · Tarjetas de regalo en la caja, la semana, el aviso y la plantilla (REQ-059.1, 059.2, 059.4,
-- REQ-056.1, ADR-034) · design.md §15.3–§15.4, ejemplo J.
begin;
select plan(16);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update barbers set commission_pct = 60 where id = (select juan from ctx);
update services set price = 25000 where id = (select corte from ctx);

create temp table res (k text primary key, v jsonb);
grant all on res to public;
create function pg_temp.r(p_k text) returns jsonb language sql as $$ select v from res where k = p_k $$;

-- Antes de las tarjetas: lo que ya había vendido el seed hoy
select auth.test_login((select owner_u from ctx));
insert into res select 'antes', cash_day_summary((select biz from ctx));
insert into res select 'semana_antes', weekly_summary((select biz from ctx));

-- ------------------------------------------------------ ejemplo J ----
-- Tarjeta de $ 50.000 por Nequi y, enseguida, corte de $ 25.000 con Juan pagado todo con ella
insert into res select 'H', sell_gift_card((select biz from ctx), 50000, '+573209993001', 'Ana', 'Mateo',
                                           '[{"method":"nequi","amount":50000}]');
select auth.test_login((select juan_u from ctx));
select register_sale((select biz from ctx), null, (select juan from ctx),
  jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1)),
  jsonb_build_array(jsonb_build_object('method', 'gift_card', 'amount', 25000, 'code', pg_temp.r('H') ->> 'code')));
select auth.test_login((select owner_u from ctx));
insert into res select 'J', cash_day_summary((select biz from ctx));

select is((pg_temp.r('J') ->> 'giftCardsSold')::int - (pg_temp.r('antes') ->> 'giftCardsSold')::int, 50000,
  'REQ-059.1 el cierre muestra las tarjetas vendidas (ejemplo J)');
select is((pg_temp.r('J') ->> 'giftCardsRedeemed')::int - (pg_temp.r('antes') ->> 'giftCardsRedeemed')::int, 25000,
  'REQ-059.1 y lo pagado con tarjeta de regalo');
select is((pg_temp.r('J') ->> 'total')::int - (pg_temp.r('antes') ->> 'total')::int, 75000,
  'REQ-059.2 el total vendido suma la tarjeta y el corte (75.000)');
select is((pg_temp.r('J') ->> 'moneyIn')::int - (pg_temp.r('antes') ->> 'moneyIn')::int, 50000,
  'REQ-059.2 entró en plata = total − pagado con tarjeta (50.000)');
select is((pg_temp.r('J') ->> 'cashExpected')::int, (pg_temp.r('antes') ->> 'cashExpected')::int,
  'REQ-059.2 lo pagado con tarjeta no cuenta en el efectivo esperado');
select is((pg_temp.r('J') -> 'byMethod' ->> 'giftCard')::int, (pg_temp.r('J') ->> 'giftCardsRedeemed')::int,
  'REQ-059.2 el medio "Tarjeta de regalo" sale aparte de los demás');
select is((pg_temp.r('J') -> 'byMethod' ->> 'nequi')::int - (pg_temp.r('antes') -> 'byMethod' ->> 'nequi')::int, 50000,
  'REQ-059.2 la plata de la tarjeta entró por Nequi el día de la venta');
select is((select (b ->> 'commission')::int from jsonb_array_elements(pg_temp.r('J') -> 'barbers') b where b ->> 'name' = 'Juan')
          - coalesce((select (b ->> 'commission')::int from jsonb_array_elements(pg_temp.r('antes') -> 'barbers') b where b ->> 'name' = 'Juan'), 0),
  15000, 'REQ-059.1 la comisión de Juan por el corte pagado con tarjeta entra a la liquidación');
select ok(exists (select 1 from jsonb_array_elements(pg_temp.r('J') -> 'sales') x where x ->> 'methods' = 'Tarjeta de regalo'),
  'REQ-059.1 en las ventas del día el medio dice "Tarjeta de regalo"');

-- Cierre: guarda la misma foto
select close_cash_day((select biz from ctx), (select today from ctx), (pg_temp.r('J') ->> 'cashExpected')::int);
select is((select (totals ->> 'moneyIn')::int from cash_closures where business_id = (select biz from ctx)
             and business_day = (select today from ctx) and status = 'active'),
  (pg_temp.r('J') ->> 'moneyIn')::int, 'REQ-059.2 el cierre guarda "Entró en plata"');

-- Semana
insert into res select 'semana', weekly_summary((select biz from ctx));
select is((pg_temp.r('semana') ->> 'giftCardsSold')::int - (pg_temp.r('semana_antes') ->> 'giftCardsSold')::int, 50000,
  'REQ-059.1 la semana muestra las tarjetas vendidas');
select is((pg_temp.r('semana') ->> 'giftCardsRedeemed')::int - (pg_temp.r('semana_antes') ->> 'giftCardsRedeemed')::int, 25000,
  'REQ-059.1 y lo pagado con tarjeta');
select is((pg_temp.r('semana') ->> 'moneyIn')::int - (pg_temp.r('semana_antes') ->> 'moneyIn')::int, 50000,
  'REQ-059.2 y lo que entró en plata');

-- --------------------------------------------------- aviso y plantilla ----
select auth.test_logout();
select matches(default_privacy_text('Filo'), 'Tarjetas de regalo: si usted compra una, guardamos su nombre y celular',
  'REQ-059.4 el aviso por defecto dice que se guarda el celular de quien compra una tarjeta');
select is((select body from message_templates where business_id = (select biz from ctx) and key = 'gift_card'),
  'Hola {nombre}, aquí está tu tarjeta de regalo de {negocio} por {valor}: {enlace} Vence el {fecha}.',
  'REQ-056.1 los negocios que ya existen tienen la plantilla "Tarjeta de regalo"');
select auth.test_login((select owner_u from ctx));
select create_business('Barbería Regalo', 'barberia-regalo-t092');
select auth.test_logout();
select is((select count(*)::int from message_templates t join businesses b on b.id = t.business_id
            where b.slug = 'barberia-regalo-t092' and t.key = 'gift_card'), 1,
  'REQ-056.1 un negocio nuevo nace con la plantilla "Tarjeta de regalo"');

select * from finish();
rollback;
