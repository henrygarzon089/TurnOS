begin;
select plan(26);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Cejas') as cejas,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);
insert into loyalty_programs (business_id, enabled, visits_required, reward_type, reward_service_id)
values ((select biz from ctx), true, 3, 'free_service', (select corte from ctx))
on conflict (business_id) do update set enabled = true, visits_required = 3;

-- REQ-003.4 / REQ-002.3: tomar turno crea la ficha con aceptación
select join_queue('la-33', 'Camilo Prueba', '+573005560001', (select corte from ctx), null, 1);
select is((select name from customers where phone_e164 = '+573005560001'), 'Camilo Prueba', 'REQ-003.4 crea la ficha del cliente');
select is((select privacy_version from customers where phone_e164 = '+573005560001'), 1, 'REQ-002.3 guarda la versión aceptada');
select isnt((select privacy_accepted_at from customers where phone_e164 = '+573005560001'), null, 'REQ-002.3 guarda fecha de aceptación');
select is((select customer_id from tickets where customer_phone_e164 = '+573005560001' and status = 'waiting'),
  (select id from customers where phone_e164 = '+573005560001'), 'REQ-003.4 el turno enlaza la ficha');

-- Ciclo: done → visita + sello
create or replace function _done(p_phone text) returns void language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', (select juan_u from ctx), 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v_id, 'called', 'barber', null, (select juan from ctx));
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v_id, 'in_service', 'barber');
  perform transition_ticket(v_id, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
end $$;

select _done('+573005560001');
select is((select visits_count from customers where phone_e164 = '+573005560001'), 1, 'REQ-018.1 visita contada');
select isnt((select last_visit_at from customers where phone_e164 = '+573005560001'), null, 'REQ-018.1 última visita');
select is((select preferred_barber_id from customers where phone_e164 = '+573005560001'), (select juan from ctx),
  'REQ-018.1 barbero preferido = el que más lo atendió');
select is((select stamps from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001'), 1,
  'REQ-019.2 sello al terminar');

-- REQ-008.3: no_show no suma visita ni sello
select join_queue('la-33', 'Camilo Prueba', '+573005560001', (select corte from ctx), null, 1);
select auth.test_login((select juan_u from ctx));
select set_config('turnos.from_call_next', '1', true);
select transition_ticket((select id from tickets where customer_phone_e164 = '+573005560001' and status = 'waiting'), 'called', 'barber', null, (select juan from ctx));
select transition_ticket((select id from tickets where customer_phone_e164 = '+573005560001' and status = 'called'), 'no_show', 'barber');
select auth.test_logout();
select is((select visits_count from customers where phone_e164 = '+573005560001'), 1, 'REQ-008.3 no_show no cuenta como visita');
select is((select stamps from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001'), 1,
  'REQ-008.3 no_show no suma sello');

-- Servicio que no suma (Cejas)
select join_queue('la-33', 'Camilo Prueba', '+573005560001', (select cejas from ctx), null, 1);
select _done('+573005560001');
select is((select stamps from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001'), 1,
  'REQ-019.2 un servicio que no suma no da sello');
select is((select visits_count from customers where phone_e164 = '+573005560001'), 2, '...pero sí cuenta como visita');

-- Completar tarjeta (3 sellos)
select join_queue('la-33', 'Camilo Prueba', '+573005560001', (select corte from ctx), null, 1);
select _done('+573005560001');
select join_queue('la-33', 'Camilo Prueba', '+573005560001', (select corte from ctx), null, 1);
select _done('+573005560001');
select is((select status::text from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001' and lc.status <> 'redeemed'),
  'completed', 'REQ-019.3 tarjeta completa → premio disponible');

-- Canje manual (REQ-019.5) → tarjeta nueva en cero
select auth.test_login((select owner_u from ctx));
select redeem_loyalty_card((select lc.id from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001' and lc.status = 'completed'));
select auth.test_logout();
select is((select count(*)::int from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001' and lc.status = 'redeemed'), 1,
  'REQ-019.4 tarjeta canjeada');
select is((select stamps from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001' and lc.status = 'active'), 0,
  'REQ-019.4 nueva tarjeta en cero');

-- REQ-019.6: cambiar configuración no borra sellos
update loyalty_programs set visits_required = 8 where business_id = (select biz from ctx);
select join_queue('la-33', 'Camilo Prueba', '+573005560001', (select corte from ctx), null, 1);
select _done('+573005560001');
select is((select stamps from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005560001' and lc.status = 'active'), 1,
  'REQ-019.6 los sellos se conservan al cambiar la configuración');

-- REQ-021.1 nuevo vs repite: first_visit_at fija
select is((select first_visit_at <= last_visit_at from customers where phone_e164 = '+573005560001'), true, 'REQ-021.1 primera y última visita');

-- REQ-018.3 búsqueda
select is((select count(*)::int from search_customers((select biz from ctx), 'camilo prueba')), 1, 'REQ-018.3 busca por nombre');
select is((select count(*)::int from search_customers((select biz from ctx), '5560001')), 1, 'REQ-018.3 busca por últimos dígitos');
select is((select count(*)::int from search_customers((select biz from ctx), 'camlio prueba')), 1, 'REQ-018.3 tolera errores de tipeo (trigram)');

-- REQ-020.2 inactivos (N=21): simulamos última visita hace 30 días
update customers set last_visit_at = now() - interval '30 days' where phone_e164 = '+573005560001';
select is((select count(*)::int from inactive_customers((select biz from ctx)) where phone_e164 = '+573005560001'), 1, 'REQ-020.2 aparece en "para recordar"');
insert into reminders (business_id, customer_id) select biz, (select id from customers where phone_e164 = '+573005560001') from ctx;
select is((select count(*)::int from inactive_customers((select biz from ctx)) where phone_e164 = '+573005560001'), 0, 'REQ-020.4 recordado hace < 7 días no reaparece');
delete from reminders;
update customers set do_not_contact = true where phone_e164 = '+573005560001';
select is((select count(*)::int from inactive_customers((select biz from ctx)) where phone_e164 = '+573005560001'), 0, 'REQ-020.5 "no contactar" lo excluye');
update customers set do_not_contact = false where phone_e164 = '+573005560001';

-- REQ-018.6 anonimizar conserva conteos
select auth.test_login((select owner_u from ctx));
select anonymize_customer((select id from customers where phone_e164 = '+573005560001'));
select auth.test_logout();
select is((select name from customers where anonymized_at is not null and business_id = (select biz from ctx)), 'Cliente eliminado', 'REQ-018.6 nombre anonimizado');
select is((select count(*)::int from tickets where customer_phone_e164 = '+573005560001'), 0, 'REQ-018.6 celular borrado de los turnos');
select is((select visits_count from customers where anonymized_at is not null and business_id = (select biz from ctx)), 5, 'REQ-018.6 conteos conservados');

select * from finish();
rollback;
