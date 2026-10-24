begin;
select plan(31);

-- ---------------------------------------------------------------- tablas ----
select has_table('public', 'businesses', 'T-004 tabla businesses');
select has_table('public', 'business_hours', 'T-004 tabla business_hours');
select has_table('public', 'memberships', 'T-004 tabla memberships');
select has_table('public', 'barbers', 'T-004 tabla barbers');
select has_table('public', 'invitations', 'T-004 tabla invitations');
select has_table('public', 'services', 'T-004 tabla services');
select has_table('public', 'products', 'T-004 tabla products');
select has_table('public', 'message_templates', 'T-004 tabla message_templates');
select has_table('public', 'privacy_policy_versions', 'T-004 tabla privacy_policy_versions');

-- Multi-tenant: toda tabla de negocio lleva business_id (P4, REQ-031.1)
select has_column('public', 'business_hours', 'business_id', 'REQ-031.1 business_hours.business_id');
select has_column('public', 'barbers', 'business_id', 'REQ-031.1 barbers.business_id');
select has_column('public', 'services', 'business_id', 'REQ-031.1 services.business_id');
select has_column('public', 'products', 'business_id', 'REQ-031.1 products.business_id');

-- ------------------------------------------------------- create_business ----
insert into auth.users (id, email) values ('00000000-0000-0000-0000-00000000aaaa', 'dueno@test.local');
select auth.test_login('00000000-0000-0000-0000-00000000aaaa');

select lives_ok(
  $$ select create_business('Barbería Prueba', 'barberia-prueba', 'Calle 1 # 2-3, Sabaneta') $$,
  'REQ-030.1 create_business crea el negocio'
);
select auth.test_logout();

select is(
  (select count(*)::int from memberships m join businesses b on b.id = m.business_id
    where b.slug = 'barberia-prueba' and m.role = 'owner'
      and m.user_id = '00000000-0000-0000-0000-00000000aaaa'),
  1, 'REQ-030.1 create_business crea la membresía owner'
);
select is(
  (select count(*)::int from message_templates t join businesses b on b.id = t.business_id
    where b.slug = 'barberia-prueba'),
  3, 'REQ-033.1 create_business crea las 3 plantillas por defecto'
);
select is(
  (select count(*)::int from privacy_policy_versions p join businesses b on b.id = p.business_id
    where b.slug = 'barberia-prueba' and p.version = 1),
  1, 'REQ-002.5 create_business publica la versión 1 del aviso'
);
select is(
  (select count(*)::int from business_hours h join businesses b on b.id = h.business_id
    where b.slug = 'barberia-prueba'),
  7, 'REQ-017.1 create_business crea horario para los 7 días'
);
select is(
  (select chairs_count from businesses where slug = 'barberia-prueba'),
  5, 'REQ-016.2 sillas por defecto = 5'
);
select is(
  (select inactive_days from businesses where slug = 'barberia-prueba'),
  21, 'REQ-020.1 N por defecto = 21 días'
);
select isnt(
  (select screen_key from businesses where slug = 'barberia-prueba'), null,
  'REQ-013.1 screen_key generada'
);

-- ------------------------------------------------------------- checks ----
select throws_ok(
  $$ insert into businesses (name, slug) values ('Otra barbería', 'Mal Slug') $$,
  '23514', null, 'T-004 slug solo [a-z0-9-]'
);
select throws_ok(
  $$ insert into businesses (name, slug) values ('Otra barbería', 'barberia-prueba') $$,
  '23505', null, 'T-004 slug único'
);
select throws_ok(
  $$ insert into services (business_id, name, duration_min, price)
     select id, 'Corte', 22, 25000 from businesses where slug = 'barberia-prueba' $$,
  '23514', null, 'REQ-015.1 duración múltiplo de 5'
);
select throws_ok(
  $$ insert into services (business_id, name, duration_min, price)
     select id, 'Corte', 20, -1 from businesses where slug = 'barberia-prueba' $$,
  '23514', null, 'REQ-015.1 precio >= 0'
);
select throws_ok(
  $$ insert into barbers (business_id, display_name, phone_e164, commission_pct)
     select id, 'Juan', '+573001234567', 101 from businesses where slug = 'barberia-prueba' $$,
  '23514', null, 'REQ-025.1 comisión 0–100'
);
select throws_ok(
  $$ insert into business_hours (business_id, weekday, opens_at, closes_at)
     select id, 7, '09:00', '20:00' from businesses where slug = 'barberia-prueba' $$,
  '23514', null, 'REQ-017.1 weekday 0–6'
);
select col_type_is('public', 'products', 'price', 'integer', 'P9 precio de producto es integer');
select col_type_is('public', 'services', 'price', 'integer', 'P9 precio de servicio es integer');

-- Servicios con precio y duración válidos sí entran
select lives_ok(
  $$ insert into services (business_id, name, duration_min, price)
     select id, 'Corte', 20, 25000 from businesses where slug = 'barberia-prueba' $$,
  'REQ-015.1 servicio válido'
);
select is(
  (select s.is_active from services s join businesses b on b.id = s.business_id
   where s.name = 'Corte' and b.slug = 'barberia-prueba'), true,
  'REQ-015.1 servicio activo por defecto'
);

select * from finish();
rollback;
