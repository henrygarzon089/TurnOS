-- T-050 · Criterios de H0 que no tenían prueba (matriz final sin huecos)
-- REQ-015.4 duración igual para todos los barberos · REQ-016.1 alta de barbero · REQ-031.3 varios negocios
begin;
select plan(10);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       (select duration_min from services s where s.business_id = z.id and s.name = 'Barba') as barba_min,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where id in ((select juan from ctx), (select pedro from ctx));

-- REQ-015.4 (PA-09): la duración la pone el servicio, no el barbero
update barbers set duration_factor = 2 where id = (select pedro from ctx); -- campo reservado, sin efecto
select join_queue('la-33', 'Con Juan', '+573005650001', (select barba from ctx), (select juan from ctx), 1);
select join_queue('la-33', 'Con Pedro', '+573005650002', (select barba from ctx), (select pedro from ctx), 1);
select join_queue('la-33', 'Cualquiera', '+573005650003', (select barba from ctx), null, 1);
select is((select count(distinct service_duration_min)::int from tickets where customer_phone_e164 like '+57300565000%'), 1,
  'REQ-015.4 la duración es la misma con cualquier barbero');
select is((select max(service_duration_min) from tickets where customer_phone_e164 like '+57300565000%'), (select barba_min from ctx),
  'REQ-015.4 la duración es la del servicio (el ajuste por barbero está reservado y no se usa)');

-- REQ-016.1 el dueño crea un barbero con nombre, celular, % y estado, y lo invita
select auth.test_login((select owner_u from ctx));
select lives_ok($$
  insert into barbers (business_id, display_name, phone_e164, commission_pct, is_active)
  values ((select biz from ctx), 'Nuevo Barbero', '+573005650009', 55, true)
$$, 'REQ-016.1 el dueño crea un barbero con nombre, celular, porcentaje y activo');
select is((select commission_pct from barbers where display_name = 'Nuevo Barbero'), 55, 'REQ-016.1 guarda el porcentaje de comisión');
select lives_ok($$
  insert into invitations (business_id, barber_id) select (select biz from ctx), id from barbers where display_name = 'Nuevo Barbero'
$$, 'REQ-016.1 el dueño lo invita a crear su acceso');
select ok((select expires_at > now() + interval '6 days' and length(token) >= 22 from invitations i
           join barbers b on b.id = i.barber_id where b.display_name = 'Nuevo Barbero'),
  'REQ-016.1 la invitación tiene enlace no adivinable y vence en 7 días (REQ-030.2)');
select lives_ok($$ update barbers set is_active = false where display_name = 'Nuevo Barbero' $$, 'REQ-016.1 el dueño lo puede desactivar');
select auth.test_logout();

-- REQ-031.3 un usuario en varios negocios (membresías); el MVP muestra el primero
insert into auth.users (id, email) values ('0000000d-0000-0000-0000-00000000000d', 'dueno2@test.local');
select auth.test_login('0000000d-0000-0000-0000-00000000000d');
select create_business('Segunda Barbería', 'segunda-barberia');
select auth.test_logout();
insert into memberships (user_id, business_id, role)
values ((select owner_u from ctx), (select id from businesses where slug = 'segunda-barberia'), 'owner');
select auth.test_login((select owner_u from ctx));
select is((select count(*)::int from memberships where user_id = auth.uid()), 2, 'REQ-031.3 el mismo usuario pertenece a dos negocios');
select ok(is_member_of((select biz from ctx)) and is_owner_of((select id from businesses where slug = 'segunda-barberia')),
  'REQ-031.3 sus permisos valen en cada negocio');
select is((select count(*)::int from businesses where slug in ('la-33', 'segunda-barberia')), 2,
  'REQ-031.3 ve los dos negocios (la interfaz del MVP muestra el primero)');
select auth.test_logout();

select * from finish();
rollback;
