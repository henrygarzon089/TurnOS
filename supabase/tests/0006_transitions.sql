begin;
select plan(30);

-- Contexto: negocio del seed, dueño y dos barberos (Juan, Pedro) con usuarios
create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

update barbers set status = 'available', present_day = current_date where id in (select juan from ctx union select pedro from ctx);

-- Turnos
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
select '10000000-0000-0000-0000-000000000001', biz, 'T1', '+573005551001', corte from ctx;
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id)
select '10000000-0000-0000-0000-000000000002', biz, 'T2', '+573005551002', corte, juan from ctx;
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
select '10000000-0000-0000-0000-000000000003', biz, 'T3', '+573005551003', corte from ctx;
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
select '10000000-0000-0000-0000-000000000004', biz, 'T4', '+573005551004', corte from ctx;
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
select '10000000-0000-0000-0000-000000000005', biz, 'T5', '+573005551005', corte from ctx;

-- ------------------------------------------------ cliente (sin sesión) ----
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000005', 'cancelled', 'customer')),
  'cancelled', 'REQ-005.2 waiting → cancelled por el cliente');
select is((select cancel_reason::text from tickets where id = '10000000-0000-0000-0000-000000000005'),
  'customer', 'REQ-005.2 motivo = customer');
select throws_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000001', 'called', 'customer') $$,
  '42501', null, 'REQ-005 el cliente no puede llamar turnos');
select throws_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000001', 'in_service', 'customer') $$,
  'P0004', null, 'waiting → in_service es una transición inválida');

-- ------------------------------------------------ barbero Juan ----
select auth.test_login((select juan_u from ctx));
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000001', 'called', 'barber')),
  'called', 'REQ-007.1 waiting → called por el barbero');
select is((select assigned_barber_id from tickets where id = '10000000-0000-0000-0000-000000000001'),
  (select juan from ctx), 'REQ-007.1 queda asignado al barbero que llamó');
select isnt((select called_at from tickets where id = '10000000-0000-0000-0000-000000000001'), null,
  'REQ-007.1 called_at registrado');
-- Idempotente
select lives_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000001', 'called', 'barber') $$,
  'REQ-011.4 repetir la misma transición no falla');
select is((select count(*)::int from ticket_events where ticket_id = '10000000-0000-0000-0000-000000000001'),
  2, 'REQ-011.4 ...y no duplica el evento (creación + llamado)');
-- Un turno a la vez
select throws_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000002', 'called', 'barber') $$,
  'P0005', null, 'REQ-007.5 BARBER_BUSY: ya tiene un turno llamado');
-- called → in_service
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000001', 'in_service', 'barber')),
  'in_service', 'REQ-007.3 called → in_service');
select is((select status::text from barbers where id = (select juan from ctx)), 'busy',
  'REQ-007.3 el barbero pasa a busy');
-- in_service → done
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000001', 'done', 'barber')),
  'done', 'REQ-007.4 in_service → done');
select is((select status::text from barbers where id = (select juan from ctx)), 'available',
  'REQ-007.4 el barbero vuelve a available');
select is((select payment_status::text from tickets where id = '10000000-0000-0000-0000-000000000001'), 'pending',
  'REQ-023.6 al terminar queda cobro pendiente');
-- Estado final: no se puede mover
select throws_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000001', 'waiting', 'barber') $$,
  'P0004', null, 'done es final');
-- called → no_show
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000002', 'called', 'barber')),
  'called', 'Juan llama a T2');
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000002', 'no_show', 'barber')),
  'no_show', 'REQ-008.2 called → no_show');
select auth.test_logout();

-- ------------------------------------------------ otro barbero no toca lo ajeno ----
select auth.test_login((select juan_u from ctx));
select transition_ticket('10000000-0000-0000-0000-000000000003', 'called', 'barber');
select auth.test_logout();
select auth.test_login((select pedro_u from ctx));
select throws_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000003', 'in_service', 'barber') $$,
  '42501', null, 'REQ-007 un barbero no opera el turno asignado a otro');
select throws_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000003', 'no_show', 'barber') $$,
  '42501', null, 'REQ-007 tampoco puede marcar no llegó en turno ajeno');
select auth.test_logout();

-- ------------------------------------------------ dueño ----
select auth.test_login((select owner_u from ctx));
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000003', 'waiting', 'owner')),
  'waiting', 'REQ-012.2 el dueño devuelve un turno llamado a la fila');
select is((select assigned_barber_id from tickets where id = '10000000-0000-0000-0000-000000000003'), null,
  'REQ-012.2 ...sin barbero asignado');
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000003', 'called', 'owner', null, (select pedro from ctx))),
  'called', 'REQ-012.2 el dueño llama con un barbero específico');
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000003', 'in_service', 'owner')),
  'in_service', 'REQ-012.2 el dueño marca en servicio');
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000003', 'cancelled', 'owner', 'business')),
  'cancelled', 'REQ-012.2 el dueño cancela en servicio con motivo');
select is((select status::text from barbers where id = (select pedro from ctx)), 'available',
  'cancelar en servicio libera al barbero');
select is((select status::text from transition_ticket('10000000-0000-0000-0000-000000000004', 'cancelled', 'owner')),
  'cancelled', 'REQ-012.2 el dueño cancela en espera');
select is((select cancel_reason::text from tickets where id = '10000000-0000-0000-0000-000000000004'), 'business',
  'motivo por defecto del dueño = business');
select auth.test_logout();

-- ------------------------------------------------ sistema (cierre) ----
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
select '10000000-0000-0000-0000-000000000006', biz, 'T6', '+573005551006', corte from ctx;
select is((select cancel_reason::text from transition_ticket('10000000-0000-0000-0000-000000000006', 'cancelled', 'system')),
  'closing', 'REQ-014.1 el sistema cancela con motivo closing');
select throws_ok(
  $$ select transition_ticket('10000000-0000-0000-0000-000000000006', 'called', 'system') $$,
  'P0004', null, 'cancelled es final');

select * from finish();
rollback;
