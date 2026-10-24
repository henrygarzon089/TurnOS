begin;
select plan(23);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- Forzamos horario 24 h hoy para que la prueba no dependa de la hora en que corre
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false
where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);
update barbers set status = 'paused', present_day = current_date where id = (select luis from ctx);

-- ------------------------------------------------ is_business_open / override ----
select is(is_business_open((select biz from ctx)), true, 'REQ-017.2 abierto dentro del horario');
update businesses set queue_override = 'closed', queue_override_day = business_day_bogota(now()) where id = (select biz from ctx);
select is(is_business_open((select biz from ctx)), false, 'REQ-012.4 "Cerrar fila por hoy" prevalece');
update businesses set queue_override = 'open' where id = (select biz from ctx);
select is(is_business_open((select biz from ctx)), true, 'REQ-012.4 "Abrir fila" prevalece');
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);
update business_hours set is_closed = true where business_id = (select biz from ctx) and weekday = extract(dow from now() at time zone 'America/Bogota')::int;
select is(is_business_open((select biz from ctx)), false, 'REQ-001.4 día cerrado → cerrado');
select isnt(next_opening_text((select biz from ctx)), null, 'REQ-001.4 muestra próxima apertura');
update business_hours set is_closed = false where business_id = (select biz from ctx);

-- ------------------------------------------------ get_public_business ----
select is((get_public_business('la-33')) ->> 'name', 'Barbería La 33', 'REQ-001.1 nombre público');
select is(((get_public_business('la-33')) ->> 'isOpen')::boolean, true, 'REQ-001.1 abierto');
select is(jsonb_array_length((get_public_business('la-33')) -> 'services'), 6, 'REQ-003.1 servicios activos');
select is(get_public_business('no-existe'), null, 'REQ-001.5 slug inexistente → null');
select is(
  (select bool_and(not (e ? 'customer_name') and not (e ? 'customer_phone_e164'))
   from jsonb_array_elements((get_public_business('la-33')) -> 'queue' -> 'waiting') e), null,
  'REQ-031.2 la foto de la fila no lleva datos personales (fila vacía al inicio)');

-- ------------------------------------------------ join_queue ----
select is(((join_queue('la-33', 'Camilo', '+573005554001', (select corte from ctx))) ->> 'existing')::boolean, false,
  'REQ-003.3 toma turno');
select is(((join_queue('la-33', 'Camilo', '+573005554001', (select corte from ctx))) ->> 'existing')::boolean, true,
  'REQ-003.5 segundo intento devuelve el turno existente');
select is((join_queue('la-33', 'Camilo', '+573005554001', (select corte from ctx))) ->> 'token',
  (select public_token from tickets where customer_phone_e164 = '+573005554001' and status = 'waiting'),
  'REQ-003.5 ...con el mismo token');
select throws_ok(
  $$ select join_queue('la-33', 'Ana', '+573005554002', (select corte from ctx), (select luis from ctx)) $$,
  'P0005', null, 'REQ-010.1 no se puede elegir a un barbero en pausa');
select lives_ok(
  $$ select join_queue('la-33', 'Ana', '+573005554002', (select corte from ctx), (select juan from ctx)) $$,
  'REQ-003.1 barbero disponible sí');
select throws_ok($$ select join_queue('no-existe', 'X', '+573005554003', (select corte from ctx)) $$,
  'P0002', null, 'REQ-001.5 negocio inexistente');
update businesses set queue_override = 'closed', queue_override_day = business_day_bogota(now()) where id = (select biz from ctx);
select throws_ok($$ select join_queue('la-33', 'X', '+573005554003', (select corte from ctx)) $$,
  'P0007', null, 'REQ-001.4 cerrado: no se puede tomar turno');
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);

-- ------------------------------------------------ get_ticket_by_token ----
select is(get_ticket_by_token('no-existe'), null, 'REQ-004.7 token inexistente → null');
select is(
  (get_ticket_by_token((select public_token from tickets where customer_phone_e164 = '+573005554001'))) ->> 'customerName',
  'Camilo', 'REQ-004.1 devuelve el turno');
select is(
  jsonb_array_length((get_ticket_by_token((select public_token from tickets where customer_phone_e164 = '+573005554001'))) -> 'queue' -> 'waiting'),
  2, 'REQ-004.1 incluye la foto de la fila (2 en espera)');

-- ------------------------------------------------ cancel_ticket_by_token ----
select is((cancel_ticket_by_token((select public_token from tickets where customer_phone_e164 = '+573005554002'))) ->> 'status',
  'cancelled', 'REQ-005.2 cancela por token');

-- ------------------------------------------------ close_expired_queues ----
update businesses set queue_override = 'closed', queue_override_day = business_day_bogota(now()) where id = (select biz from ctx);
select is(close_expired_queues() >= 1, true, 'REQ-014.1 cierra turnos activos del negocio cerrado');
select is((select cancel_reason::text from tickets where customer_phone_e164 = '+573005554001'), 'closing',
  'REQ-014.1 motivo closing');

select * from finish();
rollback;
