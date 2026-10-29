-- T-051 · Servicios por barbero (REQ-035, ADR-023): tabla barber_services, valores por defecto,
-- set_barber_services / set_service_barbers y aislamiento por negocio
begin;
select plan(17);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       'b0000000-0000-4000-8000-000000000001'::uuid as juan_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- REQ-035.4 al activarse, cada barbero existente hace todos los servicios existentes
select is(
  (select count(*)::int from barber_services where business_id = (select biz from ctx)),
  (select (select count(*) from barbers where business_id = (select biz from ctx))
        * (select count(*) from services where business_id = (select biz from ctx)))::int,
  'REQ-035.4 los barberos existentes hacen todos los servicios existentes');
select ok(exists (select 1 from barber_services where barber_id = (select juan from ctx)
                 and service_id = (select barba from ctx)),
  'REQ-035.4 Juan hace barba sin que el dueño configure nada');

-- REQ-035.1 barbero nuevo: todos los servicios activos marcados
update services set is_active = false where id = (select barba from ctx);
select auth.test_login((select owner_u from ctx));
insert into barbers (business_id, display_name, phone_e164, commission_pct)
values ((select biz from ctx), 'Estilista', '+573005660001', 50);
select is(
  (select count(*)::int from barber_services bs join barbers b on b.id = bs.barber_id where b.display_name = 'Estilista'),
  (select count(*)::int from services where business_id = (select biz from ctx) and is_active),
  'REQ-035.1 el barbero nuevo viene con todos los servicios activos');
select ok(not exists (select 1 from barber_services where barber_id = (select id from barbers where display_name = 'Estilista')
                 and service_id = (select barba from ctx)),
  'REQ-035.1 un servicio inactivo no se marca al barbero nuevo');

-- REQ-035.2 servicio nuevo: todos los barberos activos marcados
insert into services (business_id, name, duration_min, price) values ((select biz from ctx), 'Cepillado', 30, 25000);
select is(
  (select count(*)::int from barber_services bs join services s on s.id = bs.service_id where s.name = 'Cepillado'),
  (select count(*)::int from barbers where business_id = (select biz from ctx) and is_active),
  'REQ-035.2 el servicio nuevo viene con todos los barberos activos');

-- REQ-035.1 el dueño desmarca: set_barber_services reemplaza el conjunto
select lives_ok($$
  select set_barber_services((select id from barbers where display_name = 'Estilista'),
                             array[(select id from services where name = 'Cepillado')])
$$, 'REQ-035.1 el dueño guarda los servicios que hace el barbero');
select is(
  (select array_agg(s.name) from barber_services bs join services s on s.id = bs.service_id
   join barbers b on b.id = bs.barber_id where b.display_name = 'Estilista'),
  array['Cepillado'], 'REQ-035.1 quedan solo los marcados');

-- REQ-035.2 el dueño cambia quién lo hace desde el servicio
select lives_ok($$
  select set_service_barbers((select id from services where name = 'Cepillado'),
                             array[(select id from barbers where display_name = 'Estilista')])
$$, 'REQ-035.2 el dueño guarda quién hace el servicio');
select ok(not exists (select 1 from barber_services where barber_id = (select juan from ctx)
                 and service_id = (select id from services where name = 'Cepillado'))
          and exists (select 1 from barber_services where barber_id = (select id from barbers where display_name = 'Estilista')
                 and service_id = (select id from services where name = 'Cepillado')),
  'REQ-035.2 solo la estilista hace cepillado; Juan ya no');

-- REQ-035.3 un barbero activo no queda sin servicios
select throws_ok($$
  select set_barber_services((select id from barbers where display_name = 'Estilista'), array[]::uuid[])
$$, 'P0001', 'NO_SERVICES', 'REQ-035.3 no se guarda un barbero activo sin servicios');
select throws_ok($$
  select set_service_barbers((select id from services where name = 'Cepillado'), array[]::uuid[])
$$, 'P0001', 'NO_SERVICES', 'REQ-035.3 quitar el último servicio de un barbero activo (desde el servicio) también falla');

-- REQ-035.5 la persona de manicure es un barbero con solo esos servicios
insert into services (business_id, name, duration_min, price) values ((select biz from ctx), 'Manicure', 40, 20000);
insert into barbers (business_id, display_name, phone_e164, commission_pct)
values ((select biz from ctx), 'Manicurista', '+573005660002', 50);
select set_barber_services((select id from barbers where display_name = 'Manicurista'),
                           array[(select id from services where name = 'Manicure')]);
select ok(exists (select 1 from barber_services where barber_id = (select id from barbers where display_name = 'Manicurista')
                 and service_id = (select id from services where name = 'Manicure'))
          and not exists (select 1 from barber_services where barber_id = (select id from barbers where display_name = 'Manicurista')
                 and service_id = (select corte from ctx)),
  'REQ-035.5 la manicurista es un barbero que solo hace manicure');

-- REQ-035.1 no se mezclan negocios: un servicio de otro negocio no se puede marcar
select auth.test_logout();
insert into auth.users (id, email) values ('0000000e-0000-0000-0000-00000000000e', 'otro@test.local');
select auth.test_login('0000000e-0000-0000-0000-00000000000e');
select create_business('Otra Barbería', 'otra-barberia');
insert into services (business_id, name, duration_min, price)
values ((select id from businesses where slug = 'otra-barberia'), 'Ajeno', 30, 10000);
select throws_ok($$
  select set_barber_services((select juan from ctx), array[(select corte from ctx)])
$$, '42501', null, 'REQ-031.1 el dueño de otro negocio no cambia los servicios de Juan');
select is((select count(*)::int from barber_services where business_id = (select biz from ctx)), 0,
  'REQ-031.1 el dueño de otro negocio no ve barber_services de La 33');
select auth.test_logout();
select auth.test_login((select owner_u from ctx));
select throws_ok($$
  select set_barber_services((select juan from ctx), array[(select id from services where name = 'Ajeno')])
$$, 'P0001', 'SERVICE_NOT_FOUND', 'REQ-035.1 no se marca un servicio de otro negocio');

-- El barbero lee la relación pero no la cambia
select auth.test_logout();
select auth.test_login((select juan_u from ctx));
select ok((select count(*) from barber_services) > 0, 'REQ-035.9 el barbero lee qué servicios hace cada uno');
select throws_ok($$
  select set_barber_services((select juan from ctx), array[(select corte from ctx)])
$$, '42501', null, 'REQ-035.1 el barbero no cambia sus propios servicios (solo el dueño)');
select auth.test_logout();

select * from finish();
rollback;
