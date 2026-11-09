begin;
select plan(7);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select price from services s where s.business_id = z.id and s.name = 'Corte') as corte_price,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id, public_token)
values ('70000000-0000-0000-0000-00000000000a', (select biz from ctx), 'Mi Turno', '+573005570001',
        (select corte from ctx), 'token-0072-mi-turno-aa');

-- En espera: sin horas de servicio
select is(get_ticket_by_token('token-0072-mi-turno-aa') -> 'startedAt', 'null'::jsonb,
  'REQ-078.22 en espera "Mi turno" no trae hora de inicio');
select is((get_ticket_by_token('token-0072-mi-turno-aa') ->> 'servicePrice')::int,
  (select corte_price from ctx),
  'REQ-078.22 "Mi turno" trae el precio del servicio del turno');

-- En servicio: hora de inicio ("Con <barbero> desde <hora>")
update tickets set status = 'in_service', assigned_barber_id = (select juan from ctx),
       called_at = now() - interval '20 minutes', started_at = '2026-11-09 15:52:00-05'
 where id = '70000000-0000-0000-0000-00000000000a';
select is((get_ticket_by_token('token-0072-mi-turno-aa') ->> 'startedAt')::timestamptz,
  '2026-11-09 15:52:00-05'::timestamptz,
  'REQ-078.23 en servicio "Mi turno" trae la hora en que empezó');
select is(get_ticket_by_token('token-0072-mi-turno-aa') -> 'finishedAt', 'null'::jsonb,
  'REQ-078.23 en servicio todavía no hay hora de terminado');

-- Terminado: hora de fin ("TERMINADO · <hora>")
update tickets set status = 'done', finished_at = '2026-11-09 16:21:00-05'
 where id = '70000000-0000-0000-0000-00000000000a';
select is((get_ticket_by_token('token-0072-mi-turno-aa') ->> 'finishedAt')::timestamptz,
  '2026-11-09 16:21:00-05'::timestamptz,
  'REQ-078.23 terminado "Mi turno" trae la hora en que terminó');

-- Lo que ya traía se conserva
select is(get_ticket_by_token('token-0072-mi-turno-aa') ->> 'assignedBarberName', 'Juan',
  'REQ-004.1 "Mi turno" sigue trayendo el barbero asignado');
select ok(not has_function_privilege('anon', 'get_ticket_by_token(text)', 'execute'),
  'REQ-078.22 anon sigue sin poder leer el turno directo (ADR-009)');

select * from finish();
rollback;
