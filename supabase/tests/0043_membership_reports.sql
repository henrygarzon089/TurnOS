-- T-074 · "Membresías" del dueño: "Vencen esta semana" y la plantilla de renovación
-- (REQ-048.4, design.md §13.1, §13.3). 0043_membership_reports.sql y 0044_membership_template.sql.
-- T-075 · "Mi turno" (get_ticket_by_token → membership, REQ-048.1) y la etiqueta "Membresía" de las
-- filas (membership_member_ids, REQ-048.2).
-- T-076 · caja, cierre y semana con los ejemplos E–G (REQ-048.3, design.md §13.4) y el aviso de
-- privacidad por defecto (REQ-048.5).
begin;
select plan(42);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

-- Periodo pagado (como register_membership_fee): venta mínima y su periodo de 30 días
create function pg_temp.mk_period(p_membership uuid, p_starts date,
                                  p_status membership_period_status default 'active') returns uuid
language plpgsql as $$
declare v_sale uuid; v_id uuid;
begin
  insert into sales (business_id, business_day, services_total, products_total, total)
  values ((select biz from ctx), business_day_bogota(now()), 0, 0, 0) returning id into v_sale;
  insert into membership_periods (business_id, membership_id, sale_id, starts_on, ends_on, cuts_total, price,
                                  discount_pct, status)
  values ((select biz from ctx), p_membership, v_sale, p_starts, p_starts + 29, 4, 80000, 20, p_status)
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------ plantilla ----
select ok('membership_renewal' = any (enum_range(null::message_template_key)::text[]),
  'REQ-048.4 existe la plantilla "membership_renewal"');
select is((select body from message_templates where business_id = (select biz from ctx) and key = 'membership_renewal'),
  'Hola {nombre}, la membresía familiar en {negocio} vence el {fecha}. Renuévala en tu próxima visita.',
  'REQ-048.4 el negocio del seed tiene la plantilla de renovación');

insert into auth.users (id, email) values ('b0000000-0000-4000-8000-0000000000f1', 'nuevo@test.local');
select auth.test_login('b0000000-0000-4000-8000-0000000000f1');
insert into ids select 'nuevo', create_business('Barbería Nueva', 'barberia-nueva-t074');
select auth.test_logout();
select is((select body from message_templates where business_id = (select v from ids where k = 'nuevo')
           and key = 'membership_renewal'),
  'Hola {nombre}, la membresía familiar en {negocio} vence el {fecha}. Renuévala en tu próxima visita.',
  'REQ-048.4 un negocio nuevo nace con la plantilla de renovación (create_business)');
select is((select count(*)::int from message_templates where business_id = (select v from ids where k = 'nuevo')),
  5, 'REQ-048.4 create_business conserva las otras cuatro plantillas');

-- ---------------------------------------------------- vencen esta semana ----
select has_function('memberships_expiring', array['uuid', 'date'], 'REQ-048.4 existe memberships_expiring');

update services set counts_for_membership = true where business_id = (select biz from ctx) and name = 'Corte';
select auth.test_login((select owner_u from ctx));
select save_membership_plan((select biz from ctx), true, 80000, 4, 20);
insert into ids select 'hoy',     create_membership((select biz from ctx), '+573209991101', 'Hilda Hoy');
insert into ids select 'seis',    create_membership((select biz from ctx), '+573209991102', 'Sergio Seis');
insert into ids select 'siete',   create_membership((select biz from ctx), '+573209991103', 'Silvia Siete');
insert into ids select 'renov',   create_membership((select biz from ctx), '+573209991104', 'Rosa Renovada');
insert into ids select 'vencida', create_membership((select biz from ctx), '+573209991105', 'Víctor Vencido');
insert into ids select 'anulada', create_membership((select biz from ctx), '+573209991106', 'Ana Anulada');
insert into ids select 'nocont',  create_membership((select biz from ctx), '+573209991107', 'Nora No Contactar');
insert into ids select 'sinper',  create_membership((select biz from ctx), '+573209991108', 'Saúl Sin Periodo');
select auth.test_logout();

select pg_temp.mk_period((select v from ids where k = 'hoy'),     (select today from ctx) - 29);  -- termina hoy
select pg_temp.mk_period((select v from ids where k = 'seis'),    (select today from ctx) - 23);  -- hoy + 6
select pg_temp.mk_period((select v from ids where k = 'siete'),   (select today from ctx) - 22);  -- hoy + 7
select pg_temp.mk_period((select v from ids where k = 'renov'),   (select today from ctx) - 27);  -- hoy + 2 …
select pg_temp.mk_period((select v from ids where k = 'renov'),   (select today from ctx) + 3);   -- … y la siguiente pagada
select pg_temp.mk_period((select v from ids where k = 'vencida'), (select today from ctx) - 30);  -- terminó ayer
select pg_temp.mk_period((select v from ids where k = 'anulada'), (select today from ctx) - 28, 'voided');
select pg_temp.mk_period((select v from ids where k = 'nocont'),  (select today from ctx) - 27);
update customers set do_not_contact = true where business_id = (select biz from ctx) and phone_e164 = '+573209991107';

select auth.test_login((select owner_u from ctx));
select is((select array_agg(membership_id order by ends_on, name) from memberships_expiring((select biz from ctx))),
  array[(select v from ids where k = 'hoy'), (select v from ids where k = 'seis')],
  'REQ-048.4 lista las que vencen hoy y en los 6 días siguientes, la más próxima primero');
select is((select row(name, phone_e164, ends_on)::text from memberships_expiring((select biz from ctx))
           where membership_id = (select v from ids where k = 'seis')),
  row('Sergio Seis', '+573209991102', (select today from ctx) + 6)::text,
  'REQ-048.4 trae el titular, su celular y el día en que vence');
select ok(not exists (select 1 from memberships_expiring((select biz from ctx))
                      where membership_id = (select v from ids where k = 'siete')),
  'REQ-048.4 la que vence en 7 días todavía no sale');
select ok(not exists (select 1 from memberships_expiring((select biz from ctx))
                      where membership_id = (select v from ids where k = 'renov')),
  'REQ-048.4 la que ya pagó el periodo siguiente no sale (REQ-045.4)');
select ok(not exists (select 1 from memberships_expiring((select biz from ctx))
                      where membership_id = (select v from ids where k = 'vencida')),
  'REQ-048.4 la que ya venció no sale (REQ-045.6)');
select ok(not exists (select 1 from memberships_expiring((select biz from ctx))
                      where membership_id in ((select v from ids where k = 'anulada'), (select v from ids where k = 'sinper'))),
  'REQ-048.4 un periodo anulado o una familia sin periodo no salen');
select ok(not exists (select 1 from memberships_expiring((select biz from ctx))
                      where membership_id = (select v from ids where k = 'nocont')),
  'REQ-048.4 un titular marcado "No contactar" no sale (REQ-020.5)');
select is((select count(*)::int from memberships_expiring((select biz from ctx), (select today from ctx) + 4)), 2,
  'REQ-048.4 contado desde otro día (hoy + 4): "seis" y "siete"');
select auth.test_logout();

-- El titular quitado de su familia: el aviso va a quien siga en la familia como titular
select auth.test_login((select owner_u from ctx));
select remove_membership_member((select id from membership_members where membership_id = (select v from ids where k = 'seis')));
select ok(not exists (select 1 from memberships_expiring((select biz from ctx))
                      where membership_id = (select v from ids where k = 'seis')),
  'REQ-048.4 una familia cuyo titular ya no es miembro no sale (no hay a quién escribirle)');
select auth.test_logout();

-- Anonimizar al titular lo saca (REQ-018.6)
select auth.test_login((select owner_u from ctx));
select anonymize_customer((select id from customers where business_id = (select biz from ctx) and phone_e164 = '+573209991101'));
select ok(not exists (select 1 from memberships_expiring((select biz from ctx))
                      where membership_id = (select v from ids where k = 'hoy')),
  'REQ-048.4 un titular eliminado (anonimizado) no sale');
select auth.test_logout();

-- ------------------------------------------------------------ permisos ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select * from memberships_expiring((select biz from ctx)) $$,
  '42501', 'FORBIDDEN', 'REQ-048.4 el barbero no ve las membresías por vencer');
select auth.test_logout();
select ok(not has_function_privilege('anon', 'memberships_expiring(uuid, date)', 'execute')
          and has_function_privilege('authenticated', 'memberships_expiring(uuid, date)', 'execute')
          and has_function_privilege('service_role', 'memberships_expiring(uuid, date)', 'execute'),
  'REQ-048.4 la ejecuta el dueño (y service_role), nunca anon (ADR-019)');
select auth.test_login('b0000000-0000-4000-8000-0000000000f1');
select throws_ok($$ select * from memberships_expiring((select biz from ctx)) $$,
  '42501', 'FORBIDDEN', 'REQ-048.4 el dueño de otro negocio no ve las de La 33');
select auth.test_logout();

-- ================================================= T-075 · "Mi turno" y filas ----
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);

-- Familia de Mario (titular) y Mía con 4 cortes; Tomás no es miembro
select auth.test_login((select owner_u from ctx));
insert into ids select 'mi', create_membership((select biz from ctx), '+573209992201', 'Mario Miembro');
select add_membership_member((select v from ids where k = 'mi'), '+573209992202', 'Mía Miembro');
select auth.test_logout();
select pg_temp.mk_period((select v from ids where k = 'mi'), (select today from ctx) - 5);  -- vence hoy + 24

create function pg_temp.cust(p_phone text) returns uuid language sql as $$
  select id from customers where business_id = (select biz from ctx) and phone_e164 = p_phone
$$;
create function pg_temp.token(p_name text, p_phone text) returns text
language plpgsql as $$
begin
  perform join_queue('la-33', p_name, p_phone,
                     (select id from services where business_id = (select biz from ctx) and name = 'Corte'), null, 1);
  return (select public_token from tickets where customer_phone_e164 = p_phone and status = 'waiting');
end $$;
insert into ids select 'mia_c', pg_temp.cust('+573209992202');
create temp table tok (k text primary key, v text);
grant all on tok to public;
insert into tok values ('mia', pg_temp.token('Mía Miembro', '+573209992202')),
                       ('tomas', pg_temp.token('Tomás Turno', '+573209992203')),
                       ('mario', pg_temp.token('Mario Miembro', '+573209992201'));

-- Mario ya usó un corte (venta 'cut' sin turno)
select register_sale((select biz from ctx), null,
  (select id from barbers where business_id = (select biz from ctx) and display_name = 'Juan'),
  jsonb_build_array(jsonb_build_object('kind', 'service', 'qty', 1, 'membership', true,
    'ref_id', (select id from services where business_id = (select biz from ctx) and name = 'Corte'))),
  '[]'::jsonb, pg_temp.cust('+573209992201'));

select is((select get_ticket_by_token((select v from tok where k = 'mia')) -> 'membership'),
  jsonb_build_object('cutsTotal', 4, 'cutsLeft', 3, 'endsOn', (select today from ctx) + 24, 'discountPct', 20),
  'REQ-048.1 "Mi turno" de un miembro trae los cortes que quedan de la familia, el total y el vencimiento');
select ok(not (get_ticket_by_token((select v from tok where k = 'mia')) -> 'membership' ?| array['membershipId', 'periodId', 'members']),
  'REQ-048.1 "Mi turno" no trae ids de la familia ni datos de otros miembros');
select is((select get_ticket_by_token((select v from tok where k = 'tomas')) -> 'membership'), 'null'::jsonb,
  'REQ-048.1 "Mi turno" de quien no es miembro no trae membresía');

-- REQ-048.2 filas: el barbero ve quién es miembro con periodo vigente
select has_function('membership_member_ids', array['uuid', 'uuid[]'], 'REQ-048.2 existe membership_member_ids');
select auth.test_login((select juan_u from ctx));
select is(membership_member_ids((select biz from ctx),
            array[pg_temp.cust('+573209992202'), pg_temp.cust('+573209992203'), pg_temp.cust('+573209992201')]),
  (select array_agg(x order by x) from unnest(array[pg_temp.cust('+573209992202'), pg_temp.cust('+573209992201')]) x),
  'REQ-048.2 la fila del barbero marca a los miembros con periodo vigente y no a los demás');
select is(membership_member_ids((select biz from ctx), array[pg_temp.cust('+573209991105')]), '{}'::uuid[],
  'REQ-048.2 un miembro con el periodo vencido no lleva la etiqueta');
select auth.test_logout();

select auth.test_login('b0000000-0000-4000-8000-0000000000f1');
select throws_ok($$ select membership_member_ids((select biz from ctx), array[(select v from ids where k = 'mia_c')]) $$,
  '42501', 'FORBIDDEN', 'REQ-048.2 el dueño de otro negocio no puede preguntar por los miembros de La 33');
select auth.test_logout();
select ok(not has_function_privilege('anon', 'membership_member_ids(uuid, uuid[])', 'execute')
          and has_function_privilege('authenticated', 'membership_member_ids(uuid, uuid[])', 'execute'),
  'REQ-048.2 membership_member_ids no se abre a anon (ADR-019)');

-- Quitar a Mía de la familia: deja de ser miembro en "Mi turno" y en la fila
select auth.test_login((select owner_u from ctx));
select remove_membership_member((select id from membership_members where customer_id = (select v from ids where k = 'mia_c')));
select is(membership_member_ids((select biz from ctx), array[(select v from ids where k = 'mia_c')]), '{}'::uuid[],
  'REQ-048.2 quien salió de la familia ya no lleva la etiqueta');
select auth.test_logout();
select is((select get_ticket_by_token((select v from tok where k = 'mia')) -> 'membership'), 'null'::jsonb,
  'REQ-048.1 quien salió de la familia ya no ve la membresía en "Mi turno"');

-- Plan apagado (REQ-044.5): nadie es miembro
select isnt((select get_ticket_by_token((select v from tok where k = 'mario')) -> 'membership'), 'null'::jsonb,
  'REQ-048.1 Mario (titular) sigue viendo la membresía mientras el plan está encendido');
update membership_plans set enabled = false where business_id = (select biz from ctx);
select auth.test_login((select owner_u from ctx));
select is(membership_member_ids((select biz from ctx), array[pg_temp.cust('+573209992201')]), '{}'::uuid[],
  'REQ-048.2 con el plan apagado no hay etiqueta "Membresía"');
select auth.test_logout();
select is((select get_ticket_by_token((select v from tok where k = 'mario')) -> 'membership'), 'null'::jsonb,
  'REQ-048.1 con el plan apagado "Mi turno" no trae membresía');

-- ================================================ T-076 · caja, cierre y semana ----
-- Ejemplos E–G de design.md §13.4. La caja de hoy ya trae ventas (seed, el corte de Mario):
-- se compara contra una foto de antes de cada paso.
update membership_plans set enabled = true where business_id = (select biz from ctx);
update barbers set commission_pct = 60 where business_id = (select biz from ctx) and display_name = 'Juan';  -- como §13.4
create temp table snap (k text primary key, v jsonb);
grant all on snap to public;
create function pg_temp.take(p_k text) returns void language sql as $$
  insert into snap values (p_k || '_c', cash_day_summary((select biz from ctx))),
                          (p_k || '_w', weekly_summary((select biz from ctx)))
$$;
-- Lo que cambió en la caja (o la semana) desde la foto p_k
create function pg_temp.delta(p_k text, p_week boolean default false) returns jsonb
language sql as $$
  with a as (select v from snap where k = p_k || case when p_week then '_w' else '_c' end),
       b as (select case when p_week then weekly_summary((select biz from ctx)) else cash_day_summary((select biz from ctx)) end as v)
  select jsonb_build_object(
    'total', (b.v ->> case when p_week then 'sold' else 'total' end)::int - (a.v ->> case when p_week then 'sold' else 'total' end)::int,
    'commission', case when p_week then null else (b.v ->> 'commission')::int - (a.v ->> 'commission')::int end,
    'membershipFees', (b.v ->> 'membershipFees')::int - (a.v ->> 'membershipFees')::int,
    'cutsCount', (b.v -> 'membershipCuts' ->> 'count')::int - (a.v -> 'membershipCuts' ->> 'count')::int,
    'cutsListValue', (b.v -> 'membershipCuts' ->> 'listValue')::int - (a.v -> 'membershipCuts' ->> 'listValue')::int)
  from a, b
$$;
create function pg_temp.cut_sale(p_phone text, p_payments jsonb default '[]') returns uuid
language sql as $$
  select (register_sale((select biz from ctx), null,
    (select id from barbers where business_id = (select biz from ctx) and display_name = 'Juan'),
    jsonb_build_array(jsonb_build_object('kind', 'service', 'qty', 1, 'membership', true,
      'ref_id', (select id from services where business_id = (select biz from ctx) and name = 'Corte'))),
    p_payments, pg_temp.cust(p_phone))).id
$$;

select pg_temp.take('e0');
select ok((select v from snap where k = 'e0_c') ?& array['membershipFees', 'membershipCuts']
          and (select v from snap where k = 'e0_w') ?& array['membershipFees', 'membershipCuts']
          and (select v -> 'membershipCuts' from snap where k = 'e0_c') ?& array['count', 'listValue'],
  'REQ-048.3 la caja y la semana traen aparte las cuotas y los cortes de membresía (cantidad y valor de lista)');

-- Ejemplo E: Mario (le quedan cortes) se corta con Juan (60 %): $ 0, comisión $ 15.000
insert into ids select 'venta_e', pg_temp.cut_sale('+573209992201');
select is(pg_temp.delta('e0'),
  '{"total": 0, "commission": 15000, "membershipFees": 0, "cutsCount": 1, "cutsListValue": 25000}'::jsonb,
  'REQ-048.3 ejemplo E: un corte de membresía suma "Cortes de membresía: 1 · $ 25.000", $ 0 al total y su comisión');
select is((select row(x ->> 'items', x ->> 'methods', (x ->> 'total')::int)::text
           from jsonb_array_elements(cash_day_summary((select biz from ctx)) -> 'sales') x
           where (x ->> 'id')::uuid = (select v from ids where k = 'venta_e')),
  row('Corte (membresía)', 'Sin pago (membresía)', 0)::text,
  'REQ-048.3 en las ventas del día el corte se ve como de membresía y sin pago');

-- Ejemplo F: Fabio ya gastó su único corte (hace 8 días): 20 % de descuento, comisión sobre lista
select auth.test_login((select owner_u from ctx));
insert into ids select 'agot', create_membership((select biz from ctx), '+573209993301', 'Fabio Agotado');
select auth.test_logout();
insert into ids select 'agot_p', pg_temp.mk_period((select v from ids where k = 'agot'), (select today from ctx) - 10);
update membership_periods set cuts_total = 1 where id = (select v from ids where k = 'agot_p');
with s as (
  insert into sales (business_id, business_day, customer_id, services_total, products_total, total)
  values ((select biz from ctx), (select today from ctx) - 8, pg_temp.cust('+573209993301'), 0, 0, 0) returning id)
insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total,
                        membership_benefit, membership_period_id)
select (select biz from ctx), s.id, 'service', (select id from services where business_id = (select biz from ctx) and name = 'Corte'),
       'Corte', 1, 25000, 25000, 0, 'cut', (select v from ids where k = 'agot_p')
from s;

select pg_temp.take('f0');
select pg_temp.cut_sale('+573209993301', '[{"method": "cash", "amount": 20000}]');
select is(pg_temp.delta('f0'),
  '{"total": 20000, "commission": 15000, "membershipFees": 0, "cutsCount": 0, "cutsListValue": 0}'::jsonb,
  'REQ-048.3 ejemplo F: el descuento de membresía no es un corte; entra al total con la comisión sobre lista');

-- Ejemplo G: cuota de $ 80.000 en efectivo, sin barbero ni comisión
select pg_temp.take('g0');
select auth.test_login((select owner_u from ctx));
insert into ids select 'venta_g', (register_membership_fee((select v from ids where k = 'mi'),
  '[{"method": "cash", "amount": 80000}]')).id;
select auth.test_logout();
select is(pg_temp.delta('g0'),
  '{"total": 80000, "commission": 0, "membershipFees": 80000, "cutsCount": 0, "cutsListValue": 0}'::jsonb,
  'REQ-048.3 ejemplo G: "Cuotas de membresía: $ 80.000", en el total y sin comisión');
select is((select row(x ->> 'items', x ->> 'methods', x ->> 'barberName')::text
           from jsonb_array_elements(cash_day_summary((select biz from ctx)) -> 'sales') x
           where (x ->> 'id')::uuid = (select v from ids where k = 'venta_g')),
  row('Membresía familiar', 'Efectivo', null)::text,
  'REQ-048.3 la cuota sale en las ventas del día, sin barbero');

-- Semana: E + F + G (la venta de hace 8 días es de otra semana)
select is(pg_temp.delta('e0', true),
  '{"total": 100000, "commission": null, "membershipFees": 80000, "cutsCount": 1, "cutsListValue": 25000}'::jsonb,
  'REQ-048.3 el resumen semanal muestra aparte las cuotas y los cortes de membresía (ejemplos E–G)');

-- Anular el corte lo saca de la caja (REQ-026.1)
select pg_temp.take('v0');
select auth.test_login((select owner_u from ctx));
select void_sale((select v from ids where k = 'venta_e'), 'Prueba');
select auth.test_logout();
select is(pg_temp.delta('v0') - 'total',
  '{"commission": -15000, "membershipFees": 0, "cutsCount": -1, "cutsListValue": -25000}'::jsonb,
  'REQ-048.3 un corte anulado sale de los cortes de membresía y de la comisión');

-- El cierre guarda las dos líneas en su foto
select auth.test_login((select owner_u from ctx));
select close_cash_day((select biz from ctx), (select today from ctx),
                      (cash_day_summary((select biz from ctx)) ->> 'cashExpected')::int);
select is((select jsonb_build_object('fees', totals -> 'membershipFees', 'cuts', totals -> 'membershipCuts')
           from cash_closures where business_id = (select biz from ctx) and business_day = (select today from ctx)
             and status = 'active'),
  (select jsonb_build_object('fees', s -> 'membershipFees', 'cuts', s -> 'membershipCuts')
   from cash_day_summary((select biz from ctx)) s),
  'REQ-048.3 el cierre del día guarda las cuotas y los cortes de membresía');
select auth.test_logout();

-- ===================================================== aviso de privacidad ----
select ok(default_privacy_text('La 33') ~ 'titular' and default_privacy_text('La 33') ~ 'celular de los miembros'
          and default_privacy_text('La 33') ~ 'membresía',
  'REQ-048.5 el aviso por defecto dice que el titular entrega el celular de los miembros para la membresía');
select ok((select body from privacy_policy_versions where business_id = (select v from ids where k = 'nuevo')
           and version = 1) ~ 'celular de los miembros',
  'REQ-048.5 un negocio nuevo nace con el párrafo de la membresía en su aviso');

select * from finish();
rollback;
