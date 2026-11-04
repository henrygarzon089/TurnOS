-- T-072 · Cuota de la membresía en la caja (REQ-045.1–045.7, REQ-044.4, ADR-030,
-- design.md §13.3–§13.4, ejemplo G). El cobro con membresía (register_sale) es T-073.
begin;
select plan(44);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- Ids que se van creando (las funciones se llaman con la sesión del dueño)
create temp table ids (k text primary key, v uuid);
grant all on ids to public;

create function pg_temp.fee(p_membership text, p_amount int default 80000) returns uuid
language sql as $$
  select (register_membership_fee((select v from ids where k = p_membership),
            jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', p_amount)))).id
$$;
create function pg_temp.is_current(p_membership text) returns boolean
language sql security definer as $$ select family_is_current((select v from ids where k = p_membership)) $$;
create function pg_temp.period_of(p_sale text) returns membership_periods
language sql as $$ select * from membership_periods where sale_id = (select v from ids where k = p_sale) $$;

-- Periodo de antes (fixture): venta mínima en $ 0 y su periodo, que empezó p_starts
create function pg_temp.old_period(p_membership text, p_starts date) returns uuid
language plpgsql security definer as $$
declare v_sale uuid; v_id uuid;
begin
  insert into sales (business_id, business_day, services_total, products_total, total)
  values ((select biz from ctx), (select today from ctx), 0, 0, 0) returning id into v_sale;
  insert into membership_periods (business_id, membership_id, sale_id, starts_on, ends_on, cuts_total, price, discount_pct)
  values ((select biz from ctx), (select v from ids where k = p_membership), v_sale, p_starts, p_starts + 29, 4, 80000, 20)
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------------ datos ----
select enum_has_labels('sale_item_kind', array['service', 'product', 'membership', 'gift_card'],
  'REQ-045.1 una línea de venta puede ser la cuota de la membresía');
select col_default_is('sales', 'membership_total', '0', 'REQ-045.1 las ventas de siempre no traen cuota');
select has_column('sale_items', 'membership_period_id', 'REQ-045.1 la línea apunta al periodo');
select enum_has_labels('membership_benefit', array['cut', 'discount'],
  'REQ-045.7 la línea de servicio dice si gastó un corte o tuvo descuento');
select throws_ok($$ insert into sales (business_id, business_day, services_total, products_total, membership_total, total)
                   values ((select biz from ctx), (select today from ctx), 0, 0, 80000, 0) $$,
  '23514', null, 'REQ-045.1 el total de la venta suma la cuota');
select ok(not has_function_privilege('anon', 'register_membership_fee(uuid, jsonb)', 'execute')
          and has_function_privilege('authenticated', 'register_membership_fee(uuid, jsonb)', 'execute'),
  'REQ-045.2 la cuota se registra con la sesión del personal (y valida al dueño por dentro)');

-- ------------------------------------------------------------- familias ----
select auth.test_login((select owner_u from ctx));
select save_membership_plan((select biz from ctx), true, 80000, 4, 20);
insert into ids select 'F1', create_membership((select biz from ctx), '+573209990001', 'Ana');
insert into ids select 'F2', create_membership((select biz from ctx), '+573209990002', 'Beto');
insert into ids select 'F3', create_membership((select biz from ctx), '+573209990003', 'Caro');
insert into ids select 'F4', create_membership((select biz from ctx), '+573209990004', 'Dani');

-- -------------------------------------------------------- solo el dueño ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select pg_temp.fee('F1') $$, '42501', 'FORBIDDEN',
  'REQ-045.2 el barbero no registra cuotas');
select auth.test_login((select owner_u from ctx));

select save_membership_plan((select biz from ctx), false, 80000, 4, 20);
select throws_ok($$ select pg_temp.fee('F1') $$, 'P0004', 'PLAN_DISABLED',
  'REQ-044.5 con el plan apagado no se cobra la cuota');
select save_membership_plan((select biz from ctx), true, 80000, 4, 20);

select throws_ok($$ select pg_temp.fee('F1', 70000) $$, 'P0004', 'PAYMENTS_MISMATCH',
  'REQ-045.1 los pagos suman el precio del plan');
select throws_ok($$ select register_membership_fee(gen_random_uuid(), '[{"method":"cash","amount":80000}]') $$,
  'P0002', 'MEMBERSHIP_NOT_FOUND', 'REQ-045.1 la familia tiene que existir');

-- --------------------------------------------------- ejemplo G: la cuota ----
select lives_ok($$ insert into ids select 'S1', pg_temp.fee('F1') $$, 'REQ-045.1 el dueño cobra la cuota');
select is((select row(barber_id, ticket_id, customer_id, business_day, services_total, products_total,
                      membership_total, total, discount_total)::text
           from sales where id = (select v from ids where k = 'S1')),
  row(null::uuid, null::uuid, (select holder_customer_id from family_memberships where id = (select v from ids where k = 'F1')),
      (select today from ctx), 0, 0, 80000, 80000, 0)::text,
  'REQ-045.1 ejemplo G: venta del día sin barbero ni turno, a nombre del titular, total $ 80.000');
select is((select row(commission_pct, commission_base, commission_amount, business_amount)::text
           from sales where id = (select v from ids where k = 'S1')),
  row(0, 0, 0, 0)::text, 'REQ-045.1 ejemplo G: la cuota no lleva comisión');
select is((select row(kind, name, qty, unit_price, discount, line_total, membership_period_id, membership_benefit)::text
           from sale_items where sale_id = (select v from ids where k = 'S1')),
  row('membership'::sale_item_kind, 'Membresía familiar', 1, 80000, 0, 80000, (pg_temp.period_of('S1')).id,
      null::membership_benefit)::text,
  'REQ-045.1 una sola línea "Membresía familiar" por el precio del plan');
select is((select array_agg(method::text || ' ' || amount) from sale_payments where sale_id = (select v from ids where k = 'S1')),
  array['cash 80000'], 'REQ-045.1 la cuota entra con los medios de pago de la caja');

-- --------------------------------------------------------- 30 días ----
select is((select row(starts_on, ends_on, cuts_total, price, discount_pct, status)::text from pg_temp.period_of('S1')),
  row((select today from ctx), (select today from ctx) + 29, 4, 80000, 20, 'active'::membership_period_status)::text,
  'REQ-045.3 el periodo dura 30 días desde hoy con N cortes y copia el plan');
select ok(pg_temp.is_current('F1'), 'REQ-045.3 con la cuota la familia queda vigente');

-- ---------------------------------------------------------- encadenado ----
insert into ids select 'S2', pg_temp.fee('F1');
select is((select row(starts_on, ends_on, cuts_total)::text from pg_temp.period_of('S2')),
  row((select today from ctx) + 30, (select today from ctx) + 59, 4)::text,
  'REQ-045.4 pagar con un periodo vigente empieza el día siguiente al fin, con sus propios N cortes');
insert into ids select 'S3', pg_temp.fee('F1');
select is((select starts_on from pg_temp.period_of('S3')), (select today from ctx) + 60,
  'REQ-045.4 encadena detrás del último periodo pagado');

-- Un periodo que termina hoy: el nuevo empieza mañana
insert into ids select 'P4', pg_temp.old_period('F4', (select today from ctx) - 29);
insert into ids select 'S4', pg_temp.fee('F4');
select is((select starts_on from pg_temp.period_of('S4')), (select today from ctx) + 1,
  'REQ-045.4 si el periodo vigente termina hoy, el nuevo empieza mañana');

-- -------------------------------------------- vencimiento y cortes perdidos ----
insert into ids select 'P3', pg_temp.old_period('F3', (select today from ctx) - 40);
-- dos de los cuatro cortes se usaron; los otros dos quedan sin usar
select auth.test_logout();
with s as (
  insert into sales (business_id, business_day, barber_id, services_total, products_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  select biz, today - 35, juan, 0, 0, 0, 60, 25000, 15000, 10000 from ctx cross join generate_series(1, 2)
  returning id)
insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total,
                        membership_period_id, membership_benefit)
select c.biz, s.id, 'service', c.corte, 'Corte', 1, 25000, 25000, 0, (select v from ids where k = 'P3'), 'cut'
from ctx c cross join s;
select auth.test_login((select owner_u from ctx));
select ok(not pg_temp.is_current('F3'),
  'REQ-045.6 sin renovar, la membresía expira al día siguiente del fin, sin periodo de gracia');
insert into ids select 'S5', pg_temp.fee('F3');
select is((select row(starts_on, cuts_total)::text from pg_temp.period_of('S5')),
  row((select today from ctx), 4)::text,
  'REQ-045.5 renovar después de vencer empieza hoy con N cortes: los que sobraron se perdieron');
select ok(pg_temp.is_current('F3'), 'REQ-045.6 puede renovar cuando quiera');

-- ------------------------------------------------------- plan cambiado ----
select save_membership_plan((select biz from ctx), true, 90000, 6, 10);
select is((select array_agg(row(price, cuts_total, discount_pct)::text order by starts_on)
           from membership_periods where membership_id = (select v from ids where k = 'F1')),
  array[row(80000, 4, 20)::text, row(80000, 4, 20)::text, row(80000, 4, 20)::text],
  'REQ-044.4 cambiar el plan no toca los periodos pagados');
select throws_ok($$ select pg_temp.fee('F2') $$, 'P0004', 'PAYMENTS_MISMATCH',
  'REQ-044.4 la cuota nueva se cobra con el precio nuevo');
insert into ids select 'S6', pg_temp.fee('F2', 90000);
select is((select row(price, cuts_total, discount_pct)::text from pg_temp.period_of('S6')),
  row(90000, 6, 10)::text, 'REQ-044.4 el periodo que empieza después usa el plan nuevo');
select is((select membership_total from sales where id = (select v from ids where k = 'S6')), 90000,
  'REQ-044.4 la venta de la cuota nueva lleva el precio nuevo');

-- ------------------------------------------------------------- anular ----
select lives_ok($$ select void_sale((select v from ids where k = 'S3'), 'Se cobró dos veces') $$,
  'REQ-045.7 el dueño anula una cuota sin cortes usados');
select is((pg_temp.period_of('S3')).status, 'voided'::membership_period_status,
  'REQ-045.7 al anular la cuota el periodo desaparece');
insert into ids select 'S7', pg_temp.fee('F1', 90000);
select is((select starts_on from pg_temp.period_of('S7')), (select today from ctx) + 60,
  'REQ-045.4 un periodo anulado no cuenta para encadenar');

-- Un corte del periodo vigente de F1, en una venta activa (el cobro con membresía es T-073)
select auth.test_logout();
with s as (
  insert into sales (business_id, business_day, barber_id, services_total, products_total, total,
                     commission_pct, commission_base, commission_amount, business_amount)
  select biz, today, juan, 0, 0, 0, 60, 25000, 15000, 10000 from ctx
  returning id)
insert into ids select 'CUT', id from s;
insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total,
                        membership_period_id, membership_benefit)
select biz, (select v from ids where k = 'CUT'), 'service', corte, 'Corte', 1, 25000, 25000, 0,
       (pg_temp.period_of('S1')).id, 'cut' from ctx;
select auth.test_login((select owner_u from ctx));

select throws_ok($$ select void_sale((select v from ids where k = 'S1'), 'Error') $$, 'P0004', 'MEMBERSHIP_IN_USE',
  'REQ-045.7 no se anula la cuota de un periodo con cortes usados');
select is((pg_temp.period_of('S1')).status, 'active'::membership_period_status,
  'REQ-045.7 el periodo con cortes usados sigue');
select is((select status from sales where id = (select v from ids where k = 'S1')), 'active'::sale_status,
  'REQ-045.7 y la venta de la cuota sigue activa');
select lives_ok($$ select void_sale((select v from ids where k = 'CUT'), 'Se marcó por error') $$,
  'REQ-045.7 anular la venta del corte (con las reglas de REQ-026)');
select lives_ok($$ select void_sale((select v from ids where k = 'S1'), 'Se cobró por error') $$,
  'REQ-045.7 sin cortes usados en ventas activas, la cuota ya se anula');
select is((pg_temp.period_of('S1')).status, 'voided'::membership_period_status,
  'REQ-045.7 y su periodo desaparece');
select throws_ok($$ select void_sale((select v from ids where k = 'S1'), 'Otra vez') $$, 'P0004', 'ALREADY_VOIDED',
  'REQ-045.7 una cuota anulada no se anula dos veces');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select void_sale((select v from ids where k = 'S6'), 'Error') $$, '42501', null,
  'REQ-045.7 el barbero no anula cuotas');
select auth.test_login((select owner_u from ctx));

-- Una venta normal se sigue anulando igual (sin periodo)
select lives_ok($$ select void_sale((select v from ids where k = 'S4'), 'Prueba') $$,
  'REQ-045.7 la cuota de F4 se anula: el periodo de antes no tiene cortes de este');
select is((pg_temp.period_of('S4')).status, 'voided'::membership_period_status,
  'REQ-045.7 solo el periodo de esa venta se anula');
select is((select status from membership_periods where id = (select v from ids where k = 'P4')),
  'active'::membership_period_status, 'REQ-045.7 el periodo anterior de la familia queda igual');

-- ------------------------------------------------------- día cerrado ----
select auth.test_logout();
insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
select biz, today, '{}', 0, 0, 0, owner_u from ctx;
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select pg_temp.fee('F2', 90000) $$, 'P0009', 'CASH_DAY_CLOSED',
  'REQ-045.1 con el día cerrado no entra una cuota (REQ-026.2)');
select throws_ok($$ select void_sale((select v from ids where k = 'S6'), 'Error') $$, 'P0009', 'CASH_DAY_CLOSED',
  'REQ-045.7 con el día cerrado no se anula una cuota');
select is((pg_temp.period_of('S6')).status, 'active'::membership_period_status,
  'REQ-045.7 el periodo sigue si la anulación no pasó');

select auth.test_logout();
select * from finish();
rollback;
