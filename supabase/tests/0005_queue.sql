begin;
select plan(16);

-- Negocio del seed
create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan
from businesses z where z.slug = 'la-33';

-- --------------------------------------------------- creación y numeración ----
insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
select biz, 'Camilo Restrepo', '+573005550001', corte from ctx;
insert into tickets (business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id)
select biz, 'Sara Mejía', '+573005550002', barba, juan from ctx;

select is((select count(*)::int from tickets t, ctx where t.business_id = ctx.biz and t.status = 'waiting'), 2, 'REQ-003.3 se crean turnos');
select is((select sequence from tickets where customer_phone_e164 = '+573005550002'), 2::bigint,
  'REQ-003.3 numeración correlativa por negocio y día');
select is((select queue_order from tickets where customer_phone_e164 = '+573005550002'), 2000::bigint,
  'ADR-012 queue_order = sequence × 1000');
select is((select service_price from tickets where customer_phone_e164 = '+573005550001'), 25000,
  'REQ-015.3 copia el precio del servicio al turno');
select is((select service_duration_min from tickets where customer_phone_e164 = '+573005550002'), 15,
  'REQ-015.3 copia la duración del servicio');
select is((select length(public_token) from tickets where customer_phone_e164 = '+573005550001'), 22,
  'NFR-004 token público de 22 caracteres (128 bits)');
select is((select business_day from tickets where customer_phone_e164 = '+573005550001'),
  business_day_bogota(now()), 'REQ-027.5 business_day en Bogotá');
select is((select status::text from tickets where customer_phone_e164 = '+573005550001'), 'waiting',
  'REQ-003.3 nace en waiting');
select is((select count(*)::int from ticket_events e join tickets t on t.id = e.ticket_id where t.customer_phone_e164 = '+573005550001'),
  1, 'REQ-007.7 evento inicial registrado');

-- --------------------------------------------------- turno activo único por celular ----
select throws_ok(
  $$ insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
     select biz, 'Camilo otra vez', '+573005550001', corte from ctx $$,
  '23505', null, 'REQ-003.5 un solo turno activo por celular'
);
-- Sin celular (cliente de mostrador) no aplica la restricción
select lives_ok(
  $$ insert into tickets (business_id, customer_name, service_id, source)
     select biz, 'Sin registro', corte, 'manual' from ctx $$,
  'REQ-012.3 turno manual sin celular'
);
select lives_ok(
  $$ insert into tickets (business_id, customer_name, service_id, source)
     select biz, 'Sin registro 2', corte, 'manual' from ctx $$,
  'REQ-012.3 varios turnos sin celular conviven'
);
-- Terminado el turno, el celular puede volver a la fila
update tickets set status = 'done' where customer_phone_e164 = '+573005550001';
select lives_ok(
  $$ insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
     select biz, 'Camilo de nuevo', '+573005550001', corte from ctx $$,
  'REQ-003.5 tras terminar puede tomar otro turno'
);

-- --------------------------------------------------- validaciones ----
select throws_ok(
  $$ insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
     select biz, 'X', '+573005550009', gen_random_uuid() from ctx $$,
  'P0002', null, 'REQ-003.1 servicio inexistente rechazado'
);

-- --------------------------------------------------- rate limit ----
select is(
  (select bool_and(check_rate_limit('test:phone', 3)) from generate_series(1, 3)), true,
  'NFR-004 los primeros 3 intentos pasan'
);
select is(check_rate_limit('test:phone', 3), false, 'NFR-004 el 4.º intento en la ventana se rechaza');

select * from finish();
rollback;
