-- T-035 · Configuración de la tarjeta (REQ-019.1, REQ-019.6)
begin;
select plan(7);

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

create or replace function _visit(p_phone text) returns void language plpgsql as $$
declare v_id uuid;
begin
  perform join_queue('la-33', 'Fiel Prueba', p_phone, (select corte from ctx), null, 1);
  select id into v_id from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', (select juan_u from ctx), 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v_id, 'called', 'barber', null, (select juan from ctx));
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v_id, 'in_service', 'barber');
  perform transition_ticket(v_id, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
end $$;

update loyalty_programs set enabled = true, visits_required = 10 where business_id = (select biz from ctx);
select _visit('+573005590001') from generate_series(1, 8);
create temp table before as select sum(stamps) as total, count(*) as cards from loyalty_cards where business_id = (select biz from ctx);
grant select on before to public;

-- El barbero no configura
select auth.test_login((select juan_u from ctx));
update loyalty_programs set visits_required = 2 where business_id = (select biz from ctx);
select is((select visits_required from loyalty_programs where business_id = (select biz from ctx)), 10, 'REQ-019.1 solo el dueño configura la tarjeta');
select auth.test_logout();

-- El dueño baja a 8: no se borran ni cambian sellos
select auth.test_login((select owner_u from ctx));
update loyalty_programs set visits_required = 8, updated_at = now() where business_id = (select biz from ctx);
select auth.test_logout();
select is((select sum(stamps) from loyalty_cards where business_id = (select biz from ctx)), (select total from before), 'REQ-019.6 cambiar la configuración no borra sellos');
select is((select count(*) from loyalty_cards where business_id = (select biz from ctx)), (select cards from before), 'REQ-019.6 no crea ni borra tarjetas');
select is((select status::text from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005590001'), 'active',
  'REQ-019.6 la tarjeta con 8 sellos no se completa sola al cambiar la regla');

-- El siguiente sello usa la regla nueva
select _visit('+573005590001');
select is((select stamps from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005590001'), 9, 'REQ-019.6 el sello siguiente se suma');
select is((select status::text from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005590001'), 'completed',
  'REQ-019.6 la regla nueva aplica a los sellos futuros');

-- Un servicio que no suma no agrega sello (REQ-019.1 qué servicios suman)
update services set counts_for_loyalty = false where id = (select corte from ctx);
select _visit('+573005590002');
select is((select count(*)::int from loyalty_cards lc join customers c on c.id = lc.customer_id where c.phone_e164 = '+573005590002'), 0,
  'REQ-019.1 un servicio que no suma no agrega sello');

select * from finish();
rollback;
