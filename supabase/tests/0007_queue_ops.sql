begin;
select plan(23);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

update barbers set status = 'available', present_day = current_date
where id in (select juan from ctx union select pedro from ctx union select luis from ctx);

-- Fila: A(any) B(pref Juan) C(any) D(pref Luis) E(any)
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id) values
  ('20000000-0000-0000-0000-00000000000a', (select biz from ctx), 'A', '+573005552001', (select corte from ctx), null),
  ('20000000-0000-0000-0000-00000000000b', (select biz from ctx), 'B', '+573005552002', (select corte from ctx), (select juan from ctx)),
  ('20000000-0000-0000-0000-00000000000c', (select biz from ctx), 'C', '+573005552003', (select corte from ctx), null),
  ('20000000-0000-0000-0000-00000000000d', (select biz from ctx), 'D', '+573005552004', (select corte from ctx), (select luis from ctx)),
  ('20000000-0000-0000-0000-00000000000e', (select biz from ctx), 'E', '+573005552005', (select corte from ctx), null);

-- ------------------------------------------------ lista del barbero ----
select is(
  (select string_agg(customer_name, ',' order by queue_order) from barber_queue_tickets((select juan from ctx))),
  'A,B,C,E', 'REQ-006.1 lista de Juan: sus preferidos + cualquiera, por llegada');
select is(
  (select string_agg(customer_name, ',' order by queue_order) from barber_queue_tickets((select pedro from ctx))),
  'A,C,E', 'REQ-006.1 lista de Pedro: solo cualquiera');

-- ------------------------------------------------ call_next ----
select auth.test_login((select pedro_u from ctx));
select is((select customer_name from call_next()), 'A', 'REQ-007.1 Pedro llama al primero de su lista (A)');
select throws_ok($$ select call_next() $$, 'P0005', null, 'REQ-007.5 Pedro no puede llamar otro con uno abierto');
select auth.test_logout();

select auth.test_login((select juan_u from ctx));
select is((select customer_name from call_next()), 'B', 'REQ-006.5 A ya fue tomado por Pedro; Juan recibe B');
select auth.test_logout();

select auth.test_login((select luis_u from ctx));
select is((select customer_name from call_next()), 'C', 'Luis recibe C (D lo eligió pero C llegó antes y es cualquiera)');
select transition_ticket('20000000-0000-0000-0000-00000000000c', 'in_service', 'barber');
select transition_ticket('20000000-0000-0000-0000-00000000000c', 'done', 'barber');
select is((select customer_name from call_next()), 'D', 'Luis sigue con D');
select transition_ticket('20000000-0000-0000-0000-00000000000d', 'no_show', 'barber');
select is((select customer_name from call_next()), 'E', 'Luis sigue con E');
select transition_ticket('20000000-0000-0000-0000-00000000000e', 'no_show', 'barber');
select throws_ok($$ select call_next() $$, 'P0006', null, 'REQ-007.6 NO_TICKETS cuando no hay nadie');
select auth.test_logout();

-- Barbero en pausa no puede llamar
select auth.test_login((select owner_u from ctx));
select transition_ticket('20000000-0000-0000-0000-00000000000a', 'in_service', 'owner');
select transition_ticket('20000000-0000-0000-0000-00000000000a', 'done', 'owner');
select auth.test_logout();
update barbers set status = 'paused' where id = (select pedro from ctx);
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
values ('20000000-0000-0000-0000-00000000000f', (select biz from ctx), 'F', '+573005552006', (select corte from ctx));
select auth.test_login((select pedro_u from ctx));
select throws_ok($$ select call_next() $$, 'P0005', null, 'REQ-010.1 en pausa no se llama');
select auth.test_logout();

-- ------------------------------------------------ set_barber_status ----
-- Clientes que eligieron a Juan, en espera
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id) values
  ('20000000-0000-0000-0000-000000000010', (select biz from ctx), 'G', '+573005552007', (select corte from ctx), (select juan from ctx)),
  ('20000000-0000-0000-0000-000000000011', (select biz from ctx), 'H', '+573005552008', (select corte from ctx), (select juan from ctx));
-- Juan tiene B llamado: no puede pausar
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select set_barber_status((select juan from ctx), 'paused') $$, 'P0005', null,
  'REQ-010.5 no puede pausar con turno llamado');
select transition_ticket('20000000-0000-0000-0000-00000000000b', 'no_show', 'barber');
select is((select status::text from set_barber_status((select juan from ctx), 'paused', true)), 'paused',
  'REQ-010.1 Juan se pausa reasignando');
select is((select count(*)::int from tickets where id in ('20000000-0000-0000-0000-000000000010','20000000-0000-0000-0000-000000000011') and preferred_barber_id is null),
  2, 'REQ-010.2 (b) sus clientes pasan a "el que esté libre"');
select is((select queue_order from tickets where id = '20000000-0000-0000-0000-000000000010') <
          (select queue_order from tickets where id = '20000000-0000-0000-0000-000000000011'), true,
  'REQ-010.2 conservan su posición relativa');
select is((select count(*)::int from ticket_events where reason = 'reassigned'), 2, 'REQ-010.3 evento reassigned por turno');
select is((select status::text from set_barber_status((select juan from ctx), 'available')), 'available', 'REQ-010.4 vuelve');
select throws_ok($$ select set_barber_status((select pedro from ctx), 'available') $$, '42501', null,
  'un barbero no cambia el estado de otro');
select auth.test_logout();
select auth.test_login((select owner_u from ctx));
select is((select status::text from set_barber_status((select pedro from ctx), 'available')), 'available',
  'REQ-010.6 el dueño reactiva a cualquier barbero');

-- ------------------------------------------------ add_manual_ticket ----
select is((select source::text from add_manual_ticket((select biz from ctx), 'Mostrador', null, (select corte from ctx))), 'manual',
  'REQ-012.3 turno manual sin celular');
select is((select customer_phone_e164 from add_manual_ticket((select biz from ctx), 'Con cel', '+573005552009', (select corte from ctx))),
  '+573005552009', 'REQ-012.3 turno manual con celular');

-- ------------------------------------------------ reorder_ticket ----
-- En espera ahora: F(6000) G(7000) H(8000) Mostrador(9000) Con cel(10000)
select is((select customer_name from reorder_ticket('20000000-0000-0000-0000-000000000011', null)), 'H', 'ADR-012 mover al principio');
select is((select string_agg(customer_name, ',' order by queue_order) from tickets where business_id = (select biz from ctx) and status = 'waiting'),
  'H,F,G,Mostrador,Con cel', 'REQ-012.2 orden tras mover H al principio');
select reorder_ticket('20000000-0000-0000-0000-000000000011', '20000000-0000-0000-0000-000000000010');
select is((select string_agg(customer_name, ',' order by queue_order) from tickets where business_id = (select biz from ctx) and status = 'waiting'),
  'F,G,H,Mostrador,Con cel', 'REQ-012.2 mover H después de G');
select auth.test_logout();

select * from finish();
rollback;
