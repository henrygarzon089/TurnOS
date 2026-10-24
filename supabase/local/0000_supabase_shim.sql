-- ============================================================================
-- Shim de Supabase para el Postgres local de pruebas (decisions.md ADR-015).
--
-- Imita lo mínimo que las migraciones de supabase/migrations/ usan de un proyecto real:
--   * roles anon / authenticated / service_role
--   * auth.users y auth.uid() / auth.role() / auth.jwt()
--   * realtime.send() (los mensajes se guardan en realtime.messages_local para las pruebas)
--
-- NUNCA se aplica a un proyecto real de Supabase: allí todo esto ya existe.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end $$;

grant usage on schema public to anon, authenticated, service_role;

-- ---------------------------------------------------------------- auth ----
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  phone text,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Igual que Supabase: lee el sub del JWT desde request.jwt.claim.sub o request.jwt.claims.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.jwt() returns jsonb
language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant usage on schema auth to anon, authenticated, service_role;
grant select on auth.users to service_role;

-- ------------------------------------------------------------ realtime ----
create schema if not exists realtime;

create table if not exists realtime.messages_local (
  id bigserial primary key,
  topic text not null,
  event text not null,
  payload jsonb not null,
  private boolean not null,
  inserted_at timestamptz not null default now()
);

-- Misma firma que realtime.send en Supabase.
create or replace function realtime.send(payload jsonb, event text, topic text, private boolean default true)
returns void language plpgsql as $$
begin
  insert into realtime.messages_local (topic, event, payload, private)
  values (topic, event, payload, private);
end $$;

grant usage on schema realtime to anon, authenticated, service_role;

-- --------------------------------------------------- utilidades de prueba ----
-- Simula "soy el usuario X con rol Y" dentro de una transacción de prueba.
create or replace function auth.test_login(user_id uuid, role_name text default 'authenticated')
returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', user_id, 'role', role_name)::text, true);
  execute format('set local role %I', role_name);
end $$;

create or replace function auth.test_logout() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  reset role;
end $$;
