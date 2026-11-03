-- T-074 · "Membresías" del dueño: "Vencen esta semana" y la plantilla de renovación
-- (REQ-048.4, design.md §13.1, §13.3). 0043_membership_reports.sql y 0044_membership_template.sql.
begin;
select plan(18);

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

select * from finish();
rollback;
