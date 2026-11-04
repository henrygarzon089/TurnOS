-- T-091 · Pagar con la tarjeta de regalo y anular (REQ-057, REQ-058, ADR-034) · design.md §15.3–§15.4,
-- ejemplos I, K y L. register_sale, register_membership_fee y void_sale de 0052.
begin;
select plan(34);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update barbers set commission_pct = 60 where id = (select juan from ctx);
update services set price = 25000, counts_for_membership = true where id = (select corte from ctx);

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create temp table codes (k text primary key, v text);
grant all on codes to public;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
create function pg_temp.code(p_k text) returns text language sql as $$ select v from codes where k = p_k $$;
create function pg_temp.balance(p_k text) returns int language sql security definer as $$
  select gift_card_balance((select id from gift_cards where code = pg_temp.code(p_k)))
$$;
create function pg_temp.card_id(p_k text) returns uuid language sql security definer as $$
  select id from gift_cards where code = pg_temp.code(p_k)
$$;
create function pg_temp.corte(p_membership boolean default false) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1,
                                              'membership', p_membership))
$$;
-- Pagos: tarjeta por p_gift (con el código p_code) y el resto en efectivo
create function pg_temp.pays(p_code text, p_gift int, p_cash int default 0) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('method', 'gift_card', 'amount', p_gift, 'code', p_code))
         || case when p_cash > 0 then jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', p_cash))
                 else '[]'::jsonb end
$$;
create function pg_temp.cobro(p_code text, p_gift int, p_cash int default 0, p_items jsonb default null,
                              p_customer uuid default null) returns uuid language sql as $$
  select (register_sale((select biz from ctx), null, (select juan from ctx), coalesce(p_items, pg_temp.corte()),
                        pg_temp.pays(p_code, p_gift, p_cash), p_customer)).id
$$;

-- --------------------------------------------- tarjetas (el dueño las vende) ----
select auth.test_login((select owner_u from ctx));
insert into codes select 'H', sell_gift_card((select biz from ctx), 50000, '+573209992001', 'Ana', 'Mateo',
                                              '[{"method":"nequi","amount":50000}]') ->> 'code';
insert into codes select 'B', sell_gift_card((select biz from ctx), 10000, '+573209992002', 'Beto', null,
                                              '[{"method":"cash","amount":10000}]') ->> 'code';
insert into codes select 'V', sell_gift_card((select biz from ctx), 20000, '+573209992003', 'Vale', null,
                                              '[{"method":"cash","amount":20000}]') ->> 'code';
insert into ids select 'SV', sale_id from gift_cards where code = pg_temp.code('V');

-- ----------------------------------------------- ejemplo I: usar en parte ----
select auth.test_login((select juan_u from ctx));
select lives_ok($$ insert into ids select 'SI', pg_temp.cobro(lower(pg_temp.code('H')), 20000, 5000) $$,
  'REQ-057.4 el barbero cobra con la tarjeta (el código en minúsculas también sirve)');
select is((select services_total || ' · ' || total || ' · ' || commission_base || ' · ' || commission_amount
           from sales where id = pg_temp.id('SI')),
  '25000 · 25000 · 25000 · 15000', 'REQ-057.5 la comisión es la de siempre (ejemplo I)');
select is((select string_agg(method::text || ' ' || amount, ', ' order by method) from sale_payments where sale_id = pg_temp.id('SI')),
  'cash 5000, gift_card 20000', 'REQ-057.3 el resto se paga con otro medio');
select is(pg_temp.balance('H'), 30000, 'REQ-057.3 la tarjeta queda con $ 30.000 de saldo');
select is((select gift_card_id from sale_payments where sale_id = pg_temp.id('SI') and method = 'gift_card'),
  pg_temp.card_id('H'), 'REQ-057.3 el pago guarda cuál tarjeta');

-- ------------------------------------------------------------- rechazos ----
select throws_ok($$ select pg_temp.cobro(pg_temp.code('B'), 20000, 5000) $$, 'P0004', 'GIFT_CARD_INSUFFICIENT',
  'REQ-057.3 la tarjeta paga como máximo su saldo');
select throws_ok($$ select pg_temp.cobro('ZZZZZZZZ', 25000) $$, 'P0004', 'GIFT_CARD_NOT_FOUND',
  'REQ-057.2 un código que no existe se rechaza');
select throws_ok($$ select register_sale((select biz from ctx), null, (select juan from ctx), pg_temp.corte(),
                     pg_temp.pays(pg_temp.code('H'), 10000) || pg_temp.pays(pg_temp.code('B'), 10000) ||
                     '[{"method":"cash","amount":5000}]'::jsonb) $$,
  'P0004', 'ONE_GIFT_CARD_PER_SALE', 'REQ-057.3 una venta lleva a lo sumo una tarjeta');
select throws_ok($$ select pg_temp.cobro(pg_temp.code('H'), 0, 25000) $$, 'P0004', 'INVALID_PAYMENT',
  'REQ-057.3 el pago con tarjeta es de más de $ 0');
select throws_ok($$ select pg_temp.cobro(pg_temp.code('H'), 10000, 10000) $$, 'P0004', 'PAYMENTS_MISMATCH',
  'REQ-057.3 tarjeta y otros medios suman el total');
select is((select count(*)::int from sales where business_id = (select biz from ctx) and created_at = now()
             and barber_id = (select juan from ctx)), 1, 'REQ-057.2 un cobro rechazado no registra la venta');
select is(pg_temp.balance('H'), 30000, 'REQ-057.2 ni gasta saldo');

-- Vencida: se corre la fecha de la tarjeta B (como si se hubiera vendido hace más de un año)
select auth.test_logout();
update gift_cards set sold_on = (select today from ctx) - 400, expires_on = ((select today from ctx) - 400 + interval '1 year')::date
 where code = pg_temp.code('B');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select pg_temp.cobro(pg_temp.code('B'), 10000, 15000) $$, 'P0004', 'GIFT_CARD_EXPIRED',
  'REQ-058.4 una tarjeta vencida no paga: el saldo se perdió');
select auth.test_logout();
update gift_cards set sold_on = (select today from ctx), expires_on = ((select today from ctx) + interval '1 year')::date
 where code = pg_temp.code('B');
select auth.test_login((select juan_u from ctx));
select lives_ok($$ insert into ids select 'SB', pg_temp.cobro(pg_temp.code('B'), 10000, 15000) $$,
  'REQ-057.3 el último día de saldo se gasta completo');
select is(pg_temp.balance('B'), 0, 'REQ-057.3 la tarjeta queda agotada');
select throws_ok($$ select pg_temp.cobro(pg_temp.code('B'), 1000, 24000) $$, 'P0004', 'GIFT_CARD_INSUFFICIENT',
  'REQ-057.2 una tarjeta sin saldo se rechaza');

-- REQ-057.8 dos cobros seguidos con la misma tarjeta: el segundo ve el saldo que dejó el primero
select lives_ok($$ insert into ids select 'S2a', pg_temp.cobro(pg_temp.code('H'), 25000) $$,
  'REQ-057.8 primer cobro con la tarjeta');
select throws_ok($$ select pg_temp.cobro(pg_temp.code('H'), 25000) $$, 'P0004', 'GIFT_CARD_INSUFFICIENT',
  'REQ-057.8 el segundo no gasta más que el saldo que queda');
select is(pg_temp.balance('H'), 5000, 'REQ-057.8 el saldo nunca baja de cero');

-- -------------------------------------------- ejemplo K: con membresía ----
select auth.test_login((select owner_u from ctx));
select save_membership_plan((select biz from ctx), true, 80000, 1, 20);
insert into ids select 'F', create_membership((select biz from ctx), '+573209992010', 'Kika');
insert into ids select 'CK', id from customers where phone_e164 = '+573209992010' and business_id = (select biz from ctx);
select register_membership_fee(pg_temp.id('F'), '[{"method":"cash","amount":80000}]');
select throws_ok($$ select register_membership_fee(pg_temp.id('F'), jsonb_build_array(jsonb_build_object(
                     'method', 'gift_card', 'amount', 80000, 'code', pg_temp.code('V')))) $$,
  'P0004', 'INVALID_PAYMENT', 'REQ-057.7 la cuota de la membresía no se paga con tarjeta');
select throws_ok($$ select sell_gift_card((select biz from ctx), 10000, '+573209992004', 'Otro', null,
                     jsonb_build_array(jsonb_build_object('method', 'gift_card', 'amount', 10000, 'code', pg_temp.code('V')))) $$,
  'P0004', 'INVALID_PAYMENT', 'REQ-057.7 una tarjeta no se paga con otra');
select auth.test_login((select juan_u from ctx));
select register_sale((select biz from ctx), null, (select juan from ctx), pg_temp.corte(true), '[]', pg_temp.id('CK'));
select auth.test_login((select owner_u from ctx));
insert into codes select 'K', sell_gift_card((select biz from ctx), 20000, '+573209992005', 'Kiko', null,
                                              '[{"method":"cash","amount":20000}]') ->> 'code';
select auth.test_login((select juan_u from ctx));
select lives_ok($$ insert into ids select 'SK', pg_temp.cobro(pg_temp.code('K'), 20000, 0, pg_temp.corte(true), pg_temp.id('CK')) $$,
  'REQ-057.6 la tarjeta paga lo que queda después del descuento de la membresía');
select is((select services_total || ' · ' || discount_total || ' · ' || commission_amount from sales where id = pg_temp.id('SK')),
  '20000 · 5000 · 15000', 'REQ-057.6 membresía y tarjeta en la misma venta, comisión sobre la lista (ejemplo K)');
select is(pg_temp.balance('K'), 0, 'REQ-057.6 la tarjeta pagó los $ 20.000');

-- -------------------------------------------------- ejemplo L: anular ----
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select void_sale((select sale_id from gift_cards where code = pg_temp.code('H')), 'Error') $$,
  'P0004', 'GIFT_CARD_IN_USE', 'REQ-058.1 la venta de una tarjeta usada no se anula');
select lives_ok($$ select void_sale(pg_temp.id('SI'), 'Cobro equivocado') $$,
  'REQ-058.2 el dueño anula un cobro pagado con la tarjeta');
select is(pg_temp.balance('H'), 25000, 'REQ-058.2 el pago vuelve al saldo de la tarjeta');
select lives_ok($$ select void_sale(pg_temp.id('S2a'), 'Cobro equivocado') $$, 'REQ-058.2 se anula el otro cobro');
select is(pg_temp.balance('H'), 50000, 'REQ-058.2 la tarjeta vuelve a su valor completo (ejemplo L)');
select lives_ok($$ select void_sale((select sale_id from gift_cards where code = pg_temp.code('H')), 'Se arrepintió') $$,
  'REQ-058.1 sin pagos activos, la venta de la tarjeta se anula');
select is((select status::text from gift_cards where code = pg_temp.code('H')), 'voided', 'REQ-058.1 la tarjeta queda anulada');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select pg_temp.cobro(pg_temp.code('H'), 25000) $$, 'P0004', 'GIFT_CARD_VOIDED',
  'REQ-057.2 una tarjeta anulada no paga');
select auth.test_login((select owner_u from ctx));
select ok((select count(*) = 0 from sales s join sale_payments p on p.sale_id = s.id
            where s.id = (select sale_id from gift_cards where code = pg_temp.code('H')) and p.method <> 'nequi'),
  'REQ-058.3 anular no crea ninguna devolución: el saldo no se vuelve efectivo');
select ok(not exists (select 1 from pg_proc where proname ~ 'gift_card' and proname ~ '(refund|transfer|cash_out)'),
  'REQ-058.3 no hay función para devolver ni traspasar saldo');

select auth.test_logout();
select * from finish();
rollback;
