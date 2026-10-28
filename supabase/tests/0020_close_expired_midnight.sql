begin;
select plan(2);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false
where business_id = (select biz from ctx);
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);
select join_queue('la-33', 'Trasnocho', '+573005558001', (select corte from ctx));

-- Cierre a las 23:30: cierre + 60 min es la 00:30 de MAÑANA, no la de hoy. Antes de 0020 la suma
-- se hacía sobre `time` y daba la vuelta (00:30 de hoy), así que el cron cancelaba todo el día.
update business_hours set closes_at = '23:30' where business_id = (select biz from ctx);
select close_expired_queues();
select is((select status::text from tickets where customer_phone_e164 = '+573005558001'), 'waiting',
  'REQ-014.1 un cierre cerca de medianoche no cancela los turnos durante el día');

-- Turno de un día anterior (lejano, para no chocar con la secuencia de días reales): se cancela.
update tickets set business_day = business_day - 3650 where customer_phone_e164 = '+573005558001';
select close_expired_queues();
select is((select status::text from tickets where customer_phone_e164 = '+573005558001'), 'cancelled',
  'REQ-014.2 ningún turno activo sobrevive al día siguiente');

select * from finish();
rollback;
