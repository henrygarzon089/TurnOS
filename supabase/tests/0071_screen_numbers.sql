-- T-176 · Pantalla del televisor con números de turno y citas (design §22.7, REQ-078.25, REQ-013.2)
begin;
select plan(9);

create temp table ctx as
select z.id as biz, z.screen_key as key,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan
from businesses z where z.slug = 'la-33';
update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);

-- Uno que atiende Juan (llamado), dos en la fila de Juan (uno es cita llegada) y uno para el primero libre
insert into tickets (business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id)
select biz, 'Andrés Llamado', '+573007100001', corte, juan from ctx;
update tickets set status = 'called', assigned_barber_id = (select juan from ctx), called_at = now()
 where customer_phone_e164 = '+573007100001';
insert into tickets (business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id)
select biz, 'Tomás Gómez', '+573007100002', corte, juan from ctx;
insert into tickets (business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, scheduled_at)
select biz, 'Luis Mejía', '+573007100003', corte, juan, now() + interval '20 minutes' from ctx;
insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
select biz, 'Sara López', '+573007100004', corte from ctx;

create temp table v as
select get_screen_queue('la-33', (select key from ctx)) as j;
create temp table juan as
select b as j from v, jsonb_array_elements(v.j -> 'barbers') b where b ->> 'id' = (select juan::text from ctx);

select is((select (j -> 'current' ->> 'number')::int from juan),
          (select display_number from tickets where customer_phone_e164 = '+573007100001'),
          'REQ-078.25 el número que atiende el barbero');
select is((select j -> 'current' ->> 'name' from juan), 'Andrés L.',
          'REQ-078.25 el actual sigue con nombre corto');
select is((select (j -> 'next' -> 0 ->> 'number')::int from juan),
          (select display_number from tickets where customer_phone_e164 = '+573007100002'),
          'REQ-078.25 cada siguiente lleva su número');
select is((select j -> 'next' -> 0 ->> 'name' from juan), 'Tomás G.',
          'REQ-078.25 cada siguiente lleva su nombre corto');
select ok((select j -> 'next' -> 0 -> 'scheduledAt' = 'null'::jsonb from juan),
          'REQ-078.25 un turno sin cita no lleva hora');
select is((select (j -> 'next' -> 1 ->> 'scheduledAt')::timestamptz from juan),
          (select scheduled_at from tickets where customer_phone_e164 = '+573007100003'),
          'REQ-078.25 una cita llegada lleva su hora ("Cita <hora>")');
select is((select (j -> 'anyone' -> 0 ->> 'number')::int from v),
          (select display_number from tickets where customer_phone_e164 = '+573007100004'),
          'REQ-078.25 "el primero libre" lleva el número');
select is((select j -> 'anyone' -> 0 ->> 'name' from v), 'Sara L.',
          'REQ-013.1 "el primero libre" con nombre corto');
select is(position('+5730071' in (select j::text from v)), 0,
          'REQ-013.2 la pantalla sigue sin celulares');

select * from finish();
rollback;
