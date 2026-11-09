-- T-171 · Clientes del barbero con fidelidad y membresía; compras del barbero con descuento.
-- Reglas: design.md §22.6, REQ-078.16, REQ-068, REQ-018.4
begin;
select plan(7);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id = (select juan from ctx);
update loyalty_programs set enabled = true, visits_required = 10 where business_id = (select biz from ctx);

-- Un turno terminado por Juan: la ficha queda con un sello
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
select _visit('+573007070001', 'Tablero Fiel') from generate_series(1, 3);

-- Compra de Juan con descuento de empleado, insertada directo (la regla de register_sale ya tiene su prueba)
insert into sales (business_id, business_day, barber_id, staff_buyer_id, services_total, products_total,
                   total, commission_pct, commission_amount, staff_discount_total, status)
select biz, business_day_bogota(now()), null, juan, 0, 8000, 8000, 0, 0, 2000, 'active' from ctx;

select auth.test_login((select juan_u from ctx));
select is((select stamps from barber_customers('3007070001')), 3,
  'REQ-078.16 la lista del barbero trae los sellos de la tarjeta');
select is((select stamps_required from barber_customers('3007070001')), 10,
  'REQ-078.16 y cuántos pide el programa');
select is((select has_membership from barber_customers('3007070001')), false,
  'REQ-078.16 sin membresía vigente no sale "Familia"');
select is((select phone_last4 from barber_customers('3007070001')), '0001',
  'REQ-018.4 sigue devolviendo solo los últimos 4 dígitos');
select is((select sum(total)::int from my_staff_purchases(business_day_bogota(now()))), 8000,
  'REQ-068 el barbero ve lo que pagó por sus compras con descuento');
select auth.test_logout();

update loyalty_programs set enabled = false where business_id = (select biz from ctx);
select auth.test_login((select juan_u from ctx));
select is((select stamps from barber_customers('3007070001')), null::int,
  'REQ-078.16 con la fidelidad apagada no hay sellos que mostrar');
select auth.test_logout();

select auth.test_login((select pedro_u from ctx));
select is((select count(*)::int from my_staff_purchases(business_day_bogota(now()))), 0,
  'REQ-068 otro barbero no ve las compras de Juan');
select auth.test_logout();

select * from finish();
rollback;
