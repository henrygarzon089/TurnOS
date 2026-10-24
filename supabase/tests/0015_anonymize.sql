-- T-034 · Supresión de datos (REQ-018.6, NFR-005 · Ley 1581)
begin;
select plan(17);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);

create or replace function _visit(p_phone text, p_name text) returns void language plpgsql as $$
declare v_id uuid;
begin
  perform join_queue('la-33', p_name, p_phone, (select corte from ctx), null, 1);
  select id into v_id from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', (select juan_u from ctx), 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v_id, 'called', 'barber', null, (select juan from ctx));
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v_id, 'in_service', 'barber');
  perform transition_ticket(v_id, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
end $$;

select _visit('+573005580001', 'Lucía Borrar') from generate_series(1, 3);
update customers set notes = 'Le gusta el degradado' where phone_e164 = '+573005580001';
select check_rate_limit('phone:+573005580001', 5);
create temp table c0 as
select id, visits_count,
       (select count(*) from tickets where customer_id = c.id) as n_tickets,
       (select sum(service_price) from tickets where customer_id = c.id and status = 'done') as total,
       (select stamps from loyalty_cards where customer_id = c.id and status in ('active', 'completed')) as stamps
from customers c where phone_e164 = '+573005580001';
grant select on c0 to public;

-- Con turno activo no se elimina (primero se termina o cancela)
select join_queue('la-33', 'Lucía Borrar', '+573005580001', (select corte from ctx), null, 1);
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select anonymize_customer((select id from c0)) $$, 'P0005', null,
  'REQ-018.6 no elimina una ficha con turno activo');
select auth.test_logout();
update tickets set status = 'cancelled', cancel_reason = 'customer'
 where customer_phone_e164 = '+573005580001' and status = 'waiting';

-- Solo el dueño
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select anonymize_customer((select id from c0)) $$, '42501', null,
  'REQ-018.6 el barbero no puede eliminar fichas');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select lives_ok($$ select anonymize_customer((select id from c0)) $$, 'REQ-018.6 el dueño elimina la ficha');
select auth.test_logout();

select is((select name from customers where id = (select id from c0)), 'Cliente eliminado', 'REQ-018.6 nombre anonimizado en la ficha');
select ok((select phone_e164 not like '+57%' from customers where id = (select id from c0)), 'REQ-018.6 celular anonimizado en la ficha');
select is((select notes from customers where id = (select id from c0)), null, 'REQ-018.6 notas borradas');
select is((select count(*)::int from tickets where customer_id = (select id from c0) and customer_name <> 'Cliente eliminado'), 0,
  'REQ-018.6 nombre anonimizado en los turnos');
select is((select count(*)::int from tickets where customer_phone_e164 = '+573005580001'), 0, 'REQ-018.6 celular borrado de los turnos');
select is((select visits_count from customers where id = (select id from c0)), (select visits_count from c0), 'REQ-018.6 conserva el conteo de visitas');
select is((select count(*) from tickets where customer_id = (select id from c0)), (select n_tickets from c0) + 1,
  'REQ-018.6 conserva los turnos históricos');
select is((select sum(service_price) from tickets where customer_id = (select id from c0) and status = 'done'), (select total from c0),
  'REQ-018.6 conserva los montos');
select is((select stamps from loyalty_cards where customer_id = (select id from c0) and status in ('active', 'completed')), (select stamps from c0),
  'REQ-018.6 conserva los sellos (conteos)');
select is((select count(*)::int from rate_limits where key = 'phone:+573005580001'), 0, 'NFR-005 no queda el celular en rate_limits');
select is((select count(*)::int from search_customers((select biz from ctx), 'Lucía')), 0, 'REQ-018.6 ya no aparece en la búsqueda');

-- El celular queda libre para volver a registrarse como cliente nuevo
select join_queue('la-33', 'Lucía Vuelve', '+573005580001', (select corte from ctx), null, 1);
select isnt((select id from customers where phone_e164 = '+573005580001'), (select id from c0), 'REQ-018.6 el celular queda libre: ficha nueva');
select is((select visits_count from customers where phone_e164 = '+573005580001'), 0, 'REQ-018.6 la ficha nueva empieza sin historial');
select is((select name from customers where id = (select id from c0)), 'Cliente eliminado', 'REQ-018.6 la ficha eliminada sigue anónima');

select * from finish();
rollback;
