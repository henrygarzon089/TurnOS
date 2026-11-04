-- T-082 · Datos públicos para reservar (REQ-050.1, REQ-049.5, design.md §14.5).
begin;
select plan(6);

create temp table ctx as
select z.id as biz, business_day_bogota(now()) as today from businesses z where z.slug = 'la-33';

update business_hours set is_closed = false where business_id = (select biz from ctx);
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);

select is((public_appointment_info('la-33')->>'enabled')::boolean, false, 'REQ-050.1 apagadas: la portada no ofrece citas');

update businesses set appointments_enabled = true where id = (select biz from ctx);
update barbers set accepts_appointments = (display_name = 'Juan') where business_id = (select biz from ctx);
select is((select array_agg(e->>'name') from jsonb_array_elements(public_appointment_info('la-33')->'barbers') e),
  array['Juan'], 'REQ-050.1 solo los barberos que reciben citas');
select ok(jsonb_array_length(public_appointment_info('la-33')->'barbers'->0->'serviceIds') > 0,
  'REQ-050.1 con los servicios que hace cada uno (REQ-035)');
select is(jsonb_array_length(public_appointment_info('la-33')->'openDays'), 8, 'REQ-049.4 hoy y los 7 días siguientes');
select is(jsonb_array_length(public_appointment_slots_json('la-33',
            (select id from services where business_id = (select biz from ctx) and name = 'Corte'), null, (select today from ctx) + 1)),
  (select count(*)::int from public_appointment_slots('la-33',
            (select id from services where business_id = (select biz from ctx) and name = 'Corte'), null, (select today from ctx) + 1)),
  'REQ-049.3 las horas libres también como jsonb para la portada');

update business_hours set is_closed = true
 where business_id = (select biz from ctx) and weekday = extract(dow from (select today from ctx) + 1)::int;
update businesses set queue_override = 'closed', queue_override_day = (select today from ctx) where id = (select biz from ctx);
select ok(not (public_appointment_info('la-33')->'openDays') ? ((select today from ctx) + 1)::text
          and not (public_appointment_info('la-33')->'openDays') ? (select today from ctx)::text,
  'REQ-049.5 sin días cerrados en el horario ni con la fila cerrada a mano');

select * from finish();
rollback;
