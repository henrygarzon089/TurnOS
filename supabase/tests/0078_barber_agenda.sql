-- T-280 · "Mi agenda" del barbero (REQ-099, ADR-073, design §31.1)
begin;
select plan(26);

-- Mediodía fijo de hoy en Bogotá (como 0046) para que las citas de "hoy" no cambien de día.
do $$
begin
  execute format(
    $f$create or replace function business_day_bogota(at timestamptz default now()) returns date
       language sql immutable as $b$ select ((at - %L::interval) at time zone 'America/Bogota')::date $b$ $f$,
    ((now() at time zone 'America/Bogota')::time - time '12:00')::text);
end $$;

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
create temp table ids (k text primary key, v uuid);
grant all on ids to public;

update barbers set accepts_appointments = true where business_id = (select biz from ctx);
update appointments set status = 'cancelled' where business_id = (select biz from ctx) and status = 'booked';

create function pg_temp.cita(p_k text, p_barber uuid, p_day_offset int, p_hour int, p_phone text,
                             p_status appointment_status default 'booked') returns uuid
language plpgsql as $$
declare v uuid; s services%rowtype; t timestamptz;
begin
  select * into s from services where id = (select corte from ctx);
  t := (((select today from ctx) + p_day_offset) + make_time(p_hour, 0, 0)) at time zone 'America/Bogota';
  insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name,
                            service_duration_min, service_price, barber_id, any_barber, starts_at, ends_at,
                            business_day, source, status, cancel_reason)
  values ((select biz from ctx), 'Cliente ' || p_k, p_phone, s.id, s.name, s.duration_min, s.price, p_barber,
          false, t, t + make_interval(mins => s.duration_min), (select today from ctx) + p_day_offset, 'owner', p_status,
          case when p_status = 'cancelled' then 'business'::appointment_cancel_reason end)
  returning id into v;
  insert into ids values (p_k, v);
  return v;
end $$;
create function pg_temp.id(p_k text) returns uuid language sql as $$ select v from ids where k = p_k $$;

select pg_temp.cita('hoy', (select pedro from ctx), 0, 15, '+573101100001');
select pg_temp.cita('manana', (select pedro from ctx), 1, 10, '+573101100002');
select pg_temp.cita('dia7', (select pedro from ctx), 7, 9, '+573101100003');
select pg_temp.cita('dia8', (select pedro from ctx), 8, 9, '+573101100004');
select pg_temp.cita('cancelada', (select pedro from ctx), 2, 11, '+573101100005', 'cancelled');
select pg_temp.cita('juan', (select juan from ctx), 1, 11, '+573101100006');
select pg_temp.cita('llego', (select pedro from ctx), 3, 9, '+573101100007', 'arrived');
select pg_temp.cita('nollego', (select pedro from ctx), 4, 9, '+573101100008', 'no_show');
select pg_temp.cita('dia3', (select pedro from ctx), 3, 14, '+573101100009');
-- Cita de hoy que empezó hace 30 minutos (pasó la tolerancia de 10, REQ-052)
insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name,
                          service_duration_min, service_price, barber_id, any_barber, starts_at, ends_at,
                          business_day, source)
select biz, 'Cliente atrasado', '+573101100010', corte, 'Corte', 30, 25000, pedro, false,
       now() - interval '30 minutes', now(), today, 'owner' from ctx;

create temp table r (j jsonb);
grant all on r to public;

select auth.test_login((select pedro_u from ctx));
insert into r select barber_agenda((select biz from ctx), (select today from ctx), (select today from ctx) + 7);

select is((select array_agg(e->>'customerName' order by e->>'customerName') from r, jsonb_array_elements(j->'items') e),
  array['Cliente atrasado', 'Cliente dia3', 'Cliente dia7', 'Cliente hoy', 'Cliente manana'],
  'REQ-099.2 el barbero ve sus citas pendientes de hoy a 7 días');
select ok((select bool_and(a <= b) from (
             select e->>'startsAt' as a, lead(e->>'startsAt') over (order by n) as b
             from r, jsonb_array_elements(j->'items') with ordinality as x(e, n)) t where b is not null),
  'REQ-099.2 vienen en orden de hora');
select is((select count(*)::int from r, jsonb_array_elements(j->'items') e where e->>'customerName' = 'Cliente juan'), 0,
  'REQ-099.3 no ve las citas de otro barbero');
select is((select count(*)::int from r, jsonb_array_elements(j->'items') e where e->>'customerName' = 'Cliente cancelada'), 0,
  'REQ-099.3 no ve las citas canceladas');
select is((select count(*)::int from r, jsonb_array_elements(j->'items') e
           where e->>'customerName' in ('Cliente llego', 'Cliente nollego')), 0,
  'REQ-099.5 no salen las que ya llegaron a la fila ni las que no llegaron');
select is((select (e->>'late')::boolean from r, jsonb_array_elements(j->'items') e where e->>'customerName' = 'Cliente atrasado'), true,
  'REQ-099.5 la de hoy que pasó la tolerancia sale atrasada');
select is((select (e->>'late')::boolean from r, jsonb_array_elements(j->'items') e where e->>'customerName' = 'Cliente manana'), false,
  'REQ-099.5 las demás no salen atrasadas');
select is((select array_agg(e->>'customerName' order by e->>'startsAt')
           from jsonb_array_elements(barber_agenda((select biz from ctx), (select today from ctx) + 3, (select today from ctx) + 7)->'items') e),
  array['Cliente dia3', 'Cliente dia7'],
  'REQ-099.2 un rango que empieza más adelante trae solo esos días');
select throws_ok($$ select barber_agenda((select biz from ctx), (select today from ctx) + 2, (select today from ctx) + 1) $$,
  '22023', null, 'REQ-099.2 un rango al revés da error');
select throws_ok($$ select barber_agenda((select biz from ctx), null, null) $$,
  '22023', null, 'REQ-099.2 un rango vacío da error');
select ok(not exists (select 1 from r, jsonb_array_elements(j->'items') e
                      where e ? 'phone' or e ? 'customerPhone' or e ? 'token' or e ? 'price'),
  'REQ-099.3 sin celular, enlace ni precio');
select ok((select (e ? 'startsAt') and (e ? 'endsAt') and (e ? 'serviceName') and (e ? 'durationMin') and (e ? 'day') and (e ? 'late')
           from r, jsonb_array_elements(j->'items') e where e->>'customerName' = 'Cliente hoy'),
  'REQ-099.2 cada cita trae día, hora de inicio y fin, servicio, duración y si va atrasada');
select is((select (j->>'acceptsAppointments')::boolean from r), true,
  'REQ-099.6 dice si el barbero recibe citas');
select throws_ok($$ select barber_agenda((select biz from ctx), (select today from ctx), (select today from ctx) + 8) $$,
  '22023', null, 'REQ-099.2 no entrega más de 8 días');
select throws_ok($$ select barber_agenda((select biz from ctx), (select today from ctx) - 1, (select today from ctx) + 6) $$,
  '22023', null, 'REQ-099.3 no entrega días pasados');
select throws_ok($$ select barber_agenda(gen_random_uuid(), (select today from ctx), (select today from ctx) + 7) $$,
  '42501', 'FORBIDDEN', 'REQ-099.8 un barbero no lee la agenda de otro negocio');
select auth.test_logout();

update barbers set accepts_appointments = false where id = (select pedro from ctx);
select auth.test_login((select pedro_u from ctx));
select is((barber_agenda((select biz from ctx), (select today from ctx), (select today from ctx) + 7)->>'acceptsAppointments')::boolean, false,
  'REQ-099.6 avisa cuando el barbero no recibe citas');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select throws_ok($$ select barber_agenda((select biz from ctx), (select today from ctx), (select today from ctx) + 7) $$,
  '42501', 'FORBIDDEN', 'REQ-099.8 el dueño sin ficha de barbero no la usa para leer la de otro');
select auth.test_logout();

select ok(not has_function_privilege('anon', 'barber_agenda(uuid, date, date)', 'execute'),
  'REQ-099.8 anon no puede ejecutar barber_agenda');
select ok(has_function_privilege('authenticated', 'barber_agenda(uuid, date, date)', 'execute'),
  'REQ-099.8 el personal con sesión sí');
select has_trigger('appointments', 'appointments_notify_queue',
  'REQ-099.7 reservar, cancelar o mover una cita avisa al canal de la fila');

-- REQ-099.7 los avisos de verdad (como 0009_realtime)
delete from realtime.messages_local;
select pg_temp.cita('rt', (select pedro from ctx), 2, 16, '+573101100011');
select is((select count(*)::int from realtime.messages_local
           where topic = 'queue:' || (select biz from ctx) and payload->>'kind' = 'appointment'), 1,
  'REQ-099.7 reservar una cita avisa al canal del negocio');
select ok((select bool_and(not (payload ? 'customer_name') and not (payload ? 'customer_phone_e164')) from realtime.messages_local),
  'REQ-099.7 el aviso no lleva datos del cliente');
delete from realtime.messages_local;
update appointments set status = 'cancelled', cancel_reason = 'business' where id = pg_temp.id('rt');
select is((select count(*)::int from realtime.messages_local where payload->>'kind' = 'appointment'), 1,
  'REQ-099.7 cancelar una cita avisa');
delete from realtime.messages_local;
update appointments set barber_id = (select juan from ctx) where id = pg_temp.id('manana');
select is((select count(*)::int from realtime.messages_local where payload->>'kind' = 'appointment'), 1,
  'REQ-099.7 pasar una cita a otro barbero avisa');
delete from realtime.messages_local;
update appointments set customer_name = 'Otro nombre' where id = pg_temp.id('dia7');
update appointments set status = status where id = pg_temp.id('dia7');
select is((select count(*)::int from realtime.messages_local), 0,
  'REQ-099.7 un cambio que no se ve en la agenda no avisa');

select * from finish();
rollback;
