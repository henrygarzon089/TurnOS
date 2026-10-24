-- Completa los usuarios de Auth del seed para el Supabase local CON Docker (supabase start).
--
-- supabase/seed.sql solo inserta (id, email) en auth.users: basta para el shim sin Docker
-- (ADR-015), pero GoTrue necesita contraseña, aud/role, tokens vacíos (no NULL) e identidad
-- para dejar entrar. `supabase db reset` aplica este archivo después de seed.sql
-- (config.toml → db.seed.sql_paths); `pnpm db:seed-auth` lo vuelve a aplicar a mano.
-- Mismas credenciales que scripts/seed-users.ts y tests/e2e/helpers.ts. Idempotente.
-- En el proyecto de demo de la nube (uucjmxdssnmvznibrafc) se aplicó igual, con
-- `supabase db push --include-seed` (2026-10-24), para no manejar la llave service_role. En un
-- negocio real NO: allá los usuarios los crea la app (registro del dueño, invitación del barbero).

with creds(id, email, pin) as (
  values
    ('a0000000-0000-4000-8000-000000000001'::uuid, 'dueno@la33.test', 'turnos123'),
    ('b0000000-0000-4000-8000-000000000001'::uuid, '573001000001@barberos.turnos.local', '111111'),
    ('b0000000-0000-4000-8000-000000000002'::uuid, '573001000002@barberos.turnos.local', '222222'),
    ('b0000000-0000-4000-8000-000000000003'::uuid, '573001000003@barberos.turnos.local', '333333'),
    ('b0000000-0000-4000-8000-000000000004'::uuid, '573001000004@barberos.turnos.local', '444444'),
    ('b0000000-0000-4000-8000-000000000005'::uuid, '573001000005@barberos.turnos.local', '555555')
)
update auth.users u set
  instance_id = '00000000-0000-0000-0000-000000000000',
  aud = 'authenticated',
  role = 'authenticated',
  encrypted_password = extensions.crypt(c.pin, extensions.gen_salt('bf')),
  email_confirmed_at = coalesce(u.email_confirmed_at, now()),
  raw_app_meta_data = '{"provider": "email", "providers": ["email"]}',
  raw_user_meta_data = coalesce(u.raw_user_meta_data, '{}'),
  confirmation_token = '',
  recovery_token = '',
  email_change_token_new = '',
  email_change_token_current = '',
  email_change = '',
  phone_change = '',
  phone_change_token = '',
  reauthentication_token = '',
  created_at = coalesce(u.created_at, now()),
  updated_at = now()
from creds c
where u.id = c.id;

insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email = 'dueno@la33.test' or u.email like '%@barberos.turnos.local'
on conflict (provider_id, provider) do nothing;
