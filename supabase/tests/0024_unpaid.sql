-- T-043 · "No se cobró" con motivo (REQ-023.6)
begin;
select plan(8);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);

create or replace function _done(p_phone text) returns uuid language plpgsql as $$
declare v uuid;
begin
  perform join_queue('la-33', 'Sin Cobro', p_phone, (select corte from ctx), null, 1);
  select id into v from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', (select juan_u from ctx), 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v, 'called', 'barber', null, (select juan from ctx));
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v, 'in_service', 'barber');
  perform transition_ticket(v, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create temp table t as select _done('+573005630001') as id, _done('+573005630002') as id2;
grant select on t to public;

select is((select payment_status::text from tickets where id = (select id from t)), 'pending',
  'REQ-023.6 terminar sin cobrar deja el turno en "Cobro pendiente"');

select auth.test_login((select pedro_u from ctx));
select throws_ok($$ select mark_ticket_unpaid((select id from t), 'No tenía plata') $$, '42501', null,
  'REQ-023.6 otro barbero no marca el turno');
select auth.test_logout();

select auth.test_login((select juan_u from ctx));
select throws_ok($$ select mark_ticket_unpaid((select id from t), '') $$, 'P0004', null, 'REQ-023.6 "No se cobró" exige motivo');
select lives_ok($$ select mark_ticket_unpaid((select id from t), 'Cortesía del barbero') $$, 'REQ-023.6 el barbero marca "No se cobró" con motivo');
select auth.test_logout();
select is((select payment_status::text from tickets where id = (select id from t)), 'unpaid', 'REQ-023.6 sale de "Cobro pendiente"');
select is((select reason from ticket_events where ticket_id = (select id from t) order by at desc, id desc limit 1),
  'No se cobró: Cortesía del barbero', 'REQ-023.6 queda el motivo en el historial del turno');
select auth.test_login((select owner_u from ctx));
select lives_ok($$ select mark_ticket_unpaid((select id2 from t), 'Cliente se fue') $$, 'REQ-023.6 el dueño también puede marcarlo');
select throws_ok($$ select mark_ticket_unpaid((select id from t), 'Otra vez') $$, 'P0004', null,
  'REQ-023.6 solo un turno con cobro pendiente');
select auth.test_logout();

select * from finish();
rollback;
