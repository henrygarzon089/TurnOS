-- T-078 · Citas: agenda, reservar y cancelar (REQ-049, REQ-050, REQ-051.2, REQ-054.2, REQ-054.6,
-- ADR-033, design.md §14.1–§14.3).
begin;
select plan(52);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       business_day_bogota(now()) + 1 as d1
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v text);
grant all on ids to public;

-- Hora de Bogotá del día d1 + n días
create function pg_temp.at(p_hhmi text, p_plus int default 0) returns timestamptz
language sql stable as $$
  select (((select d1 from ctx) + p_plus) + p_hhmi::time) at time zone 'America/Bogota'
$$;

-- Horario fijo para que la prueba no dependa del día: 9:00 a 20:00 todos los días
update business_hours set opens_at = '09:00', closes_at = '20:00', is_closed = false
 where business_id = (select biz from ctx);
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);
-- Pedro no hace barba (REQ-035)
delete from barber_services where barber_id = (select pedro from ctx) and service_id = (select barba from ctx);

-- -------------------------------------------------------------- apagadas ----
select col_default_is('businesses', 'appointments_enabled', 'false', 'REQ-049.1 las citas nacen apagadas');
select col_default_is('barbers', 'accepts_appointments', 'false', 'REQ-049.2 por defecto ningún barbero recibe citas');
update barbers set accepts_appointments = true where id = (select juan from ctx);
select is((select count(*)::int from appointment_slots((select biz from ctx), (select corte from ctx), null, (select d1 from ctx), now())),
  0, 'REQ-049.1 apagadas no hay horas');
select throws_ok($$ select book_appointment((select biz from ctx), (select corte from ctx), null, pg_temp.at('10:00'), 'Ana', '+573001112233') $$,
  'P0004', 'APPOINTMENTS_DISABLED', 'REQ-049.1 apagadas no se crean citas');

-- ------------------------------------------------------------- ajustes ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select save_appointment_settings((select biz from ctx), true, array[(select juan from ctx)]) $$,
  '42501', 'FORBIDDEN', 'REQ-049.6 el barbero no enciende las citas');
select throws_ok($$ update barbers set accepts_appointments = false where id = (select juan from ctx) $$,
  '42501', 'FORBIDDEN_COLUMN', 'REQ-049.6 el barbero no cambia si recibe citas');
select auth.test_logout();

update barbers set is_active = false where id = (select luis from ctx);
select auth.test_login((select owner_u from ctx));
select lives_ok($$ select save_appointment_settings((select biz from ctx), true,
                     array[(select juan from ctx), (select pedro from ctx), (select luis from ctx)]) $$,
  'REQ-049.6 el dueño enciende las citas y elige barberos');
select auth.test_logout();
select ok((select appointments_enabled from businesses where id = (select biz from ctx)), 'REQ-049.1 quedan encendidas');
select is((select array_agg(display_name order by sort_order) from barbers
           where business_id = (select biz from ctx) and accepts_appointments),
  array['Juan', 'Pedro']::text[], 'REQ-049.2 reciben citas los elegidos que están activos (Luis inactivo no)');

-- ---------------------------------------------------------------- horas ----
select is((select min(starts_at) from appointment_slots((select biz from ctx), (select corte from ctx), null, (select d1 from ctx), now())),
  pg_temp.at('09:00'), 'REQ-049.3 la primera hora es la apertura');
select is((select max(starts_at) from appointment_slots((select biz from ctx), (select corte from ctx), null, (select d1 from ctx), now())),
  pg_temp.at('19:30'), 'REQ-049.3 la última hora deja terminar el servicio antes del cierre');
select is((select count(*)::int from appointment_slots((select biz from ctx), (select corte from ctx), null, (select d1 from ctx), now())),
  43, 'REQ-049.3 horas cada 15 minutos (9:00…19:30)');
select is((select barber_ids from appointment_slots((select biz from ctx), (select barba from ctx), null, (select d1 from ctx), now())
           where starts_at = pg_temp.at('10:00')),
  array[(select juan from ctx)], 'REQ-049.3 solo barberos que hacen el servicio');
select ok(appointment_time_valid((select biz from ctx), pg_temp.at('09:00'), 20, pg_temp.at('09:00')),
  'REQ-049.3 una hora de la grilla es válida');
select ok(not appointment_time_valid((select biz from ctx), pg_temp.at('09:10'), 20, now()),
  'REQ-049.3 una hora fuera de la grilla de 15 min no es válida');

-- ---------------------------------------------------------- anticipación ----
select ok(not appointment_time_valid((select biz from ctx), pg_temp.at('10:00'), 20, pg_temp.at('10:00') + interval '1 minute'),
  'REQ-049.4 no antes del mínimo (1 hora para el cliente)');
select ok(appointment_time_valid((select biz from ctx), pg_temp.at('10:00', 6), 20, now()),
  'REQ-049.4 se puede reservar 7 días después de hoy');
select ok(not appointment_time_valid((select biz from ctx), pg_temp.at('10:00', 7), 20, now()),
  'REQ-049.4 no más de 7 días después de hoy');
select ok(not appointment_time_valid((select biz from ctx), pg_temp.at('10:00', -2), 20, '-infinity'),
  'REQ-049.4 no en días pasados');
select ok((select count(*) from public_appointment_slots('la-33', (select corte from ctx), null, business_day_bogota(now()))) =
          (select count(*) from appointment_slots((select biz from ctx), (select corte from ctx), null, business_day_bogota(now()), now() + interval '1 hour')),
  'REQ-049.4 la portada usa el mínimo de 1 hora');

-- -------------------------------------------------------- días cerrados ----
update business_hours set is_closed = true
 where business_id = (select biz from ctx) and weekday = extract(dow from (select d1 from ctx))::int;
select is((select count(*)::int from appointment_slots((select biz from ctx), (select corte from ctx), null, (select d1 from ctx), now())),
  0, 'REQ-049.5 sin horas en un día cerrado del horario');
update business_hours set is_closed = false where business_id = (select biz from ctx);
update businesses set queue_override = 'closed', queue_override_day = (select d1 from ctx) where id = (select biz from ctx);
select is((select count(*)::int from appointment_slots((select biz from ctx), (select corte from ctx), null, (select d1 from ctx), now())),
  0, 'REQ-049.5 sin horas en un día con la fila cerrada a mano');
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);

-- ------------------------------------------------------------- reservar ----
insert into ids select 'a1', book_appointment((select biz from ctx), (select corte from ctx), (select juan from ctx),
  pg_temp.at('10:00'), 'Ana Gómez', '+573001112233', 1)->>'token';
select is(length((select v from ids where k = 'a1')), 22, 'REQ-050.2 la cita tiene un token no adivinable (128 bits)');
select is((select row(service_name, service_duration_min, service_price, ends_at, status::text, source::text)::text
           from appointments where public_token = (select v from ids where k = 'a1')),
  row('Corte', 20, 25000, pg_temp.at('10:20'), 'booked', 'public')::text,
  'REQ-050.2 la cita copia el servicio de ese momento');
select is((select privacy_version from customers where business_id = (select biz from ctx) and phone_e164 = '+573001112233'),
  1, 'REQ-050.2 crea la ficha con el aviso de privacidad aceptado');
select ok((select customer_id is not null from appointments where public_token = (select v from ids where k = 'a1')),
  'REQ-050.2 la cita queda vinculada a la ficha');
select ok(not exists (select 1 from appointment_slots((select biz from ctx), (select corte from ctx), (select juan from ctx), (select d1 from ctx), now())
                      where starts_at in (pg_temp.at('09:45'), pg_temp.at('10:00'), pg_temp.at('10:15'))),
  'REQ-049.3 la cita ocupa al barbero: no hay horas que se crucen');
select ok(exists (select 1 from appointment_slots((select biz from ctx), (select corte from ctx), (select juan from ctx), (select d1 from ctx), now())
                  where starts_at = pg_temp.at('10:30')),
  'REQ-049.3 la hora siguiente que no se cruza sigue libre');

select throws_ok($$ select book_appointment((select biz from ctx), (select corte from ctx), (select juan from ctx),
                     pg_temp.at('10:15'), 'Beto', '+573002223344') $$,
  'P0004', 'SLOT_TAKEN', 'REQ-050.4 la misma hora con el mismo barbero solo la gana uno');
select throws_ok($$ select book_appointment((select biz from ctx), (select corte from ctx), (select juan from ctx),
                     pg_temp.at('10:05'), 'Beto', '+573002223344') $$,
  'P0004', 'SLOT_UNAVAILABLE', 'REQ-049.3 una hora fuera de la grilla no se reserva');
select throws_ok($$ select book_appointment((select biz from ctx), (select corte from ctx), null,
                     pg_temp.at('10:00'), 'Beto', '3002223344') $$,
  'P0004', 'INVALID_PHONE', 'REQ-050.2 celular inválido');

-- "El que esté libre": Juan ya tiene una cita ese día, Pedro ninguna → Pedro
insert into ids select 'a2', book_appointment((select biz from ctx), (select corte from ctx), null,
  pg_temp.at('10:00'), 'Beto', '+573002223344')->>'token';
select is((select row(barber_id, any_barber)::text from appointments where public_token = (select v from ids where k = 'a2')),
  row((select pedro from ctx), true)::text, 'REQ-050.3 "El que esté libre" fija al de menos citas ese día');
-- Empate (cada uno con una): el primero en el orden (Juan) a otra hora
insert into ids select 'a3', book_appointment((select biz from ctx), (select corte from ctx), null,
  pg_temp.at('15:00'), 'Caro', '+573003334455')->>'token';
select is((select barber_id from appointments where public_token = (select v from ids where k = 'a3')),
  (select juan from ctx), 'REQ-050.3 si empatan, el primero en el orden de barberos');
-- Los dos ocupados a las 10:00 → nadie
select throws_ok($$ select book_appointment((select biz from ctx), (select corte from ctx), null,
                     pg_temp.at('10:00'), 'Dani', '+573004445566') $$,
  'P0004', 'SLOT_TAKEN', 'REQ-050.4 "El que esté libre" sin nadie libre a esa hora');

-- ---------------------------------------------------- una por celular ----
select is(book_appointment((select biz from ctx), (select corte from ctx), (select pedro from ctx),
            pg_temp.at('16:00'), 'Ana Gómez', '+573001112233'),
  jsonb_build_object('token', (select v from ids where k = 'a1'), 'existing', true),
  'REQ-050.5 con una cita pendiente devuelve la que tiene');
select is((select count(*)::int from appointments where customer_phone_e164 = '+573001112233'), 1,
  'REQ-050.5 no crea otra');
-- Una pendiente que ya perdió la hora no estorba: queda "no vino"
insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name, service_duration_min,
                          service_price, barber_id, starts_at, ends_at, business_day, source, public_token)
values ((select biz from ctx), 'Eva', '+573005556677', (select corte from ctx), 'Corte', 20, 25000, (select pedro from ctx),
        now() - interval '1 hour', now() - interval '40 minutes', business_day_bogota(now() - interval '1 hour'), 'public', 'tok-eva-vieja');
select is((book_appointment((select biz from ctx), (select corte from ctx), (select pedro from ctx),
            pg_temp.at('17:00'), 'Eva', '+573005556677')->>'existing')::boolean,
  false, 'REQ-050.5 una cita que perdió la hora no cuenta como pendiente');
select is((select status::text from appointments where public_token = 'tok-eva-vieja'), 'no_show',
  'REQ-050.5 la que perdió la hora queda "No vino"');

-- --------------------------------------------------------------- dueño ----
select auth.test_login((select owner_u from ctx));
select lives_ok($$ insert into ids select 'a4', book_appointment((select biz from ctx), (select corte from ctx), (select pedro from ctx),
                     pg_temp.at('18:00'), 'Fer', '+573006667788')->>'token' $$,
  'REQ-050.6 el dueño crea una cita con nombre y celular');
select is((select source::text from appointments where public_token = (select v from ids where k = 'a4')), 'owner',
  'REQ-050.6 queda como cita del dueño');
select auth.test_logout();
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select book_appointment((select biz from ctx), (select corte from ctx), (select juan from ctx),
                     pg_temp.at('19:00'), 'Gabo', '+573007778899') $$,
  '42501', 'FORBIDDEN', 'REQ-050.6 el barbero no agenda citas');
select auth.test_logout();

-- ------------------------------------------------------------ cancelar ----
select is(cancel_appointment_by_token((select v from ids where k = 'a1'))::text, 'cancelled',
  'REQ-051.2 el cliente cancela su cita');
select ok(exists (select 1 from appointment_slots((select biz from ctx), (select corte from ctx), (select juan from ctx), (select d1 from ctx), now())
                  where starts_at = pg_temp.at('10:00')),
  'REQ-051.2 la hora queda libre de inmediato');
select is(cancel_appointment_by_token((select v from ids where k = 'a1'))::text, 'cancelled',
  'REQ-051.2 cancelar dos veces no falla');
select throws_ok($$ select cancel_appointment_by_token('tok-eva-vieja') $$,
  'P0004', 'NOT_CANCELLABLE', 'REQ-051.2 solo se cancela una cita pendiente');

select auth.test_login((select owner_u from ctx));
select is((select row(status, cancel_reason)::text from cancel_appointment(
             (select id from appointments where public_token = (select v from ids where k = 'a4')))),
  row('cancelled', 'business')::text, 'REQ-054.2 el dueño cancela una cita');
select auth.test_logout();
insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name, service_duration_min,
                          service_price, barber_id, starts_at, ends_at, business_day, source)
values ((select biz from ctx), 'Iris', '+573008889900', (select corte from ctx), 'Corte', 20, 25000, (select juan from ctx),
        pg_temp.at('10:00'), pg_temp.at('10:20'), (select d1 from ctx), 'owner');
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select reassign_appointment((select id from appointments where public_token = (select v from ids where k = 'a2')),
                                                 (select juan from ctx)) $$,
  'P0004', 'SLOT_TAKEN', 'REQ-054.2 no se pasa a un barbero sin la hora libre');
-- Juan tenía a Caro a las 15:00: pasarla a Pedro
select is((select row(barber_id, any_barber)::text from reassign_appointment(
             (select id from appointments where public_token = (select v from ids where k = 'a3')), (select pedro from ctx))),
  row((select pedro from ctx), false)::text, 'REQ-054.2 el dueño pasa la cita a otro barbero con la hora libre');
select throws_ok($$ select reassign_appointment((select id from appointments where public_token = (select v from ids where k = 'a3')),
                                                 (select luis from ctx)) $$,
  'P0010', 'BARBER_CANT_DO_SERVICE', 'REQ-054.2 no se pasa a un barbero que no recibe citas');
select auth.test_logout();

-- ----------------------------------------------------------------- RLS ----
insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name, service_duration_min,
                          service_price, barber_id, starts_at, ends_at, business_day, source)
select (select biz from ctx), 'Hoy ' || b, '+57300999000' || n, (select corte from ctx), 'Corte', 20, 25000, b,
       now() + interval '3 hours', now() + interval '3 hours 20 minutes', business_day_bogota(now()), 'owner'
from (values ((select juan from ctx), 1), ((select pedro from ctx), 2)) v(b, n);
select auth.test_login((select juan_u from ctx));
select is((select count(*)::int from appointments where barber_id <> (select juan from ctx)), 0,
  'REQ-054.6 el barbero no ve citas de otros barberos');
select is((select count(*)::int from appointments where business_day <> business_day_bogota(now())), 0,
  'REQ-054.6 el barbero no ve la agenda de otros días');
select auth.test_logout();
select ok(not has_function_privilege('anon', 'public_book_appointment(text, uuid, uuid, timestamptz, text, text, int)', 'execute')
          and not has_table_privilege('anon', 'appointments', 'select'),
  'REQ-050.2 anon no reserva ni lee citas directo (ADR-009)');

select * from finish();
rollback;
