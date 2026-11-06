-- T-090 · Tarjetas de regalo: datos, venta, consulta y lista (REQ-055, REQ-056.3, REQ-059.3,
-- ADR-034, design.md §15.1–§15.3, ejemplo H). El pago con la tarjeta (register_sale) es T-091.
begin;
select plan(48);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create temp table res (k text primary key, v jsonb);
grant all on res to public;

create function pg_temp.sell(p_amount int, p_phone text default '+573209991001', p_name text default 'Ana Compra',
                             p_for text default 'Mateo', p_method text default 'nequi', p_paid int default null)
returns jsonb language sql as $$
  select sell_gift_card((select biz from ctx), p_amount, p_phone, p_name, p_for,
           jsonb_build_array(jsonb_build_object('method', p_method, 'amount', coalesce(p_paid, p_amount))))
$$;
create function pg_temp.card(p_key text) returns gift_cards
language sql security definer as $$
  select * from gift_cards where id = ((select v from res where k = p_key) ->> 'giftCardId')::uuid
$$;

-- ------------------------------------------------------------------ datos ----
select has_table('gift_cards', 'REQ-055.4 cada tarjeta se guarda con su código y su enlace');
select enum_has_labels('payment_method', array['cash', 'nequi', 'daviplata', 'transfer', 'card', 'gift_card'],
  'REQ-057.1 "Tarjeta de regalo" es un medio de pago');
select enum_has_labels('sale_item_kind', array['service', 'product', 'membership', 'gift_card'],
  'REQ-055.2 una línea de venta puede ser una tarjeta de regalo');
select col_default_is('sales', 'gift_card_total', '0', 'REQ-055.2 las ventas de siempre no traen tarjeta');
select throws_ok($$ insert into sales (business_id, business_day, services_total, products_total, gift_card_total, total)
                   values ((select biz from ctx), (select today from ctx), 0, 0, 50000, 0) $$,
  '23514', null, 'REQ-055.2 el total de la venta suma la tarjeta');
select ok(not has_function_privilege('anon', 'sell_gift_card(uuid, int, text, text, text, jsonb)', 'execute')
          and has_function_privilege('authenticated', 'sell_gift_card(uuid, int, text, text, text, jsonb)', 'execute'),
  'REQ-055.1 la venta va con la sesión del personal (y valida al dueño por dentro)');
select ok(not has_function_privilege('anon', 'get_gift_card_by_token(text)', 'execute')
          and not has_function_privilege('authenticated', 'get_gift_card_by_token(text)', 'execute')
          and has_function_privilege('service_role', 'get_gift_card_by_token(text)', 'execute'),
  'REQ-056.3 la página pública lee solo desde el servidor (ADR-009)');

-- ------------------------------------------------------- solo el dueño ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select pg_temp.sell(50000) $$, '42501', 'FORBIDDEN', 'REQ-055.1 el barbero no vende tarjetas');

select auth.test_login((select owner_u from ctx));
select throws_ok($$ select pg_temp.sell(9000) $$, 'P0004', 'INVALID_AMOUNT', 'REQ-055.1 mínimo $ 10.000');
select throws_ok($$ select pg_temp.sell(501000) $$, 'P0004', 'INVALID_AMOUNT', 'REQ-055.1 máximo $ 500.000');
select throws_ok($$ select pg_temp.sell(25500) $$, 'P0004', 'INVALID_AMOUNT', 'REQ-055.1 en miles exactos');
select throws_ok($$ select pg_temp.sell(50000, p_paid => 40000) $$, 'P0004', 'PAYMENTS_MISMATCH',
  'REQ-055.2 los pagos suman el valor de la tarjeta');
select throws_ok($$ select pg_temp.sell(50000, p_method => 'gift_card') $$, 'P0004', 'INVALID_PAYMENT',
  'REQ-057.7 una tarjeta no se paga con otra tarjeta');
select throws_ok($$ select pg_temp.sell(50000, p_phone => '3001234') $$, 'P0004', 'INVALID_PHONE',
  'REQ-055.3 el celular de quien compra tiene que ser válido');
select throws_ok($$ select pg_temp.sell(50000, p_for => repeat('x', 41)) $$, 'P0004', 'INVALID_NAME',
  'REQ-055.3 "Para" es un nombre corto');

-- ----------------------------------------------------- ejemplo H: vender ----
select lives_ok($$ insert into res select 'H', pg_temp.sell(50000) $$,
  'REQ-055.1 el dueño vende una tarjeta de $ 50.000 por Nequi');
insert into ids select 'SH', ((select v from res where k = 'H') ->> 'saleId')::uuid;
select ok((select barber_id is null and ticket_id is null and commission_amount = 0 and gift_card_total = 50000
                  and total = 50000 and services_total = 0 and products_total = 0 and business_day = (select today from ctx)
           from sales where id = (select v from ids where k = 'SH')),
  'REQ-055.2 venta sin barbero ni comisión, que entra completa ese día (ejemplo H)');
select is((select kind::text || ' · ' || name || ' · ' || line_total from sale_items where sale_id = (select v from ids where k = 'SH')),
  'gift_card · Tarjeta de regalo · 50000', 'REQ-055.2 la línea de la venta es la tarjeta');
select is((select method::text || ' ' || amount from sale_payments where sale_id = (select v from ids where k = 'SH')),
  'nequi 50000', 'REQ-055.2 con los medios de pago de la caja');
select is((select name from customers where id = (pg_temp.card('H')).buyer_customer_id and phone_e164 = '+573209991001'),
  'Ana Compra', 'REQ-055.3 crea la ficha de quien compra');
select is((select customer_id from sales where id = (select v from ids where k = 'SH')), (pg_temp.card('H')).buyer_customer_id,
  'REQ-055.3 la venta queda a nombre de quien compra');
select is((pg_temp.card('H')).recipient_name, 'Mateo', 'REQ-055.3 "Para" guarda el nombre de pila de quien la recibe');
select matches((pg_temp.card('H')).code, '^[A-HJKMNP-Z2-9]{8}$', 'REQ-055.4 código de 8 sin 0, O, 1, I ni L');
select is((select v ->> 'code' from res where k = 'H'), (pg_temp.card('H')).code, 'REQ-055.4 la venta devuelve el código');
select ok(length((pg_temp.card('H')).token) >= 20 and (pg_temp.card('H')).token <> (pg_temp.card('H')).code,
  'REQ-055.4 el enlace usa un token largo, distinto del código');
select is((pg_temp.card('H')).expires_on, ((select today from ctx) + interval '1 year')::date,
  'REQ-055.5 vence un año después del día de la venta');
select lives_ok($$ insert into res select 'H2', pg_temp.sell(30000, p_name => 'Otro nombre', p_for => '  ') $$,
  'REQ-055.3 "Para" es opcional');
select ok((pg_temp.card('H2')).buyer_customer_id = (pg_temp.card('H')).buyer_customer_id
          and (select name from customers where id = (pg_temp.card('H')).buyer_customer_id) = 'Ana Compra'
          and (pg_temp.card('H2')).recipient_name is null,
  'REQ-055.3 el mismo celular usa la ficha que ya existe');

-- ------------------------------------------------- consulta en el cobro ----
select auth.test_login((select juan_u from ctx));
insert into res select 'L', gift_card_lookup((select biz from ctx), lower(substr((pg_temp.card('H')).code, 1, 4)) || '-'
                                              || lower(substr((pg_temp.card('H')).code, 5)));
select is((select (v ->> 'balance')::int from res where k = 'L'), 50000,
  'REQ-055.6 el barbero consulta la tarjeta con el código (en minúsculas y con guion)');
select is((select v ->> 'status' from res where k = 'L'), 'active', 'REQ-055.6 la tarjeta está vigente');
select ok(not ((select v from res where k = 'L') ?| array['buyerName', 'buyerPhone', 'buyerCustomerId']),
  'REQ-056.3 la consulta no trae datos de quien compra');
select is(gift_card_lookup((select biz from ctx), 'ZZZZZZZZ'), null::jsonb, 'REQ-055.6 un código que no existe no trae nada');
select is((select count(*)::int from gift_cards), 0, 'REQ-059.3 el barbero no ve la tabla de tarjetas (RLS)');
select throws_ok($$ select * from gift_cards_list((select biz from ctx)) $$, '42501', 'FORBIDDEN',
  'REQ-059.3 la lista es del dueño');

-- ------------------------------------------------------------- la lista ----
select auth.test_login((select owner_u from ctx));
select is((select count(*)::int from gift_cards), 2, 'REQ-059.3 el dueño ve sus tarjetas');
select is((select buyer_name || ' · ' || buyer_phone || ' · ' || amount || ' · ' || balance || ' · ' || status
           from gift_cards_list((select biz from ctx)) where id = (pg_temp.card('H')).id),
  'Ana Compra · +573209991001 · 50000 · 50000 · active', 'REQ-059.3 la lista trae comprador, valor, saldo y estado');

-- Estados (sin el cobro de T-091: una venta mínima pagada con la tarjeta H2)
select auth.test_logout();
with x as (insert into sales (business_id, business_day, services_total, products_total, total)
           values ((select biz from ctx), (select today from ctx), 0, 30000, 30000) returning id)
insert into ids select 'SX', id from x;
insert into sale_payments (business_id, sale_id, method, amount, gift_card_id)
values ((select biz from ctx), (select v from ids where k = 'SX'), 'gift_card', 30000, (pg_temp.card('H2')).id);
select is(gift_card_state((pg_temp.card('H2')).id), 'exhausted', 'REQ-059.3 sin saldo la tarjeta está agotada');
select is(gift_card_state((pg_temp.card('H')).id, ((select today from ctx) + interval '1 year')::date), 'active',
  'REQ-055.5 se puede usar el día que vence');
select is(gift_card_state((pg_temp.card('H')).id, ((select today from ctx) + interval '1 year' + interval '1 day')::date),
  'expired', 'REQ-058.4 al día siguiente está vencida');
select throws_ok($$ insert into sale_payments (business_id, sale_id, method, amount)
                   values ((select biz from ctx), (select v from ids where k = 'SX'), 'gift_card', 1000) $$,
  '23514', null, 'REQ-057.1 un pago con tarjeta dice cuál tarjeta');
select ok((select bool_and(gift_card_new_code() ~ '^[A-HJKMNP-Z2-9]{8}$') from generate_series(1, 300)),
  'REQ-055.4 los códigos nuevos usan solo letras y números que no se confunden');
select throws_ok($$ insert into gift_cards (business_id, code, sale_id, buyer_customer_id, amount, sold_on, expires_on)
                   values ((select biz from ctx), (pg_temp.card('H')).code, (select v from ids where k = 'SX'),
                           (pg_temp.card('H')).buyer_customer_id, 10000, '2028-02-29', '2029-02-28') $$,
  '23505', null, 'REQ-055.4 el código es único en el negocio');
select throws_ok($$ insert into gift_cards (business_id, code, sale_id, buyer_customer_id, amount, sold_on, expires_on)
                   values ((select biz from ctx), 'AAAA2222', (select v from ids where k = 'SX'),
                           (pg_temp.card('H')).buyer_customer_id, 10000, '2028-02-29', '2029-03-01') $$,
  '23514', null, 'REQ-055.5 vendida el 29 de febrero no vence el 1 de marzo');
select lives_ok($$ insert into gift_cards (business_id, code, sale_id, buyer_customer_id, amount, sold_on, expires_on)
                   values ((select biz from ctx), 'AAAA2222', (select v from ids where k = 'SX'),
                           (pg_temp.card('H')).buyer_customer_id, 10000, '2028-02-29', '2029-02-28') $$,
  'REQ-055.5 vendida el 29 de febrero vence el 28 de febrero');

-- ------------------------------------------------------- página pública ----
select auth.test_login(null, 'service_role');
insert into res select 'P', get_gift_card_by_token((pg_temp.card('H')).token);
select is((select (v ->> 'balance')::int || ' · ' || (v ->> 'recipientName') || ' · ' || (v ->> 'code') from res where k = 'P'),
  '50000 · Mateo · ' || (pg_temp.card('H')).code, 'REQ-056.3 la página lee saldo, "Para" y código por el token');
select ok(not ((select v from res where k = 'P') ?| array['buyerName', 'buyerPhone', 'sales', 'payments']),
  'REQ-056.3 la página no trae comprador ni en qué se gastó');
select is(get_gift_card_by_token('no-existe'), null::jsonb, 'REQ-056.3 un token desconocido no trae nada');

-- ------------------------------------------------------- día cerrado ----
select auth.test_logout();
insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
select biz, today, '{}', 0, 0, 0, owner_u from ctx;
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select pg_temp.sell(20000) $$, 'P0009', 'CASH_DAY_CLOSED',
  'REQ-055.2 con el día cerrado no se vende una tarjeta (REQ-026.2)');

select auth.test_logout();
select * from finish();
rollback;
