-- T-079 · Citas en la fila: llegada, prioridad, "Llamar al siguiente", cierre, vistas y plantillas
-- (REQ-052, REQ-053, REQ-054.4, REQ-054.5, ADR-033, design.md §14.3–§14.4).
begin;
select plan(39);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
create temp table ids (k text primary key, v uuid);
grant all on ids to public;

-- Fila limpia hoy: Juan, Pedro y Luis presentes; los demás ausentes
update tickets set status = 'cancelled', cancel_reason = 'business'
 where business_id = (select biz from ctx) and status in ('waiting', 'called', 'in_service');
update barbers set status = case when id in ((select juan from ctx), (select pedro from ctx), (select luis from ctx))
                                 then 'available'::barber_status else 'off'::barber_status end,
                  present_day = (select today from ctx), accepts_appointments = true
 where business_id = (select biz from ctx);
update businesses set appointments_enabled = true, queue_override = 'auto', queue_override_day = null
 where id = (select biz from ctx);

-- Cita pendiente directa (la reserva ya está probada en 0045)
create function pg_temp.cita(p_k text, p_barber uuid, p_start timestamptz, p_phone text,
                             p_any boolean default false, p_service uuid default null) returns uuid
language plpgsql as $$
declare v uuid; s services%rowtype;
begin
  select * into s from services where id = coalesce(p_service, (select corte from ctx));
  insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name, service_duration_min,
                            service_price, barber_id, any_barber, starts_at, ends_at, business_day, source)
  values ((select biz from ctx), 'Cita ' || p_k, p_phone, s.id, s.name, s.duration_min, s.price, p_barber, p_any,
          p_start, p_start + make_interval(mins => s.duration_min), business_day_bogota(p_start), 'owner')
  returning id into v;
  insert into ids values (p_k, v);
  return v;
end $$;
-- Turno sin cita
create function pg_temp.turno(p_k text, p_service uuid, p_pref uuid default null) returns uuid
language plpgsql as $$
declare v uuid;
begin
  insert into tickets (business_id, customer_name, service_id, preferred_barber_id, source)
  values ((select biz from ctx), 'Sin cita ' || p_k, p_service, p_pref, 'manual') returning id into v;
  insert into ids values (p_k, v);
  return v;
end $$;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;

select has_column('tickets', 'appointment_id', 'REQ-052.2 el turno sabe de qué cita viene');

-- ------------------------------------------------- proteger el hueco ----
-- Juan tiene cita en 17 min. W1 corte (20 min) no cabe; W2 barba (15 min) sí.
select pg_temp.cita('c1', (select juan from ctx), now() + interval '17 minutes', '+573101000001');
select pg_temp.turno('w1', (select corte from ctx));
select pg_temp.turno('w2', (select barba from ctx));
select is(barber_next_ticket((select juan from ctx)), pg_temp.id('w2'),
  'REQ-052.4 el primero de la fila del barbero es el primero que cabe antes de su cita');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select transition_ticket(pg_temp.id('w1'), 'called', 'barber') $$,
  '42501', 'FORBIDDEN', 'REQ-052.4 el barbero no llama a un sin cita que se cruza con su cita');
select is((call_next()).id, pg_temp.id('w2'), 'REQ-052.4 "Llamar al siguiente" salta al que no cabe y llama al que sí');
select auth.test_logout();
select auth.test_login((select pedro_u from ctx));
select is((call_next()).id, pg_temp.id('w1'), 'REQ-052.4 otro barbero sin cita sí lo llama');
select auth.test_logout();

-- Juan termina; queda un sin cita que no cabe → "Tu próxima cita es a las…"
update tickets set status = 'done' where id = pg_temp.id('w2');
select pg_temp.turno('w3', (select corte from ctx), (select juan from ctx));
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select call_next() $$, 'P0006', 'NEXT_APPOINTMENT',
  'REQ-052.4 si ninguno cabe, avisa la próxima cita');
select auth.test_logout();
select ok((select barber_next_appointment_start((select juan from ctx))) =
          (select starts_at from appointments where id = pg_temp.id('c1')),
  'REQ-052.4 la próxima cita del barbero es la pendiente más cercana');

-- ------------------------------------------------------------ llegada ----
select pg_temp.cita('c2', (select juan from ctx), now() + interval '40 minutes', '+573101000002');
select auth.test_login((select pedro_u from ctx));
select throws_ok($$ select mark_appointment_arrived(pg_temp.id('c2')) $$, '42501', 'FORBIDDEN',
  'REQ-052.2 otro barbero no marca la llegada de una cita ajena');
select auth.test_logout();
select auth.test_login((select juan_u from ctx));
insert into ids select 't2', (mark_appointment_arrived(pg_temp.id('c2'))).id;
insert into ids select 't1', (mark_appointment_arrived(pg_temp.id('c1'))).id;
select auth.test_logout();
select is((select row(scheduled_at, preferred_barber_id, appointment_id)::text from tickets where id = pg_temp.id('t1')),
  row((select starts_at from appointments where id = pg_temp.id('c1')), (select juan from ctx), pg_temp.id('c1'))::text,
  'REQ-052.2 "Llegó" crea un turno de cita para su barbero');
select is((select row(status, ticket_id)::text from appointments where id = pg_temp.id('c1')),
  row('arrived', pg_temp.id('t1'))::text, 'REQ-052.2 la cita queda "llegó" con su turno');
select ok((select queue_order from tickets where id = pg_temp.id('t2')) < (select queue_order from tickets where id = pg_temp.id('w3')),
  'REQ-052.2 la cita llegada queda delante de los sin cita de su barbero');
select ok((select queue_order from tickets where id = pg_temp.id('t1')) < (select queue_order from tickets where id = pg_temp.id('t2')),
  'REQ-052.2 la cita de hora anterior queda delante aunque llegue después');
select is((select array_agg(x.id order by x.queue_order) from barber_queue_tickets((select juan from ctx)) x),
  array[pg_temp.id('t1'), pg_temp.id('t2'), pg_temp.id('w3')], 'REQ-052.2 orden de la fila de Juan: citas por hora y luego sin cita');
select throws_ok($$ select mark_appointment_arrived(pg_temp.id('c1')) $$, 'P0004', 'NOT_ARRIVABLE',
  'REQ-052.2 una cita que ya llegó no se marca otra vez');
select auth.test_login((select juan_u from ctx));
select is((call_next()).id, pg_temp.id('t1'), 'REQ-052.2 "Llamar al siguiente" llama primero la cita llegada');
select auth.test_logout();
select ok(not barber_time_free((select juan from ctx), (select starts_at from appointments where id = pg_temp.id('c1')),
                               (select ends_at from appointments where id = pg_temp.id('c1'))),
  'REQ-052.2 la hora de la cita llegada sigue ocupada mientras se atiende');

-- Dueño fuerza un sin cita que no cabe (REQ-012.2)
select pg_temp.cita('c9', (select luis from ctx), now() + interval '10 minutes', '+573101000009');
select pg_temp.turno('w9', (select corte from ctx), (select luis from ctx));
select auth.test_login((select owner_u from ctx));
select is((transition_ticket(pg_temp.id('w9'), 'called', 'owner', null, (select luis from ctx))).status::text, 'called',
  'REQ-052.4 el dueño puede llamar a cualquiera aunque se cruce con la cita');
select auth.test_logout();

-- --------------------------------------------------------------- tarde ----
select pg_temp.cita('c3', (select pedro from ctx), now() - interval '20 minutes', '+573101000003');
update tickets set status = 'done' where id = pg_temp.id('w1');
select ok(barber_time_free((select pedro from ctx), now() - interval '20 minutes', now()),
  'REQ-052.3 pasados 10 minutos la hora vuelve a estar libre');
select auth.test_login((select owner_u from ctx));
insert into ids select 't3', (mark_appointment_arrived(pg_temp.id('c3'))).id;
select auth.test_logout();
select is((select row(scheduled_at is null, preferred_barber_id)::text from tickets where id = pg_temp.id('t3')),
  row(true, (select pedro from ctx))::text, 'REQ-052.3 tarde: turno sin cita con su barbero como preferido');
select ok((select queue_order from tickets where id = pg_temp.id('t3')) =
          (select max(queue_order) from tickets where business_id = (select biz from ctx) and status = 'waiting'),
  'REQ-052.3 tarde: entra al final de la fila');

-- -------------------------------------------------- "cualquiera" sin barbero ----
update barbers set status = 'paused' where id = (select pedro from ctx);
select pg_temp.cita('c4', (select pedro from ctx), now() + interval '5 minutes', '+573101000004', true);
select auth.test_login((select owner_u from ctx));
insert into ids select 't4', (mark_appointment_arrived(pg_temp.id('c4'))).id;
select auth.test_logout();
select ok((select preferred_barber_id from tickets where id = pg_temp.id('t4')) <> (select pedro from ctx)
          and (select b.status from barbers b join tickets t on t.preferred_barber_id = b.id where t.id = pg_temp.id('t4')) in ('available', 'busy'),
  'REQ-052.5 "El que esté libre" con su barbero en pausa pasa a uno presente');
select is((select barber_id from appointments where id = pg_temp.id('c4')),
  (select preferred_barber_id from tickets where id = pg_temp.id('t4')), 'REQ-052.5 la cita queda con el barbero nuevo');
select pg_temp.cita('c5', (select pedro from ctx), now() + interval '50 minutes', '+573101000005');
select auth.test_login((select owner_u from ctx));
select is((mark_appointment_arrived(pg_temp.id('c5'))).preferred_barber_id, (select pedro from ctx),
  'REQ-052.5 con barbero elegido no se cambia (el dueño la pasa a mano)');
select auth.test_logout();

-- ------------------------------------------------------------- avisos ----
select pg_temp.cita('c6', (select pedro from ctx), now() + interval '90 minutes', '+573101000006');
select auth.test_login((select owner_u from ctx));
select ok((select (e->>'barberUnavailable')::boolean from jsonb_array_elements(appointments_today((select biz from ctx))) e
           where e->>'id' = pg_temp.id('c6')::text),
  'REQ-054.4 la cita de hoy con el barbero en pausa sale marcada');
select ok(not (select (e->>'barberUnavailable')::boolean from jsonb_array_elements(appointments_today((select biz from ctx))) e
               where e->>'id' = pg_temp.id('c9')::text),
  'REQ-054.4 la de un barbero presente no');
select is((select count(*)::int from jsonb_array_elements(appointments_today((select biz from ctx))) e
           where e->>'barberId' <> (select juan from ctx)::text), 2,
  'REQ-052.1 el dueño ve las citas pendientes de hoy de todos');
select auth.test_logout();
select auth.test_login((select pedro_u from ctx));
select is((select count(*)::int from jsonb_array_elements(appointments_today((select biz from ctx))) e
           where e->>'barberId' <> (select pedro from ctx)::text), 0,
  'REQ-052.1 el barbero ve solo sus citas');
select throws_ok($$ select appointments_agenda((select biz from ctx), (select today from ctx), (select today from ctx) + 7) $$,
  '42501', 'FORBIDDEN', 'REQ-054.6 el barbero no ve la agenda');
select auth.test_logout();

-- Día cerrado después de dar la cita (REQ-049.5)
select pg_temp.cita('c7', (select juan from ctx), (((select today from ctx) + 2) + time '10:00') at time zone 'America/Bogota', '+573101000007');
update business_hours set is_closed = true
 where business_id = (select biz from ctx) and weekday = extract(dow from (select today from ctx) + 2)::int;
select auth.test_login((select owner_u from ctx));
select ok((select (e->>'dayClosed')::boolean from jsonb_array_elements(
             appointments_agenda((select biz from ctx), (select today from ctx), (select today from ctx) + 7)) e
           where e->>'id' = pg_temp.id('c7')::text),
  'REQ-054.4 la cita de un día que quedó cerrado sale marcada');
select is((select e->>'status' from jsonb_array_elements(
             appointments_agenda((select biz from ctx), (select today from ctx), (select today from ctx) + 7)) e
           where e->>'id' = pg_temp.id('c7')::text), 'booked',
  'REQ-054.4 y no se cancela sola (ADR-033)');
select auth.test_logout();

-- ------------------------------------------------------------ estimado ----
select ok(jsonb_path_exists(queue_snapshot((select biz from ctx)), '$.appointments[*] ? (@.barberId == $b)',
                            jsonb_build_object('b', (select pedro from ctx))),
  'REQ-053.1 la foto de la fila trae los huecos de las citas pendientes de hoy');
select ok(not jsonb_path_exists(queue_snapshot((select biz from ctx)), '$.appointments[*] ? (@.startAt == $s)',
                                jsonb_build_object('s', (select to_jsonb(starts_at) from appointments where id = pg_temp.id('c3')))),
  'REQ-053.2 una cita que perdió la hora no cuenta como hueco');
select ok(jsonb_path_exists(queue_snapshot((select biz from ctx)), '$.waiting[*] ? (@.scheduledAt != null)'),
  'REQ-053.3 los turnos de cita llegada traen su hora');

-- ------------------------------------------------------------- cierre ----
insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name, service_duration_min,
                          service_price, barber_id, starts_at, ends_at, business_day, source)
values ((select biz from ctx), 'Ayer', '+573101000008', (select corte from ctx), 'Corte', 20, 25000, (select juan from ctx),
        now() - interval '1 day', now() - interval '1 day' + interval '20 minutes', (select today from ctx) - 1, 'owner');
select close_expired_queues();
select is((select status::text from appointments where customer_phone_e164 = '+573101000008'), 'no_show',
  'REQ-052.6 al cierre, la cita pendiente que perdió la hora queda "No vino"');
select is((select status::text from appointments where id = pg_temp.id('c6')), 'booked',
  'REQ-052.6 las que no han perdido la hora no se tocan');
update businesses set queue_override = 'closed', queue_override_day = (select today from ctx) where id = (select biz from ctx);
select close_expired_queues();
select is((select status::text from appointments where id = pg_temp.id('c6')), 'booked',
  'REQ-052.6 cerrar la fila a mano no cancela citas que no han llegado (ADR-033)');

-- ---------------------------------------------------------- plantillas ----
select is((select count(*)::int from message_templates where business_id = (select biz from ctx)
           and key in ('appointment_confirm', 'appointment_reminder', 'appointment_cancelled')), 3,
  'REQ-054.5 los negocios que ya existen tienen las tres plantillas de citas');
insert into businesses (name, slug) values ('Prueba citas', 'prueba-citas-t079');
select is((select count(*)::int from message_templates t join businesses z on z.id = t.business_id
           where z.slug = 'prueba-citas-t079' and t.key::text like 'appointment_%'), 3,
  'REQ-054.5 un negocio nuevo nace con las tres plantillas de citas');
select ok((select body from message_templates where business_id = (select biz from ctx) and key = 'appointment_reminder')
          ~ '\{nombre\}.*\{fecha\}.*\{hora\}.*\{negocio\}.*\{enlace\}',
  'REQ-054.5 la plantilla de recordatorio usa {nombre}, {fecha}, {hora}, {negocio} y {enlace}');

select * from finish();
rollback;
