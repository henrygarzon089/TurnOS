-- T-300 · Lectura pública de la web del negocio (REQ-101, ADR-077, design §33.1)
begin;
select plan(13);

create temp table ctx as select id as biz from businesses where slug = 'la-33';

select is(get_public_site('no-existe'), null, 'REQ-101.1 un enlace que no existe devuelve null');

select is(jsonb_array_length(get_public_site('la-33') -> 'hours'), 7,
  'REQ-101.3 el horario trae los 7 días de la semana');
select is((get_public_site('la-33') -> 'hours' -> 0 ->> 'weekday')::int, 0,
  'REQ-101.3 el horario va de domingo (0) a sábado (6)');

update business_hours set is_closed = true where business_id = (select biz from ctx) and weekday = 0;
update business_hours set is_closed = false, opens_at = '09:00', closes_at = '20:00'
  where business_id = (select biz from ctx) and weekday = 1;
select is(get_public_site('la-33') -> 'hours' -> 0 ->> 'isClosed', 'true',
  'REQ-101.3 un día cerrado llega como cerrado');
select is(get_public_site('la-33') -> 'hours' -> 1 ->> 'opensAt', '09:00',
  'REQ-101.3 la hora de apertura llega como HH:MM');
select is(get_public_site('la-33') -> 'hours' -> 1 ->> 'closesAt', '20:00',
  'REQ-101.3 la hora de cierre llega como HH:MM');

update loyalty_programs set enabled = true, visits_required = 10, reward_type = 'free_service'
  where business_id = (select biz from ctx);
select is((get_public_site('la-33') -> 'loyalty' ->> 'visitsRequired')::int, 10,
  'REQ-101.3 con fidelidad encendida llega la regla');
update loyalty_programs set enabled = false where business_id = (select biz from ctx);
select is(get_public_site('la-33') -> 'loyalty', 'null'::jsonb,
  'REQ-101.3 con fidelidad apagada la regla llega null');

select ok(jsonb_array_length(get_public_site('la-33') -> 'team') > 0,
  'REQ-101.3 el equipo trae los barberos activos');
update barbers set is_active = false
  where id = (select id from barbers where business_id = (select biz from ctx) order by sort_order limit 1);
select is(jsonb_array_length(get_public_site('la-33') -> 'team'),
  (select count(*)::int from barbers where business_id = (select biz from ctx) and is_active),
  'REQ-101.3 un barbero inactivo no sale en el equipo');

select ok(get_public_site('la-33')::text !~ '\+57' and not (get_public_site('la-33') -> 'team' -> 0 ? 'phone'),
  'REQ-101.6 la web no lleva celulares');

select ok(not has_function_privilege('anon', 'get_public_site(text)', 'execute')
          and not has_function_privilege('authenticated', 'get_public_site(text)', 'execute'),
  'REQ-101.6 solo service_role ejecuta la lectura pública (ADR-009)');

update businesses set google_review_url = 'https://g.page/r/abc/review' where id = (select biz from ctx);
select is(get_public_site('la-33') ->> 'reviewUrl', 'https://g.page/r/abc/review',
  'REQ-101.3 trae el enlace de reseñas en Google');

select * from finish();
rollback;
