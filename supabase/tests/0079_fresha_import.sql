-- T-290 / T-293 · Importar clientes y citas de Fresha (REQ-100, ADR-076, design §32.1)
begin;
select plan(32);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (now() at time zone 'America/Bogota')::date as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

update businesses set appointments_enabled = true, queue_override = 'auto' where id = (select biz from ctx);
update barbers set is_active = true where id in ((select juan from ctx), (select pedro from ctx));
update appointments set status = 'cancelled', cancel_reason = 'business'
 where business_id = (select biz from ctx) and status = 'booked';
insert into business_hours (business_id, weekday, opens_at, closes_at, is_closed)
select (select biz from ctx), d, '08:00', '20:00', false from generate_series(0, 6) d
on conflict (business_id, weekday) do update set opens_at = '08:00', closes_at = '20:00', is_closed = false;
-- El día de pasado mañana + 1 queda cerrado
update business_hours set is_closed = true
 where business_id = (select biz from ctx) and weekday = extract(dow from (select today from ctx) + 3)::int;

-- Dos fichas que ya estaban: una sin cumpleaños y con nota, otra con cumpleaños
insert into customers (business_id, phone_e164, name, notes, privacy_accepted_at, privacy_version)
select biz, '+573208880001', 'Carlos Viejo', 'Nota vieja', now(), 1 from ctx;
insert into customers (business_id, phone_e164, name, birthday_month, birthday_day)
select biz, '+573208880002', 'Ana Vieja', 7, 20 from ctx;

create function pg_temp.at(p_day_offset int, p_hour int, p_min int default 0) returns text
language sql as $$
  select to_jsonb((((select today from ctx) + p_day_offset) + make_time(p_hour, p_min, 0)) at time zone 'America/Bogota')#>>'{}'
$$;

create temp table r (k text primary key, j jsonb);
grant all on r to public;
create temp table args (k text primary key, c jsonb, a jsonb);
grant all on args to public;

insert into args select 'uno',
  jsonb_build_array(
    jsonb_build_object('name', 'Carlos Nuevo Nombre', 'phone', '+573208880001', 'birthdayDay', 3, 'birthdayMonth', 5,
                       'notes', 'Viene los sábados'),
    jsonb_build_object('name', 'Ana Otra', 'phone', '+573208880002', 'birthdayDay', 1, 'birthdayMonth', 1),
    jsonb_build_object('name', 'Nueva Fresha', 'phone', '+573209990001', 'birthdayDay', 31, 'birthdayMonth', 2),
    jsonb_build_object('name', 'Doble', 'phone', '+573209990002', 'birthdayDay', 10, 'birthdayMonth', 4),
    jsonb_build_object('name', 'Doble', 'phone', '+573209990002'),
    jsonb_build_object('name', 'Extranjero', 'phone', '+5491112345678')
  ),
  jsonb_build_array(
    -- 0 válida: Pedro mañana 10:00, 45 min del archivo
    jsonb_build_object('ref', 'F-1', 'phone', '+573209990001', 'name', 'Nueva Fresha', 'barberId', pedro,
                       'serviceId', corte, 'startsAt', pg_temp.at(1, 10), 'durationMin', 45),
    -- 1 pasada
    jsonb_build_object('ref', 'F-2', 'phone', '+573209990003', 'name', 'Pasado', 'barberId', pedro,
                       'serviceId', corte, 'startsAt', to_jsonb(now() - interval '2 hours')#>>'{}'),
    -- 2 día cerrado
    jsonb_build_object('ref', 'F-3', 'phone', '+573209990004', 'name', 'Cerrado', 'barberId', pedro,
                       'serviceId', corte, 'startsAt', pg_temp.at(3, 10)),
    -- 3 fuera de horario
    jsonb_build_object('ref', 'F-4', 'phone', '+573209990005', 'name', 'Tarde', 'barberId', pedro,
                       'serviceId', corte, 'startsAt', pg_temp.at(1, 19, 45)),
    -- 4 choca con la 0 (Pedro 10:30)
    jsonb_build_object('ref', 'F-5', 'phone', '+573209990006', 'name', 'Choque', 'barberId', pedro,
                       'serviceId', corte, 'startsAt', pg_temp.at(1, 10, 30)),
    -- 5 el mismo cliente de la 0 con otra cita pendiente
    jsonb_build_object('ref', 'F-6', 'phone', '+573209990001', 'name', 'Nueva Fresha', 'barberId', juan,
                       'serviceId', corte, 'startsAt', pg_temp.at(2, 10)),
    -- 6 barbero que no existe
    jsonb_build_object('ref', 'F-7', 'phone', '+573209990007', 'name', 'Sin barbero', 'barberId', gen_random_uuid(),
                       'serviceId', corte, 'startsAt', pg_temp.at(1, 11)),
    -- 7 válida, cliente que no venía en el archivo de clientes, sin ref y a 20 días
    jsonb_build_object('phone', '+573209990008', 'name', 'Solo Cita', 'barberId', juan,
                       'serviceId', corte, 'startsAt', pg_temp.at(20, 9, 10))
  )
from ctx;

-- ------------------------------------------------------------- permisos ----
select ok(not has_function_privilege('anon', 'import_fresha(uuid, jsonb, jsonb, int)', 'execute'),
  'REQ-100.1 anon no puede importar');
select ok(not has_function_privilege('authenticated', 'import_customers_rows(uuid, jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'import_appointments_rows(uuid, jsonb)', 'execute'),
  'REQ-100.1 las funciones internas no se llaman directo');

select auth.test_login((select pedro_u from ctx));
select throws_ok($$ select import_fresha((select biz from ctx), '[]', '[]', 0) $$,
  '42501', 'FORBIDDEN', 'REQ-100.1 el barbero no puede importar');
select auth.test_logout();

delete from realtime.messages_local;
select auth.test_login((select owner_u from ctx));
insert into r select 'uno', import_fresha((select biz from ctx), c, a, 3) from args where k = 'uno';
select auth.test_logout();

-- ------------------------------------------------------------- clientes ----
select is((select (j->>'customersNew')::int from r where k = 'uno'), 2,
  'REQ-100.2 cuenta los clientes nuevos (el repetido cuenta una vez)');
select is((select (j->>'customersExisting')::int from r where k = 'uno'), 3,
  'REQ-100.2 cuenta los que ya existían por celular');
select is((select name from customers where phone_e164 = '+573208880001' and business_id = (select biz from ctx)),
  'Carlos Viejo', 'REQ-100.3 no cambia el nombre de una ficha que ya estaba');
select is((select array[birthday_month, birthday_day]::int[] from customers
           where phone_e164 = '+573208880001' and business_id = (select biz from ctx)),
  array[5, 3], 'REQ-100.3 completa el cumpleaños si estaba vacío');
select is((select array[birthday_month, birthday_day]::int[] from customers
           where phone_e164 = '+573208880002' and business_id = (select biz from ctx)),
  array[7, 20], 'REQ-100.3 no pisa un cumpleaños que ya estaba');
select is((select notes from customers where phone_e164 = '+573208880001' and business_id = (select biz from ctx)),
  E'Nota vieja\nFresha: Viene los sábados', 'REQ-100.4 agrega la nota de Fresha al final con "Fresha:"');
select is((select count(*)::int from customers where phone_e164 = '+573209990002' and business_id = (select biz from ctx)),
  1, 'REQ-100.3 el mismo celular repetido en el archivo deja una sola ficha');
select ok((select birthday_month is null from customers
           where phone_e164 = '+573209990001' and business_id = (select biz from ctx)),
  'REQ-100.4 un cumpleaños que no existe (31 de febrero) no se guarda');
select ok((select bool_and(privacy_accepted_at is null and imported_from = 'fresha') from customers
           where phone_e164 in ('+573209990001', '+573209990002') and business_id = (select biz from ctx)),
  'REQ-100.5 los importados quedan sin el aviso de privacidad aceptado');
select is((select count(*)::int from customers where phone_e164 = '+5491112345678'), 0,
  'REQ-100.3 un celular que no es colombiano no se importa');

-- ---------------------------------------------------------------- citas ----
select is((select (j->>'appointmentsCreated')::int from r where k = 'uno'), 2,
  'REQ-100.6 crea las citas futuras que sirven');
select is((select array[a.barber_id::text, a.service_id::text, a.service_duration_min::text, a.status::text, a.source::text]
           from appointments a where a.external_ref = 'F-1'),
  array[(select pedro from ctx)::text, (select corte from ctx)::text, '45', 'booked', 'owner'],
  'REQ-100.6 la cita queda con el barbero, el servicio y la duración del archivo, como una del dueño');
select is((select starts_at from appointments where external_ref = 'F-1'),
  (select (((select today from ctx) + 1) + time '10:00') at time zone 'America/Bogota'),
  'REQ-100.6 la hora del archivo es hora de Bogotá');
select is((select jsonb_agg(e order by (e->>'index')::int) from r, jsonb_array_elements(j->'rejected') e where k = 'uno'),
  '[{"index": 1, "reason": "PAST"}, {"index": 2, "reason": "DAY_CLOSED"}, {"index": 3, "reason": "OUTSIDE_HOURS"},
    {"index": 4, "reason": "SLOT_TAKEN"}, {"index": 5, "reason": "HAS_BOOKING"}, {"index": 6, "reason": "INVALID"}]'::jsonb,
  'REQ-100.8 las que no se importan vuelven con su posición y su motivo');
select ok((select bool_and(not (e ? 'name') and not (e ? 'phone')) from r, jsonb_array_elements(j->'rejected') e where k = 'uno'),
  'REQ-100.11 la respuesta no devuelve datos del cliente');
select ok((select c.imported_from = 'fresha' and a.customer_id = c.id from appointments a
           join customers c on c.phone_e164 = a.customer_phone_e164 and c.business_id = a.business_id
           where a.customer_phone_e164 = '+573209990008'),
  'REQ-100.6 crea la ficha del cliente de una cita que no venía en el archivo de clientes');
select ok((select business_day = (select today from ctx) + 20 from appointments where customer_phone_e164 = '+573209990008'),
  'REQ-100.6 importa citas a más de 7 días y fuera de la grilla de 15 minutos');
select is((select count(*)::int from realtime.messages_local
           where topic = 'queue:' || (select biz from ctx) and payload->>'kind' = 'appointment'), 2,
  'REQ-100.9 las citas importadas avisan a la agenda como las del dueño');

-- ------------------------------------------------------- otra vez igual ----
select auth.test_login((select owner_u from ctx));
insert into r select 'dos', import_fresha((select biz from ctx), c, a, 0) from args where k = 'uno';
select auth.test_logout();
select is((select array[(j->>'customersNew')::int, (j->>'appointmentsCreated')::int, (j->>'appointmentsAlready')::int]
           from r where k = 'dos'), array[0, 0, 2],
  'REQ-100.10 importar el mismo archivo otra vez no duplica');
select is((select count(*)::int from appointments where business_id = (select biz from ctx)
           and customer_phone_e164 in ('+573209990001', '+573209990008') and status = 'booked'), 2,
  'REQ-100.10 siguen siendo dos citas');

-- ------------------------------------------------------------- registro ----
select is((select array[customers_new, customers_existing, appointments_created, appointments_rejected, rows_skipped]
           from customer_imports where business_id = (select biz from ctx) order by created_at, appointments_created desc limit 1),
  array[2, 3, 2, 6, 3], 'REQ-100.11 queda un registro de la importación con los conteos');
select is((select array_agg(column_name::text order by column_name::text) from information_schema.columns
           where table_name = 'customer_imports'),
  array['appointments_created', 'appointments_rejected', 'business_id', 'created_at', 'created_by', 'customers_existing',
        'customers_new', 'id', 'rows_skipped', 'source'],
  'REQ-100.11 el registro no guarda datos de clientes');
select ok((select relforcerowsecurity from pg_class where relname = 'customer_imports'),
  'REQ-100.11 customer_imports con RLS forzada');
select auth.test_login((select pedro_u from ctx));
select is((select count(*)::int from customer_imports), 0, 'REQ-100.1 el barbero no ve las importaciones');
select auth.test_logout();

-- Citas apagadas
update businesses set appointments_enabled = false where id = (select biz from ctx);
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select import_fresha((select biz from ctx), '[]', (select a from args where k = 'uno'), 0) $$,
  'P0004', 'APPOINTMENTS_DISABLED', 'REQ-100.6 sin Citas encendido no se importan citas');
select lives_ok($$ select import_fresha((select biz from ctx), (select c from args where k = 'uno'), '[]', 0) $$,
  'REQ-100.1 los clientes sí se pueden importar solos');
select auth.test_logout();

-- ------------------------------------------- T-293 sin avisos a importados ----
update customers set birthday_month = extract(month from (select today from ctx))::int,
                     birthday_day = extract(day from (select today from ctx))::int,
                     visits_count = 3, last_visit_at = now() - interval '200 days'
 where business_id = (select biz from ctx) and phone_e164 = '+573209990002';
select is((select count(*)::int from birthdays_this_week((select biz from ctx)) b where b.phone_e164 = '+573209990002'), 0,
  'REQ-100.5 un importado sin aceptar el aviso no sale en "Cumplen esta semana"');
select is((select count(*)::int from inactive_customers((select biz from ctx)) b where b.phone_e164 = '+573209990002'), 0,
  'REQ-100.5 un importado sin aceptar el aviso no sale en "Clientes para recordar"');
update customers set privacy_accepted_at = now(), privacy_version = 1
 where business_id = (select biz from ctx) and phone_e164 = '+573209990002';
select is((select count(*)::int from birthdays_this_week((select biz from ctx)) b where b.phone_e164 = '+573209990002'), 1,
  'REQ-100.5 cuando acepta el aviso vuelve a salir en las listas');

select * from finish();
rollback;
