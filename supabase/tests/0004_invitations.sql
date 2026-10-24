begin;
select plan(14);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'dueno-inv@test.local'),
  ('00000000-0000-0000-0000-0000000000b1', '573009990001@barberos.turnos.local'),
  ('00000000-0000-0000-0000-0000000000b2', '573009990002@barberos.turnos.local');

select auth.test_login('00000000-0000-0000-0000-0000000000d1');
select create_business('Barbería Inv', 'barberia-inv');
-- El dueño crea el barbero y la invitación (RLS owner)
insert into barbers (id, business_id, display_name, phone_e164, commission_pct)
select '00000000-0000-0000-0000-0000000000ba', id, 'Nuevo', '+573009990001', 50
from businesses where slug = 'barberia-inv';
insert into invitations (id, business_id, barber_id, token)
select '00000000-0000-0000-0000-0000000000a1', id, '00000000-0000-0000-0000-0000000000ba', 'tok-valido'
from businesses where slug = 'barberia-inv';
insert into invitations (business_id, barber_id, token, expires_at)
select id, '00000000-0000-0000-0000-0000000000ba', 'tok-vencido', now() - interval '1 day'
from businesses where slug = 'barberia-inv';
select auth.test_logout();

-- get_invitation
select is((select is_valid from get_invitation('tok-valido')), true, 'REQ-030.2 invitación válida');
select is((select barber_name from get_invitation('tok-valido')), 'Nuevo', 'REQ-030.2 muestra el nombre del barbero');
select is((select is_valid from get_invitation('tok-vencido')), false, 'REQ-030.2 invitación vencida (7 días)');
select is((select count(*)::int from get_invitation('no-existe')), 0, 'REQ-030.2 token inexistente → vacío');

-- accept_invitation
select throws_ok(
  $$ select accept_invitation('tok-vencido', '00000000-0000-0000-0000-0000000000b1') $$,
  'P0003', null, 'REQ-030.2 no acepta invitación vencida'
);
select lives_ok(
  $$ select accept_invitation('tok-valido', '00000000-0000-0000-0000-0000000000b1') $$,
  'REQ-030.2 acepta invitación válida'
);
select is((select user_id from barbers where id = '00000000-0000-0000-0000-0000000000ba'),
  '00000000-0000-0000-0000-0000000000b1', 'REQ-030.2 barbero vinculado al usuario');
select is((select role::text from memberships where user_id = '00000000-0000-0000-0000-0000000000b1'),
  'barber', 'REQ-030.2 membresía con rol barbero');
select lives_ok(
  $$ select accept_invitation('tok-valido', '00000000-0000-0000-0000-0000000000b1') $$,
  'REQ-011.4 reintento del mismo usuario es idempotente'
);
select throws_ok(
  $$ select accept_invitation('tok-valido', '00000000-0000-0000-0000-0000000000b2') $$,
  'P0003', null, 'REQ-030.2 un segundo usuario no puede usar la invitación'
);

-- remove_barber
select auth.test_login('00000000-0000-0000-0000-0000000000b1');
select throws_ok(
  $$ select remove_barber('00000000-0000-0000-0000-0000000000ba') $$,
  '42501', null, 'REQ-016.3 un barbero no puede retirar barberos'
);
select auth.test_logout();
select auth.test_login('00000000-0000-0000-0000-0000000000d1');
select lives_ok(
  $$ select remove_barber('00000000-0000-0000-0000-0000000000ba') $$,
  'REQ-016.3 el dueño retira al barbero'
);
select auth.test_logout();
select is((select count(*)::int from memberships where user_id = '00000000-0000-0000-0000-0000000000b1'),
  0, 'REQ-030.4 el barbero retirado pierde la membresía');
select is((select is_active from barbers where id = '00000000-0000-0000-0000-0000000000ba'),
  false, 'REQ-016.3 el barbero queda inactivo pero conserva su fila (historial)');

select * from finish();
rollback;
