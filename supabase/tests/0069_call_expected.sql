begin;
select plan(9);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);

-- Fila de Juan: A y B, los dos para cualquiera
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id) values
  ('69000000-0000-0000-0000-00000000000a', (select biz from ctx), 'A', '+573005569001', (select corte from ctx), null),
  ('69000000-0000-0000-0000-00000000000b', (select biz from ctx), 'B', '+573005569002', (select corte from ctx), null);

select auth.test_login((select juan_u from ctx));

-- "Sigue" muestra el turno que call_next llamaría
select is(my_next_ticket(), '69000000-0000-0000-0000-00000000000a'::uuid,
  'REQ-078.17 "Sigue" es el turno que "Llamar" llamaría');

-- "Llamar a B" cuando el primero es A: no llama a nadie
select throws_ok(
  $$ select call_next(null, '69000000-0000-0000-0000-00000000000b') $$,
  'P0006', 'NOT_NEXT',
  'REQ-078.17 "Llamar a <número>" no llama a otro si ese turno ya no es el primero');
select is(
  (select string_agg(status::text, ',' order by customer_name) from tickets
   where id in ('69000000-0000-0000-0000-00000000000a', '69000000-0000-0000-0000-00000000000b')),
  'waiting,waiting',
  'REQ-078.17 al rechazar no cambia ningún turno');

-- "Llamar a A": llama a A
select is(
  (select customer_name from call_next(null, '69000000-0000-0000-0000-00000000000a')),
  'A',
  'REQ-078.17 "Llamar a <número>" llama a ese turno cuando es el primero');
select transition_ticket('69000000-0000-0000-0000-00000000000a', 'in_service', 'barber');
select transition_ticket('69000000-0000-0000-0000-00000000000a', 'done', 'barber');
select is(my_next_ticket(), '69000000-0000-0000-0000-00000000000b'::uuid,
  'REQ-078.17 "Sigue" pasa al siguiente cuando el primero ya no espera');

-- Sin turno esperado sigue como antes
select is((select customer_name from call_next()), 'B', 'REQ-007.1 sin turno esperado llama al primero como antes');
select transition_ticket('69000000-0000-0000-0000-00000000000b', 'no_show', 'barber');

-- Fila vacía con turno esperado: el mismo error de siempre
select throws_ok(
  $$ select call_next(null, '69000000-0000-0000-0000-00000000000a') $$,
  'P0006', 'NO_TICKETS',
  'REQ-078.17 con la fila vacía responde NO_TICKETS');
select is(my_next_ticket(), null::uuid, 'REQ-078.17 con la fila vacía no hay "Sigue"');
select auth.test_logout();

select ok(
  has_function_privilege('authenticated', 'call_next(uuid, uuid)', 'execute'),
  'REQ-078.17 el personal puede llamar con turno esperado');

select * from finish();
rollback;
