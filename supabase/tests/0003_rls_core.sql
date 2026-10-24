begin;
select plan(22);

-- Dos negocios (A y B), un dueño y un barbero en cada uno.
insert into auth.users (id, email) values
  ('0000000a-0000-0000-0000-00000000000a', 'dueno-a@test.local'),
  ('0000000a-0000-0000-0000-00000000000b', 'barbero-a@test.local'),
  ('0000000b-0000-0000-0000-00000000000a', 'dueno-b@test.local'),
  ('0000000b-0000-0000-0000-00000000000b', 'barbero-b@test.local');

select auth.test_login('0000000a-0000-0000-0000-00000000000a');
select create_business('Barbería A', 'barberia-a');
select auth.test_logout();
select auth.test_login('0000000b-0000-0000-0000-00000000000a');
select create_business('Barbería B', 'barberia-b');
select auth.test_logout();

-- Barberos y membresías (como lo haría accept_invitation, aquí directo como superusuario).
insert into barbers (id, business_id, user_id, display_name, commission_pct)
select '0000000a-0000-0000-0000-0000000000ba', id, '0000000a-0000-0000-0000-00000000000b', 'Barbero A', 60
from businesses where slug = 'barberia-a';
insert into memberships (user_id, business_id, role, barber_id)
select '0000000a-0000-0000-0000-00000000000b', id, 'barber', '0000000a-0000-0000-0000-0000000000ba'
from businesses where slug = 'barberia-a';

insert into barbers (id, business_id, user_id, display_name, commission_pct)
select '0000000b-0000-0000-0000-0000000000bb', id, '0000000b-0000-0000-0000-00000000000b', 'Barbero B', 50
from businesses where slug = 'barberia-b';
insert into memberships (user_id, business_id, role, barber_id)
select '0000000b-0000-0000-0000-00000000000b', id, 'barber', '0000000b-0000-0000-0000-0000000000bb'
from businesses where slug = 'barberia-b';

insert into services (business_id, name, duration_min, price)
select id, 'Corte A', 20, 25000 from businesses where slug = 'barberia-a';
insert into services (business_id, name, duration_min, price)
select id, 'Corte B', 20, 30000 from businesses where slug = 'barberia-b';

-- ------------------------------------------------- RLS activa y forzada ----
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0, 'REQ-031.1 todas las tablas de public tienen RLS activa'
);

-- ------------------------------------------------- anon no ve nada ----
select auth.test_login(null, 'anon');
select throws_ok($$ select count(*) from businesses $$, '42501', null,
  'NFR-004 anon no tiene acceso a businesses');
select throws_ok($$ select count(*) from services $$, '42501', null,
  'NFR-004 anon no tiene acceso a services');
select auth.test_logout();

-- ------------------------------------------------- dueño A ----
select auth.test_login('0000000a-0000-0000-0000-00000000000a');
select is((select count(*)::int from businesses), 1, 'REQ-031.1 dueño A ve solo su negocio');
select is((select count(*)::int from services), 1, 'REQ-031.1 dueño A ve solo sus servicios');
select is((select name from services), 'Corte A', 'REQ-031.1 ... y es el suyo');
select is((select count(*)::int from barbers), 1, 'REQ-031.1 dueño A ve solo sus barberos');
select lives_ok(
  $$ update services set price = 26000 where name = 'Corte A' $$,
  'REQ-015.1 dueño A edita sus servicios'
);
-- Escritura cruzada: la fila de B es invisible → 0 filas afectadas (no error, pero sin efecto)
update services set price = 1 where name = 'Corte B';
select is((select price from services where name = 'Corte A'), 26000, 'dueño A: su cambio quedó');
select throws_ok(
  $$ insert into services (business_id, name, duration_min, price)
     values ((select id from businesses where slug = 'barberia-b' union all
              select '00000000-0000-0000-0000-000000000000'::uuid limit 1), 'Intruso', 20, 1) $$,
  '42501', null, 'REQ-031.4 dueño A no puede insertar en el negocio B'
);
select auth.test_logout();

-- Comprobación como superusuario: el servicio B no cambió.
select is((select price from services where name = 'Corte B'), 30000,
  'REQ-031.4 el update cruzado del dueño A no tocó el negocio B');

-- ------------------------------------------------- barbero A ----
select auth.test_login('0000000a-0000-0000-0000-00000000000b');
select is((select count(*)::int from businesses), 1, 'REQ-031.1 barbero A ve su negocio');
select is((select count(*)::int from services), 1, 'REQ-031.1 barbero A ve servicios de su negocio');
-- Sin política de update para barbero: la fila se filtra y el update no tiene efecto.
update services set price = 1 where name = 'Corte A';
select is((select price from services where name = 'Corte A'), 26000,
  'REQ-015.1 barbero no edita servicios (update sin efecto)');
select throws_ok(
  $$ insert into services (business_id, name, duration_min, price)
     select id, 'X', 20, 1 from businesses $$,
  '42501', null, 'REQ-015.1 barbero no crea servicios'
);
select lives_ok(
  $$ update barbers set status = 'available', present_day = current_date
     where id = '0000000a-0000-0000-0000-0000000000ba' $$,
  'REQ-010.1 barbero cambia su propio estado'
);
select throws_ok(
  $$ update barbers set commission_pct = 100 where id = '0000000a-0000-0000-0000-0000000000ba' $$,
  '42501', null, 'REQ-025.1 barbero no cambia su comisión'
);
select throws_ok(
  $$ update barbers set is_active = false where id = '0000000a-0000-0000-0000-0000000000ba' $$,
  '42501', null, 'REQ-016.3 barbero no se desactiva a sí mismo'
);
-- La fila del barbero B es invisible: update sin efecto.
update barbers set status = 'paused' where id = '0000000b-0000-0000-0000-0000000000bb';
select is((select count(*)::int from memberships), 2, 'barbero A ve las membresías de su negocio (2)');
select throws_ok(
  $$ insert into memberships (user_id, business_id, role)
     select '0000000a-0000-0000-0000-00000000000b', id, 'owner' from businesses $$,
  '42501', null, 'NFR-004 nadie se vuelve dueño insertando membresías'
);
select auth.test_logout();

select is((select status::text from barbers where id = '0000000b-0000-0000-0000-0000000000bb'), 'off',
  'REQ-031.4 el barbero A no cambió el estado del barbero B');

-- ------------------------------------------------- service_role salta RLS ----
select auth.test_login(null, 'service_role');
select is((select count(*)::int from businesses), 2, 'ADR-009 service_role ve todos los negocios');
select auth.test_logout();

select * from finish();
rollback;
