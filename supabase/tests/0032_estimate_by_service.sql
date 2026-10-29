-- T-053/T-054 · Datos para el estimado y el formulario según quién hace cada servicio
-- (REQ-035.6, REQ-035.10)
begin;
select plan(3);

create temp table ctx as
select z.id as biz,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Mateo') as mateo,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);
insert into services (business_id, name, duration_min, price) values ((select biz from ctx), 'Cepillado', 30, 25000);
select auth.test_login((select owner_u from ctx));
select set_service_barbers((select id from services where name = 'Cepillado' and business_id = (select biz from ctx)),
                           array[(select mateo from ctx)]);
select auth.test_logout();
select join_queue('la-33', 'Ana', '+573005680001',
                  (select id from services where name = 'Cepillado' and business_id = (select biz from ctx)), null, 1);

select is(
  (select s->'barberIds' from jsonb_array_elements(get_public_business('la-33')->'services') s where s->>'name' = 'Cepillado'),
  jsonb_build_array((select mateo from ctx)),
  'REQ-035.6 la portada dice quién hace cada servicio (solo Mateo hace cepillado)');
select is(
  (select jsonb_array_length(s->'barberIds') from jsonb_array_elements(get_public_business('la-33')->'services') s where s->>'name' = 'Corte'),
  (select count(*)::int from barbers where business_id = (select biz from ctx)),
  'REQ-035.6 un servicio que hacen todos trae a todos');
select is(
  (select w->'capableBarberIds' from jsonb_array_elements(queue_snapshot((select biz from ctx))->'waiting') w
   where w->>'id' = (select id::text from tickets where customer_phone_e164 = '+573005680001' and status = 'waiting')),
  jsonb_build_array((select mateo from ctx)),
  'REQ-035.10 cada turno en espera trae quién puede atenderlo (para el estimado)');

select * from finish();
rollback;
