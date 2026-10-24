-- T-033 · Fusión de fichas (REQ-018.5) y clientes visibles para el barbero (REQ-018.4)
-- Reglas: design.md §2.6, decisions.md ADR-016
begin;
select plan(27);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id in ((select juan from ctx), (select pedro from ctx));
update loyalty_programs set enabled = true, visits_required = 10 where business_id = (select biz from ctx);

-- Turno terminado por Juan para un celular
create or replace function _visit(p_phone text, p_name text, p_privacy int default 1) returns void language plpgsql as $$
declare v_id uuid;
begin
  perform join_queue('la-33', p_name, p_phone, (select corte from ctx), null, p_privacy);
  select id into v_id from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', (select juan_u from ctx), 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v_id, 'called', 'barber', null, (select juan from ctx));
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v_id, 'in_service', 'barber');
  perform transition_ticket(v_id, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
end $$;
create or replace function _cust(p_phone text) returns uuid language sql as $$
  select id from customers where phone_e164 = p_phone
$$;

-- K: celular nuevo, 3 visitas (3 sellos). M: celular viejo, 8 visitas (8 sellos), aviso v2, no contactar.
select _visit('+573005570002', 'Laura Viejo', 2) from generate_series(1, 8);
select _visit('+573005570001', 'Laura Nuevo', 1) from generate_series(1, 3);
update customers set notes = 'Corte bajo', first_visit_at = now() - interval '1 day' where id = _cust('+573005570001');
update customers set notes = 'Alérgica a la loción', do_not_contact = true, first_visit_at = now() - interval '200 days'
 where id = _cust('+573005570002');
create temp table before_merge as
select _cust('+573005570001') as k, _cust('+573005570002') as m,
       (select count(*) from tickets where customer_id in (_cust('+573005570001'), _cust('+573005570002'))) as n_tickets;
grant select on before_merge to public;

-- Solo el dueño fusiona
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select merge_customers((select k from before_merge), (select m from before_merge)) $$,
  '42501', null, 'REQ-018.5 el barbero no puede fusionar fichas');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select throws_ok($$ select merge_customers((select k from before_merge), (select k from before_merge)) $$,
  'P0004', null, 'REQ-018.5 no se fusiona una ficha consigo misma');
select lives_ok($$ select merge_customers((select k from before_merge), (select m from before_merge)) $$,
  'REQ-018.5 el dueño fusiona dos fichas');
select auth.test_logout();

select is((select count(*)::int from customers where id = (select m from before_merge)), 0, 'REQ-018.5 la ficha absorbida desaparece');
select is((select phone_e164 from customers where id = (select k from before_merge)), '+573005570001',
  'REQ-018.5 queda el celular de la ficha elegida');
select is((select name from customers where id = (select k from before_merge)), 'Laura Nuevo', 'REQ-018.5 queda el nombre de la ficha elegida');
select is((select count(*) from tickets where customer_id = (select k from before_merge)), (select n_tickets from before_merge),
  'REQ-018.5 conserva el historial de turnos de ambas');
select is((select count(*)::int from tickets where customer_id = (select k from before_merge) and customer_phone_e164 = '+573005570002'), 8,
  'REQ-018.5 los turnos viejos conservan el celular con el que se tomaron');
select is((select visits_count from customers where id = (select k from before_merge)), 11, 'REQ-018.5 visitas sumadas');
select ok((select first_visit_at < now() - interval '199 days' from customers where id = (select k from before_merge)),
  'REQ-018.5 primera visita = la más antigua');
select is((select notes from customers where id = (select k from before_merge)), E'Corte bajo\nAlérgica a la loción',
  'REQ-018.5 notas unidas');
select is((select privacy_version from customers where id = (select k from before_merge)), 2, 'REQ-018.5 conserva el aviso de versión más alta');
select ok((select do_not_contact from customers where id = (select k from before_merge)), 'REQ-018.5 "No contactar" se conserva');
select is((select preferred_barber_id from customers where id = (select k from before_merge)), (select juan from ctx),
  'REQ-018.5 barbero preferido recalculado');

-- Fidelidad: 3 + 8 = 11 ≥ 10 → premio disponible; sellos movidos, ninguno perdido
select is((select count(*)::int from loyalty_cards where customer_id = (select k from before_merge) and status in ('active', 'completed')), 1,
  'REQ-018.5 una sola tarjeta abierta');
select is((select stamps from loyalty_cards where customer_id = (select k from before_merge) and status in ('active', 'completed')), 11,
  'REQ-018.5 sellos sumados (ADR-016)');
select is((select status::text from loyalty_cards where customer_id = (select k from before_merge) and status in ('active', 'completed')), 'completed',
  'REQ-018.5 la suma completa la tarjeta → premio disponible');
select is((select count(*)::int from loyalty_stamps s join loyalty_cards c on c.id = s.card_id where c.customer_id = (select k from before_merge)), 11,
  'REQ-018.5 los registros de sellos se conservan');

-- Dos premios pendientes → no se fusiona hasta canjear uno
select _visit('+573005570003', 'Premio Uno');
select _visit('+573005570004', 'Premio Dos');
update loyalty_cards set stamps = 10, status = 'completed', completed_at = now()
 where customer_id in (_cust('+573005570003'), _cust('+573005570004'));
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select merge_customers(_cust('+573005570003'), _cust('+573005570004')) $$,
  'P0004', null, 'REQ-018.5 con dos premios disponibles pide canjear uno primero');
-- Ficha eliminada (REQ-018.6) no se fusiona
select anonymize_customer(_cust('+573005570004'));
select throws_ok($$ select merge_customers(_cust('+573005570003'), (select id from customers where name = 'Cliente eliminado' and anonymized_at is not null order by anonymized_at desc limit 1)) $$,
  'P0004', null, 'REQ-018.5 no se fusiona una ficha eliminada');
-- Otro negocio
select auth.test_logout();
insert into businesses (name, slug) values ('Otra', 'otra-barberia');
insert into customers (business_id, phone_e164, name) select id, '+573005570009', 'De otro' from businesses where slug = 'otra-barberia';
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select merge_customers(_cust('+573005570003'), _cust('+573005570009')) $$,
  'P0002', null, 'REQ-018.5 no se fusionan fichas de negocios distintos');
select auth.test_logout();

-- REQ-018.4 · clientes visibles para el barbero
select join_queue('la-33', 'Espera Cualquiera', '+573005570005', (select corte from ctx), null, 1);
select join_queue('la-33', 'Espera Pedro', '+573005570006', (select corte from ctx), (select pedro from ctx), 1);
insert into customers (business_id, phone_e164, name) select biz, '+573005570007', 'Nunca Vino' from ctx;

select auth.test_login((select juan_u from ctx));
select ok(exists (select 1 from barber_customers(null) where id = (select k from before_merge) and not in_queue_today),
  'REQ-018.4 el barbero ve a los clientes que ha atendido');
select ok(exists (select 1 from barber_customers(null) where id = _cust('+573005570005') and in_queue_today),
  'REQ-018.4 el barbero ve a quien está en su fila hoy ("el que esté libre")');
select ok(not exists (select 1 from barber_customers(null) where id = _cust('+573005570006')),
  'REQ-018.4 no ve a quien espera a otro barbero y nunca atendió');
select ok(not exists (select 1 from barber_customers(null) where id = _cust('+573005570007')),
  'REQ-018.4 no ve fichas ajenas a su fila');
select is((select count(*)::int from barber_customers('5570001')), 1, 'REQ-018.4 el buscador filtra dentro de sus clientes');
select is((select phone_last4 from barber_customers('laura')), '0001', 'REQ-018.4 devuelve solo los últimos 4 dígitos');
select auth.test_logout();

select * from finish();
rollback;
