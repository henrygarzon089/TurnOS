-- T-073 · Membresía en el cobro (REQ-047.1–047.8, ADR-030) · design.md §13.3–§13.4, ejemplos E y F.
-- register_sale, void_sale y membership_status de 0042. La cuota (T-072) está en 0042_membership_sales.sql.
begin;
select plan(46);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);
update barbers set commission_pct = 60 where id = (select juan from ctx);
update services set price = 25000 where id = (select corte from ctx);
update loyalty_programs set enabled = true, visits_required = 10, reward_type = 'free_service', reward_service_id = (select corte from ctx)
 where business_id = (select biz from ctx);

-- Turno terminado por Juan (payment_status = 'pending'); al pasar a done se pone el sello
create function pg_temp.done(p_phone text) returns uuid
language plpgsql as $$
declare v uuid;
begin
  perform join_queue('la-33', 'Cobro Membresía', p_phone, (select corte from ctx), null, 1);
  select id into v from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', (select juan_u from ctx), 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v, 'called', 'barber', null, (select juan from ctx));
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v, 'in_service', 'barber');
  perform transition_ticket(v, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
-- Línea con membresía: el descuento que mande el cliente no cuenta, lo decide el servidor
create function pg_temp.mem(p uuid, p_reward boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('kind', 'service', 'ref_id', p, 'qty', 1, 'discount', 999, 'membership', true,
                            'is_reward', p_reward)
$$;
create function pg_temp.svc(p uuid, p_reward boolean default false) returns jsonb language sql as $$
  select jsonb_build_object('kind', 'service', 'ref_id', p, 'qty', 1, 'is_reward', p_reward)
$$;
create function pg_temp.pay(a int) returns jsonb language sql as $$
  select case when a = 0 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', a)) end
$$;
create function pg_temp.as_user(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', case when u is null then '' else
                    json_build_object('sub', u, 'role', 'authenticated')::text end, true)
$$;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;
create function pg_temp.cust(p_phone text) returns uuid language sql as $$
  select id from customers where business_id = (select biz from ctx) and phone_e164 = p_phone
$$;
create function pg_temp.cuts_left(p_phone text) returns int language sql as $$
  select (membership_status((select biz from ctx), pg_temp.cust(p_phone)) ->> 'cutsLeft')::int
$$;
create function pg_temp.sale(p_ticket text, p_items jsonb, p_amount int default 0, p_customer text default null)
returns uuid language sql as $$
  select (register_sale((select biz from ctx), pg_temp.id(p_ticket), (select juan from ctx), p_items,
                        pg_temp.pay(p_amount), pg_temp.cust(p_customer))).id
$$;
create function pg_temp.card(p_phone text) returns text language sql as $$
  select string_agg(status::text || ':' || stamps, ',' order by created_at)
  from loyalty_cards where customer_id = pg_temp.cust(p_phone) and status in ('active', 'completed')
$$;

-- -------------------------------------------- familia con su cuota pagada ----
-- Ana (titular), Beto, Caro (premio pendiente) y Dani (9 sellos). Eva no es miembro.
select save_membership_plan((select biz from ctx), true, 80000, 4, 20);
insert into ids select 'F1', create_membership((select biz from ctx), '+573209990101', 'Ana');
select add_membership_member(pg_temp.id('F1'), '+573209990102', 'Beto');
select add_membership_member(pg_temp.id('F1'), '+573209990103', 'Caro');
select add_membership_member(pg_temp.id('F1'), '+573209990104', 'Dani');
select upsert_customer((select biz from ctx), '+573209990105', 'Eva');
insert into ids select 'FEE', (register_membership_fee(pg_temp.id('F1'), '[{"method":"cash","amount":80000}]')).id;
insert into ids select 'P1', id from membership_periods where sale_id = pg_temp.id('FEE');

-- ---------------------------------------------------- membership_status ----
select is(membership_status((select biz from ctx), pg_temp.cust('+573209990102')),
  jsonb_build_object('membershipId', pg_temp.id('F1'), 'periodId', pg_temp.id('P1'), 'cutsTotal', 4, 'cutsLeft', 4,
                     'endsOn', (select today from ctx) + 29, 'discountPct', 20),
  'REQ-047.1 membership_status da el periodo vigente de cualquier miembro, con sus cortes');
select is(membership_status((select biz from ctx), pg_temp.cust('+573209990105')), null,
  'REQ-047.1 sin membresía, membership_status es null');
select is(membership_status((select biz from ctx), pg_temp.cust('+573209990101'), (select today from ctx) + 30), null,
  'REQ-047.1 el día después del fin del periodo ya no hay periodo vigente');
select ok(not has_function_privilege('anon', 'membership_status(uuid, uuid, date)', 'execute'),
  'REQ-047.1 membership_status no está abierta a anon (ADR-009)');

-- --------------------------------------------- ejemplo E: corte de membresía ----
insert into ids select 'TE', pg_temp.done('+573209990101');
select is(pg_temp.card('+573209990101'), 'active:1', 'REQ-047.7 (antes) el turno terminado le puso un sello a Ana');
select pg_temp.as_user((select juan_u from ctx));
select lives_ok($$ insert into ids select 'E', pg_temp.sale('TE', jsonb_build_array(pg_temp.mem((select corte from ctx)))) $$,
  'REQ-047.3 el barbero aplica la membresía sin permiso de descuento ni motivo');
select results_eq(
  $$ select services_total, discount_total, total, commission_pct, commission_base, commission_amount, business_amount
     from sales where id = pg_temp.id('E') $$,
  $$ values (0, 25000, 0, 60, 25000, 15000, 10000) $$,
  'REQ-047.4 ejemplo E: corte de membresía en $ 0, comisión 15.000 sobre el precio de lista');
select results_eq(
  $$ select unit_price, discount, line_total, membership_benefit::text, membership_period_id, is_reward, discount_reason
     from sale_items where sale_id = pg_temp.id('E') $$,
  $$ values (25000, 25000, 0, 'cut', pg_temp.id('P1'), false, null::text) $$,
  'REQ-047.1 el servicio queda en $ 0 y la línea gasta un corte del periodo');
select is(pg_temp.cuts_left('+573209990102'), 3, 'REQ-047.1 el corte se descuenta de los de la familia');
select ok(not exists (select 1 from loyalty_stamps where ticket_id = pg_temp.id('TE')),
  'REQ-047.7 el corte pagado con la membresía no suma sello: se quita el del turno');
select is(pg_temp.card('+573209990101'), 'active:0', 'REQ-047.7 y la tarjeta se descuenta');
select is((select payment_status::text from tickets where id = pg_temp.id('TE')), 'paid',
  'REQ-047.1 el turno queda pagado');

-- ------------------------------ el sello que completaba la tarjeta, y anular ----
select pg_temp.as_user(null);
insert into loyalty_cards (business_id, customer_id, stamps) select biz, pg_temp.cust('+573209990104'), 9 from ctx;
insert into ids select 'TD', pg_temp.done('+573209990104');
select is(pg_temp.card('+573209990104'), 'completed:10', 'REQ-047.7 (antes) el décimo sello completó la tarjeta de Dani');
select pg_temp.as_user((select juan_u from ctx));
insert into ids select 'D', pg_temp.sale('TD', jsonb_build_array(pg_temp.mem((select corte from ctx))));
select is(pg_temp.card('+573209990104'), 'active:9',
  'REQ-047.7 sin ese sello la tarjeta vuelve a activa con 9: el premio no se ganó con un corte de membresía');
select is((select completed_at from loyalty_cards where customer_id = pg_temp.cust('+573209990104') and status = 'active'), null,
  'REQ-047.7 y ya no figura como completada');
select is(pg_temp.cuts_left('+573209990101'), 2, 'REQ-047.6 cada miembro gasta de los mismos cortes');

select pg_temp.as_user((select owner_u from ctx));
select lives_ok($$ select void_sale(pg_temp.id('D'), 'Se cobró a quien no era') $$, 'REQ-047.8 el dueño anula la venta del corte');
select is(pg_temp.cuts_left('+573209990101'), 3, 'REQ-047.8 al anular, el corte vuelve al periodo');
select is(pg_temp.card('+573209990104'), 'completed:10', 'REQ-047.7 al anular, el sello quitado se repone');
select ok(exists (select 1 from loyalty_stamps where ticket_id = pg_temp.id('TD')),
  'REQ-047.7 el sello vuelve a ser del turno');
select is((select payment_status::text from tickets where id = pg_temp.id('TD')), 'pending',
  'REQ-047.8 el turno vuelve a cobro pendiente (REQ-026.1)');

-- -------------------------------------------------------- un solo beneficio ----
select pg_temp.as_user(null);
insert into loyalty_cards (business_id, customer_id, stamps, status, completed_at)
select biz, pg_temp.cust('+573209990103'), 10, 'completed', now() from ctx;
insert into ids select 'TC', pg_temp.done('+573209990103');
select pg_temp.as_user((select juan_u from ctx));
select throws_ok($$ select pg_temp.sale('TC', jsonb_build_array(pg_temp.mem((select corte from ctx)),
                                                                pg_temp.svc((select corte from ctx), true))) $$,
  'P0004', 'ONE_BENEFIT_PER_SALE', 'REQ-047.5 membresía y premio no van en la misma venta');
select throws_ok($$ select pg_temp.sale('TC', jsonb_build_array(pg_temp.svc((select corte from ctx), true),
                                                                pg_temp.mem((select corte from ctx)))) $$,
  'P0004', 'ONE_BENEFIT_PER_SALE', 'REQ-047.5 tampoco con el premio primero');
select throws_ok($$ select pg_temp.sale('TC', jsonb_build_array(pg_temp.mem((select corte from ctx), true))) $$,
  'P0004', 'ONE_BENEFIT_PER_SALE', 'REQ-047.5 ni en la misma línea');
select throws_ok($$ select pg_temp.sale('TC', jsonb_build_array(pg_temp.mem((select corte from ctx)),
                                                                pg_temp.mem((select corte from ctx)))) $$,
  'P0004', 'ONE_BENEFIT_PER_SALE', 'REQ-047.5 una venta lleva una sola línea de membresía');
select lives_ok($$ insert into ids select 'C', pg_temp.sale('TC', jsonb_build_array(pg_temp.mem((select corte from ctx)))) $$,
  'REQ-047.5 se aplica la membresía');
select is(pg_temp.card('+573209990103'), 'completed:10', 'REQ-047.5 y el premio de Caro queda disponible');
select is((select loyalty_card_id from sales where id = pg_temp.id('C')), null, 'REQ-047.5 la venta no canjea la tarjeta');
select is(pg_temp.cuts_left('+573209990103'), 2, 'REQ-047.5 la venta gastó un corte');

-- --------------------------------------------- "Nueva venta" sin turno ----
select lives_ok($$ insert into ids select 'B1', pg_temp.sale(null, jsonb_build_array(pg_temp.mem((select corte from ctx))), 0, '+573209990102') $$,
  'REQ-047.1 la membresía también se usa en "Nueva venta", sin turno');
insert into ids select 'B2', pg_temp.sale(null, jsonb_build_array(pg_temp.mem((select corte from ctx))), 0, '+573209990102');
select is((select array_agg(membership_benefit::text) from sale_items where sale_id in (pg_temp.id('B1'), pg_temp.id('B2'))),
  array['cut', 'cut'], 'REQ-047.6 la misma persona gasta varios cortes: no hay límite por persona');
select is(pg_temp.cuts_left('+573209990101'), 0, 'REQ-047.6 la familia agotó los cortes del periodo');

-- --------------------------------------------- ejemplo F: cortes agotados ----
select pg_temp.as_user(null);
insert into ids select 'TF', pg_temp.done('+573209990101');
select pg_temp.as_user((select juan_u from ctx));
select lives_ok($$ insert into ids select 'F', pg_temp.sale('TF', jsonb_build_array(pg_temp.mem((select corte from ctx)),
                     jsonb_build_object('kind', 'product', 'ref_id', (select gaseosa from ctx), 'qty', 1)), 24000) $$,
  'REQ-047.2 sin cortes, la membresía da el descuento del plan');
select results_eq(
  $$ select services_total, products_total, discount_total, total, commission_base, commission_amount, business_amount
     from sales where id = pg_temp.id('F') $$,
  $$ values (20000, 4000, 5000, 24000, 25000, 15000, 10000) $$,
  'REQ-047.4 ejemplo F: 20 % sobre el corte, no sobre la gaseosa; comisión 15.000 sobre la lista (no 12.000)');
select results_eq(
  $$ select kind::text, discount, line_total, membership_benefit::text, membership_period_id, discount_reason
     from sale_items where sale_id = pg_temp.id('F') order by kind $$,
  $$ values ('product', 0, 4000, null::text, null::uuid, null::text),
            ('service', 5000, 20000, 'discount', pg_temp.id('P1'), null::text) $$,
  'REQ-047.2 el descuento va solo en el servicio que gasta cortes, sin motivo');
select ok(exists (select 1 from loyalty_stamps where ticket_id = pg_temp.id('TF')),
  'REQ-047.7 un servicio con el descuento de la membresía sí suma sello');
select is(pg_temp.card('+573209990101'), 'active:1', 'REQ-047.7 la tarjeta conserva el sello');
select pg_temp.as_user((select owner_u from ctx));
select void_sale(pg_temp.id('F'), 'Prueba');
select is(pg_temp.card('+573209990101'), 'active:1', 'REQ-047.7 anular un descuento de membresía no repone ni duplica sellos');
select is(pg_temp.cuts_left('+573209990101'), 0, 'REQ-047.8 anular un descuento no devuelve cortes');

-- --------------------------------------------------------------- rechazos ----
select pg_temp.as_user((select juan_u from ctx));
select throws_ok($$ select pg_temp.sale(null, jsonb_build_array(pg_temp.mem((select barba from ctx))), 0, '+573209990101') $$,
  'P0004', 'NOT_MEMBERSHIP_SERVICE', 'REQ-047.2 un servicio que no gasta cortes no lleva la membresía');
select throws_ok($$ select pg_temp.sale(null, jsonb_build_array(jsonb_build_object('kind', 'product', 'ref_id', (select gaseosa from ctx),
                                                                 'qty', 1, 'membership', true)), 4000, '+573209990101') $$,
  'P0004', 'NOT_MEMBERSHIP_SERVICE', 'REQ-047.2 los productos no llevan la membresía');
select throws_ok($$ select pg_temp.sale(null, jsonb_build_array(pg_temp.mem((select corte from ctx))), 0, '+573209990105') $$,
  'P0004', 'NO_MEMBERSHIP', 'REQ-047.1 sin periodo vigente no hay membresía que usar');
select throws_ok($$ select pg_temp.sale(null, jsonb_build_array(pg_temp.mem((select corte from ctx)))) $$,
  'P0004', 'NO_MEMBERSHIP', 'REQ-047.1 sin cliente no hay membresía que usar');
select throws_ok($$ select pg_temp.sale(null, jsonb_build_array(jsonb_build_object('kind', 'membership', 'ref_id', pg_temp.id('F1'),
                                                                 'qty', 1)), 80000, '+573209990101') $$,
  'P0004', 'INVALID_LINE', 'REQ-045.1 la cuota no entra por el cobro: va por register_membership_fee');

select pg_temp.as_user(null);
select save_membership_plan((select biz from ctx), false, 80000, 4, 20);
select pg_temp.as_user((select juan_u from ctx));
select throws_ok($$ select pg_temp.sale(null, jsonb_build_array(pg_temp.mem((select corte from ctx))), 0, '+573209990101') $$,
  'P0004', 'NO_MEMBERSHIP', 'REQ-047.1 con el plan apagado no se usa la membresía');
select is(membership_status((select biz from ctx), pg_temp.cust('+573209990101')), null,
  'REQ-047.1 con el plan apagado membership_status es null (REQ-044.5)');

select pg_temp.as_user(null);
select * from finish();
rollback;
