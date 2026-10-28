begin;
select plan(4);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- Horario de hoy ya vencido casi todo el día (cierre 00:01; cierre + 60 min = 01:01).
update business_hours set opens_at = '00:00', closes_at = '00:01', is_closed = false
where business_id = (select biz from ctx);

-- REQ-017.2: el dueño abre la fila hoy fuera de horario → abierta y acepta turnos
update businesses set queue_override = 'open', queue_override_day = business_day_bogota(now())
where id = (select biz from ctx);
select is(is_business_open((select biz from ctx), business_day_bogota(now()) + time '23:00' at time zone 'America/Bogota'),
  true, 'REQ-017.2 abierta a mano fuera de horario');
select is((join_queue('la-33', 'Tarde', '+573005557001', (select corte from ctx))) ->> 'existing', 'false',
  'REQ-017.2 acepta turnos con la fila abierta a mano');

-- REQ-014.1 / REQ-017.2: el cierre automático no cancela mientras la apertura manual rige hoy
select close_expired_queues();
select is((select status::text from tickets where customer_phone_e164 = '+573005557001'), 'waiting',
  'REQ-017.2 el cierre automático respeta la fila abierta a mano ese día');

-- REQ-014.2: al día siguiente el override ya no vale y el turno se cancela
update tickets set business_day = business_day - 3650 where customer_phone_e164 = '+573005557001';
select close_expired_queues();
select is((select status::text from tickets where customer_phone_e164 = '+573005557001'), 'cancelled',
  'REQ-014.2 la apertura manual no deja turnos vivos de un día para otro');

select * from finish();
rollback;
