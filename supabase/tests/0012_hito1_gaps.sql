-- Criterios del Hito 1 verificables en la base que no tenían prueba nombrada.
begin;
select plan(8);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);

-- REQ-003.6: un turno lleva exactamente un servicio (columna única, no tabla puente)
select col_not_null('public', 'tickets', 'service_id', 'REQ-003.6 un solo servicio por turno (service_id obligatorio)');
select hasnt_table('public', 'ticket_services', 'REQ-003.6 no existe tabla puente turno↔servicios en el MVP');

-- REQ-007.8: el barbero solo llama al primero de su lista
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id) values
  ('60000000-0000-0000-0000-000000000001', (select biz from ctx), 'Primero', '+573005559001', (select corte from ctx)),
  ('60000000-0000-0000-0000-000000000002', (select biz from ctx), 'Segundo', '+573005559002', (select corte from ctx));
select auth.test_login((select juan_u from ctx));
select throws_ok(
  $$ select transition_ticket('60000000-0000-0000-0000-000000000002', 'called', 'barber') $$,
  '42501', null, 'REQ-007.8 un barbero no salta la fila llamando a otro que no es el primero');
select is((select customer_name from call_next()), 'Primero', 'REQ-007.8 call_next entrega el primero');

-- REQ-008.4: cliente no_show que vuelve queda al final
select transition_ticket('60000000-0000-0000-0000-000000000001', 'no_show', 'barber');
select auth.test_logout();
select join_queue('la-33', 'Primero', '+573005559001', (select corte from ctx));
select is(
  (select customer_phone_e164 from tickets where business_id = (select biz from ctx) and status = 'waiting' order by queue_order desc limit 1),
  '+573005559001', 'REQ-008.4 tras no llegar vuelve al final de la fila');

-- REQ-011.5: doble envío con respuesta perdida → mismo token
select is(
  (join_queue('la-33', 'Primero', '+573005559001', (select corte from ctx))) ->> 'token',
  (join_queue('la-33', 'Primero', '+573005559001', (select corte from ctx))) ->> 'token',
  'REQ-011.5 reenviar "Tomar turno" devuelve el mismo turno');

-- REQ-014.2: ningún turno activo sobrevive de un día para otro
update tickets set business_day = business_day_bogota(now()) - 1
where id = '60000000-0000-0000-0000-000000000002';
select ok(close_expired_queues() >= 1, 'REQ-014.2 el cierre cancela turnos de días anteriores');
select is((select status::text from tickets where id = '60000000-0000-0000-0000-000000000002'), 'cancelled',
  'REQ-014.2 ...y quedan cancelados');

select * from finish();
rollback;
