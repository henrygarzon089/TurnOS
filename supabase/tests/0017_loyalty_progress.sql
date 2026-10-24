-- T-036 · Progreso y premio visibles; canje manual (REQ-019.3, REQ-019.5, REQ-019.7)
begin;
select plan(14);

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
update loyalty_programs set enabled = true, visits_required = 3, reward_type = 'free_service', reward_service_id = (select corte from ctx)
 where business_id = (select biz from ctx);

create or replace function _visit(p_phone text) returns void language plpgsql as $$
declare v_id uuid;
begin
  perform join_queue('la-33', 'Progreso Prueba', p_phone, (select corte from ctx), null, 1);
  select id into v_id from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', (select juan_u from ctx), 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v_id, 'called', 'barber', null, (select juan from ctx));
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v_id, 'in_service', 'barber');
  perform transition_ticket(v_id, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
end $$;
create or replace function _loy(p_phone text) returns jsonb language sql as $$
  select get_ticket_by_token((select public_token from tickets where customer_phone_e164 = p_phone order by created_at desc limit 1)) -> 'loyalty'
$$;

-- Cliente nuevo: 0 de 3
select join_queue('la-33', 'Progreso Prueba', '+573005600001', (select corte from ctx), null, 1);
select is((_loy('+573005600001') ->> 'stamps')::int, 0, 'REQ-019.7 cliente nuevo ve 0 sellos');
select is((_loy('+573005600001') ->> 'required')::int, 3, 'REQ-019.7 ve cuántos necesita');
select is((_loy('+573005600001') ->> 'rewardServiceName'), 'Corte', 'REQ-019.7 ve el premio');
update tickets set status = 'cancelled', cancel_reason = 'customer' where customer_phone_e164 = '+573005600001' and status = 'waiting';

select _visit('+573005600001') from generate_series(1, 2);
select is((_loy('+573005600001') ->> 'stamps')::int, 2, 'REQ-019.7 progreso 2 de 3 en Mi turno');
select is((_loy('+573005600001') ->> 'available')::boolean, false, 'REQ-019.3 sin premio antes de completar');
select _visit('+573005600001');
select is((_loy('+573005600001') ->> 'available')::boolean, true, 'REQ-019.3 al completar, premio disponible en Mi turno');

-- Ficha / fila (barbero): customer_loyalty con su sesión
select auth.test_login((select juan_u from ctx));
select is((customer_loyalty((select id from customers where phone_e164 = '+573005600001')) ->> 'available')::boolean, true,
  'REQ-019.3 el barbero ve el premio disponible');
select auth.test_logout();

-- REQ-019.5 canje manual desde la ficha
select auth.test_login((select owner_u from ctx));
select lives_ok($$ select redeem_loyalty_card((customer_loyalty((select id from customers where phone_e164 = '+573005600001')) ->> 'cardId')::uuid) $$,
  'REQ-019.5 el dueño marca el premio como canjeado');
select auth.test_logout();
select is((select count(*)::int from loyalty_cards lc join customers c on c.id = lc.customer_id
           where c.phone_e164 = '+573005600001' and lc.status = 'redeemed' and lc.redeemed_at is not null), 1,
  'REQ-019.5 la tarjeta queda canjeada con fecha');
select is((_loy('+573005600001') ->> 'stamps')::int, 0, 'REQ-019.5 se abre una tarjeta nueva en cero');
select is((_loy('+573005600001') ->> 'available')::boolean, false, 'REQ-019.5 la nueva tarjeta no tiene premio');

-- Programa apagado → no se muestra
update loyalty_programs set enabled = false where business_id = (select biz from ctx);
select is((_loy('+573005600001') ->> 'enabled')::boolean, false, 'REQ-019.7 sin tarjeta activa no se muestra progreso');
update loyalty_programs set enabled = true where business_id = (select biz from ctx);

-- Aislamiento: otro negocio no lee la fidelidad
insert into auth.users (id, email) values ('0000000c-0000-0000-0000-00000000000c', 'otro@test.local');
select auth.test_login('0000000c-0000-0000-0000-00000000000c');
select create_business('Otra Barbería', 'otra-barberia-x');
select is(customer_loyalty((select id from customers where phone_e164 = '+573005600001' limit 1)), null,
  'REQ-031.1 un dueño de otro negocio no ve la tarjeta');
select auth.test_logout();
-- Turno sin ficha (cliente sin celular) → sin fidelidad
select add_manual_ticket((select biz from ctx), 'Sin celular', null, (select corte from ctx));
select is(get_ticket_by_token((select public_token from tickets where customer_name = 'Sin celular' order by created_at desc limit 1)) -> 'loyalty',
  'null'::jsonb, 'REQ-019.7 cliente sin ficha no muestra tarjeta');

select * from finish();
rollback;
