-- T-071 · Membresía familiar: plan y familia (REQ-044.1–044.4, REQ-046.1–046.4, ADR-030,
-- design.md §13.1–§13.3). También anonimizar (REQ-018.6) y fusionar (REQ-018.5) con familias.
begin;
select plan(49);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- Ids que se van creando (las funciones se llaman con la sesión del dueño)
create temp table ids (k text primary key, v uuid);
grant all on ids to public;

-- Periodo pagado (lo crea register_membership_fee en T-072): venta mínima en $ 0 y su periodo
create function pg_temp.mk_period(p_membership uuid, p_starts date, p_price int default 80000,
                                  p_cuts int default 4, p_pct int default 20) returns uuid
language plpgsql as $$
declare v_sale uuid; v_id uuid;
begin
  insert into sales (business_id, business_day, services_total, products_total, total)
  values ((select biz from ctx), business_day_bogota(now()), 0, 0, 0) returning id into v_sale;
  insert into membership_periods (business_id, membership_id, sale_id, starts_on, ends_on, cuts_total, price, discount_pct)
  values ((select biz from ctx), p_membership, v_sale, p_starts, p_starts + 29, p_cuts, p_price, p_pct)
  returning id into v_id;
  return v_id;
end $$;

-- ------------------------------------------------------------------ datos ----
select has_table('membership_plans', 'REQ-044.1 existe membership_plans');
select has_table('family_memberships', 'REQ-046.1 existe family_memberships');
select has_table('membership_members', 'REQ-046.1 existe membership_members');
select has_table('membership_periods', 'REQ-044.4 existe membership_periods');
select col_default_is('services', 'counts_for_membership', 'false',
  'REQ-044.1 un servicio nuevo no gasta cortes por defecto');
select is((select array_agg(name order by name) from services
           where business_id = (select biz from ctx) and counts_for_membership),
  array['Corte']::text[], 'REQ-044.1 por defecto solo "Corte" gasta cortes');

-- ------------------------------------------------------------ plan apagado ----
select col_default_is('membership_plans', 'enabled', 'false', 'REQ-044.2 el plan nace apagado');
select is((select count(*)::int from membership_plans where business_id = (select biz from ctx)), 0,
  'REQ-044.2 un negocio existente no tiene plan (apagado)');
select throws_ok($$ insert into membership_plans (business_id, enabled, price) values ((select biz from ctx), true, 80000) $$,
  '23514', null, 'REQ-044.2 la tabla no acepta un plan encendido incompleto');

select auth.test_login((select owner_u from ctx));
select lives_ok($$ select save_membership_plan((select biz from ctx), false, null, null, null) $$,
  'REQ-044.2 el dueño guarda el plan apagado sin valores');
select throws_ok($$ select save_membership_plan((select biz from ctx), true, null, 4, 20) $$,
  'P0004', 'PLAN_INCOMPLETE', 'REQ-044.2 no se enciende sin precio');
select throws_ok($$ select save_membership_plan((select biz from ctx), true, 80000, null, 20) $$,
  'P0004', 'PLAN_INCOMPLETE', 'REQ-044.2 no se enciende sin número de cortes');
select throws_ok($$ select save_membership_plan((select biz from ctx), true, 80000, 4, null) $$,
  'P0004', 'PLAN_INCOMPLETE', 'REQ-044.2 no se enciende sin porcentaje de descuento');
select auth.test_logout();
update services set counts_for_membership = false where business_id = (select biz from ctx);
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select save_membership_plan((select biz from ctx), true, 80000, 4, 20) $$,
  'P0004', 'PLAN_INCOMPLETE', 'REQ-044.2 no se enciende sin ningún servicio que gaste cortes');
select auth.test_logout();
update services set counts_for_membership = true where business_id = (select biz from ctx) and name = 'Corte';
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select save_membership_plan((select biz from ctx), false, 80000, 4, 101) $$,
  '23514', null, 'REQ-044.1 el descuento es un entero de 0 a 100');
select lives_ok($$ select save_membership_plan((select biz from ctx), true, 80000, 4, 20) $$,
  'REQ-044.2 completo, el dueño enciende el plan');
select is((select row(enabled, price, cuts_per_period, discount_pct)::text from membership_plans
           where business_id = (select biz from ctx)),
  row(true, 80000, 4, 20)::text, 'REQ-044.1 un único plan con precio, cortes y descuento');

-- ------------------------------------------------------- solo el dueño ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select save_membership_plan((select biz from ctx), false, null, null, null) $$,
  '42501', 'FORBIDDEN', 'REQ-044.3 el barbero no cambia el plan');
select is((select count(*)::int from membership_plans), 0, 'REQ-044.3 el barbero no ve el plan');
select throws_ok($$ select create_membership((select biz from ctx), '+573209990001', 'Ana') $$,
  '42501', 'FORBIDDEN', 'REQ-046.2 el barbero no crea membresías');
select auth.test_logout();

-- ------------------------------------------------------------- familia ----
select auth.test_login((select owner_u from ctx));
insert into ids select 'famA', create_membership((select biz from ctx), '+573209990001', 'Ana Familia');
select is((select row(c.name, c.privacy_accepted_at is null, c.whatsapp_opt_in_at is null)::text
           from family_memberships f join customers c on c.id = f.holder_customer_id
           where f.id = (select v from ids where k = 'famA')),
  row('Ana Familia', true, true)::text,
  'REQ-046.2 si el celular no tiene ficha se crea con el nombre, sin aviso ni permiso de WhatsApp');
select is((select count(*)::int from membership_members m join family_memberships f on f.id = m.membership_id
           where f.id = (select v from ids where k = 'famA') and m.customer_id = f.holder_customer_id
             and m.removed_at is null),
  1, 'REQ-046.1 el titular es un miembro de su familia');
insert into ids select 'a2', add_membership_member((select v from ids where k = 'famA'), '+573002000001', 'Otro nombre');
select is((select c.name from membership_members m join customers c on c.id = m.customer_id
           where m.id = (select v from ids where k = 'a2')),
  (select name from customers where business_id = (select biz from ctx) and phone_e164 = '+573002000001'),
  'REQ-046.2 un celular con ficha usa esa ficha sin cambiarle el nombre');
select add_membership_member((select v from ids where k = 'famA'), '+573209990003', 'Tres');
insert into ids select 'a4', add_membership_member((select v from ids where k = 'famA'), '+573209990004', 'Cuatro');
select add_membership_member((select v from ids where k = 'famA'), '+573209990005', 'Cinco');
select is((select count(*)::int from membership_members where membership_id = (select v from ids where k = 'famA')
           and removed_at is null), 5, 'REQ-046.1 una familia llega a 5 personas contando al titular');
select throws_ok($$ select add_membership_member((select v from ids where k = 'famA'), '+573209990006', 'Seis') $$,
  'P0004', 'FAMILY_FULL', 'REQ-046.1 la sexta persona no entra');
select throws_ok($$ select add_membership_member((select v from ids where k = 'famA'), '30012', 'Mal') $$,
  'P0004', 'INVALID_PHONE', 'REQ-046.2 el celular debe ser un celular colombiano válido');

-- Quitar: deja el cupo libre y no devuelve nada (REQ-046.4)
select lives_ok($$ select remove_membership_member((select v from ids where k = 'a4')) $$,
  'REQ-046.4 el dueño quita a un miembro');
select isnt((select removed_at from membership_members where id = (select v from ids where k = 'a4')), null,
  'REQ-046.4 quitar deja la fila con removed_at (historial)');
select throws_ok($$ select remove_membership_member((select v from ids where k = 'a4')) $$,
  'P0002', 'MEMBER_NOT_FOUND', 'REQ-046.4 no se quita dos veces');
select lives_ok($$ select add_membership_member((select v from ids where k = 'famA'), '+573209990006', 'Seis') $$,
  'REQ-046.4 con el cupo libre entra otra persona en cualquier momento');
select auth.test_logout();

select auth.test_login((select juan_u from ctx));
select throws_ok($$ select add_membership_member((select v from ids where k = 'famA'), '+573209990007', 'Siete') $$,
  '42501', 'FORBIDDEN', 'REQ-046.2 el barbero no agrega miembros');
select throws_ok($$ select remove_membership_member((select v from ids where k = 'a2')) $$,
  '42501', 'FORBIDDEN', 'REQ-046.2 el barbero no quita miembros');
select is((select count(*)::int from family_memberships) + (select count(*)::int from membership_members)
          + (select count(*)::int from membership_periods), 0,
  'REQ-046.2 el barbero no ve familias, miembros ni periodos');
select auth.test_logout();

-- ------------------------------------------------ una sola familia vigente ----
-- La familia A paga hoy; B es otra familia sin periodo; C tuvo un periodo que ya venció.
select pg_temp.mk_period((select v from ids where k = 'famA'), business_day_bogota(now()));
select auth.test_login((select owner_u from ctx));
insert into ids select 'famB', create_membership((select biz from ctx), '+573209990010', 'Beto');
select throws_ok($$ select add_membership_member((select v from ids where k = 'famB'), '+573209990003', 'Tres') $$,
  'P0004', 'MEMBER_IN_OTHER_FAMILY', 'REQ-046.3 un miembro de otra familia vigente no entra');
select throws_ok($$ select create_membership((select biz from ctx), '+573209990005', 'Cinco') $$,
  'P0004', 'MEMBER_IN_OTHER_FAMILY', 'REQ-046.3 tampoco como titular de una familia nueva');
-- Quitado de A, queda libre (REQ-046.4)
select lives_ok($$ select add_membership_member((select v from ids where k = 'famB'), '+573209990004', 'Cuatro') $$,
  'REQ-046.4 quien salió de una familia vigente entra a otra');
insert into ids select 'famC', create_membership((select biz from ctx), '+573209990020', 'Carla');
insert into ids select 'c2', add_membership_member((select v from ids where k = 'famC'), '+573209990021', 'Ciro');
select auth.test_logout();
select pg_temp.mk_period((select v from ids where k = 'famC'), business_day_bogota(now()) - 40);
select auth.test_login((select owner_u from ctx));
select lives_ok($$ select add_membership_member((select v from ids where k = 'famB'), '+573209990021', 'Ciro') $$,
  'REQ-046.3 un miembro de una familia vencida sí entra');
select isnt((select removed_at from membership_members where id = (select v from ids where k = 'c2')), null,
  'REQ-046.3 y sale de la familia vencida');
select auth.test_logout();
-- Un periodo futuro (renovación pagada por adelantado) también cuenta como vigente
select pg_temp.mk_period((select v from ids where k = 'famC'), business_day_bogota(now()) + 3);
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select add_membership_member((select v from ids where k = 'famB'), '+573209990020', 'Carla') $$,
  'P0004', 'MEMBER_IN_OTHER_FAMILY', 'REQ-046.3 una familia con periodo futuro pagado también retiene');
select auth.test_logout();

-- --------------------------------------------- el plan no toca lo pagado ----
select auth.test_login((select owner_u from ctx));
select lives_ok($$ select save_membership_plan((select biz from ctx), true, 95000, 6, 10) $$,
  'REQ-044.4 el dueño cambia el plan');
select auth.test_logout();
select is((select row(price, cuts_total, discount_pct)::text from membership_periods
           where membership_id = (select v from ids where k = 'famA')),
  row(80000, 4, 20)::text, 'REQ-044.4 el periodo pagado conserva precio, cortes y descuento');

-- ---------------------------------------------------- permisos (ADR-019) ----
select ok(not has_function_privilege('anon', 'create_membership(uuid, text, text)', 'execute')
          and not has_function_privilege('anon', 'save_membership_plan(uuid, boolean, int, int, int)', 'execute'),
  'REQ-044.3 anon no ejecuta las funciones de membresía');
select ok(has_function_privilege('authenticated', 'save_membership_plan(uuid, boolean, int, int, int)', 'execute')
          and has_function_privilege('authenticated', 'create_membership(uuid, text, text)', 'execute')
          and has_function_privilege('authenticated', 'add_membership_member(uuid, text, text)', 'execute')
          and has_function_privilege('authenticated', 'remove_membership_member(uuid)', 'execute'),
  'REQ-046.2 el personal las ejecuta (cada una valida al dueño)');
select auth.test_login((select owner_u from ctx));
select throws_ok($$ insert into family_memberships (business_id, holder_customer_id)
                    values ((select biz from ctx), (select holder_customer_id from family_memberships limit 1)) $$,
  '42501', null, 'REQ-046.2 ni el dueño escribe directo en las tablas: solo con las funciones');
select ok((select count(*) from family_memberships) >= 3 and (select count(*) from membership_periods) >= 3,
  'REQ-044.3 el dueño ve familias y periodos');
select auth.test_logout();

-- ------------------------------------------- anonimizar y fusionar fichas ----
select anonymize_customer((select id from customers where business_id = (select biz from ctx) and phone_e164 = '+573209990003'));
select is((select count(*)::int from membership_members m join customers c on c.id = m.customer_id
           where c.name = 'Cliente eliminado' and m.removed_at is null and m.membership_id = (select v from ids where k = 'famA')),
  0, 'REQ-018.6 eliminar la ficha la saca de su familia');

-- Fusionar: Carla (familia C, periodo futuro) con Ana (familia A, vigente) → no
select throws_ok($$ select merge_customers(
    (select id from customers where business_id = (select biz from ctx) and phone_e164 = '+573209990001'),
    (select id from customers where business_id = (select biz from ctx) and phone_e164 = '+573209990020')) $$,
  'P0004', 'BOTH_IN_FAMILIES', 'REQ-018.5 no se fusionan dos fichas en familias vigentes distintas');
-- Fusionar: una ficha suelta se queda con la familia (y la titularidad) de la otra
insert into customers (business_id, phone_e164, name) values ((select biz from ctx), '+573209990099', 'Carla 2');
select merge_customers((select id from customers where business_id = (select biz from ctx) and phone_e164 = '+573209990099'),
                       (select id from customers where business_id = (select biz from ctx) and phone_e164 = '+573209990020'));
select is((select c.phone_e164 from family_memberships f join customers c on c.id = f.holder_customer_id
           where f.id = (select v from ids where k = 'famC')),
  '+573209990099', 'REQ-018.5 la ficha que se conserva queda de titular');
select is((select count(*)::int from membership_members m join customers c on c.id = m.customer_id
           where c.phone_e164 = '+573209990099' and m.removed_at is null and m.membership_id = (select v from ids where k = 'famC')),
  1, 'REQ-018.5 y de miembro de la familia');

select * from finish();
rollback;
