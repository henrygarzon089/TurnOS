-- 0002 · Núcleo multi-tenant (T-004)
-- Cubre: REQ-015, REQ-016.1–16.2, REQ-017.1, REQ-030.1, REQ-031.3, REQ-033.1, REQ-002.5
-- Diseño: design.md §2.2

-- ------------------------------------------------------------- enums ----
create type membership_role as enum ('owner', 'barber');
create type barber_status as enum ('available', 'busy', 'paused', 'off');
create type queue_override as enum ('auto', 'open', 'closed');
create type message_template_key as enum ('notify_2_turns', 'reminder_inactive', 'share_queue');

-- --------------------------------------------------------- utilidades ----
-- Token aleatorio en base64url (NFR-004: >= 128 bits). 16 bytes → 22 caracteres.
create or replace function gen_public_token(n_bytes int default 16) returns text
language sql volatile set search_path = public, extensions as $$
  select translate(encode(gen_random_bytes(n_bytes), 'base64'), '+/=', '-_')
$$;

-- -------------------------------------------------------- businesses ----
create table businesses (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  address text,
  timezone text not null default 'America/Bogota',
  chairs_count int not null default 5 check (chairs_count between 1 and 50),
  default_commission_pct int not null default 50 check (default_commission_pct between 0 and 100),
  grace_minutes int not null default 5 check (grace_minutes between 1 and 60),
  inactive_days int not null default 21 check (inactive_days between 1 and 365),
  reminder_cooldown_days int not null default 7 check (reminder_cooldown_days between 1 and 90),
  queue_override queue_override not null default 'auto',
  queue_override_day date,
  screen_key text not null default gen_public_token(12),
  pwa_name text,
  created_at timestamptz not null default now()
);

create table business_hours (
  business_id uuid not null references businesses (id) on delete cascade,
  weekday int not null check (weekday between 0 and 6), -- 0 = domingo
  opens_at time not null default '09:00',
  closes_at time not null default '20:00',
  is_closed boolean not null default false,
  primary key (business_id, weekday),
  check (is_closed or closes_at > opens_at)
);

-- ----------------------------------------------------------- barbers ----
create table barbers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (length(trim(display_name)) between 1 and 60),
  phone_e164 text check (phone_e164 ~ '^\+57 3\d{9}$' or phone_e164 ~ '^\+573\d{9}$'),
  commission_pct int not null check (commission_pct between 0 and 100),
  is_active boolean not null default true,
  status barber_status not null default 'off',
  present_day date,
  sort_order int not null default 0,
  duration_factor numeric, -- reservado (PA-09), no usado en el MVP
  created_at timestamptz not null default now()
);
create index barbers_business_idx on barbers (business_id, is_active, sort_order);
create unique index barbers_user_business_uniq on barbers (business_id, user_id) where user_id is not null;

-- ------------------------------------------------------- memberships ----
create table memberships (
  user_id uuid not null references auth.users (id) on delete cascade,
  business_id uuid not null references businesses (id) on delete cascade,
  role membership_role not null,
  barber_id uuid references barbers (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, business_id)
);
create index memberships_business_idx on memberships (business_id);

create table invitations (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  barber_id uuid not null references barbers (id) on delete cascade,
  token text not null unique default gen_public_token(16),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------- servicios/productos ----
create table services (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  duration_min int not null check (duration_min > 0 and duration_min % 5 = 0),
  price int not null check (price >= 0),
  is_active boolean not null default true,
  counts_for_loyalty boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index services_business_idx on services (business_id, is_active, sort_order);

create table products (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 60),
  price int not null check (price >= 0),
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index products_business_idx on products (business_id, is_active, sort_order);

-- --------------------------------------------- plantillas y privacidad ----
create table message_templates (
  business_id uuid not null references businesses (id) on delete cascade,
  key message_template_key not null,
  body text not null check (length(body) between 1 and 1000),
  primary key (business_id, key)
);

create table privacy_policy_versions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  version int not null check (version >= 1),
  body text not null,
  published_at timestamptz not null default now(),
  unique (business_id, version)
);

-- --------------------------------------------------- create_business ----
-- Crea el negocio para el usuario autenticado: membresía owner, horario por defecto
-- (L–S 9–20, D 10–16), plantillas y aviso de privacidad v1 (plantilla base, revisar con abogado).
create or replace function create_business(p_name text, p_slug text, p_address text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  insert into businesses (name, slug, address) values (p_name, p_slug, p_address) returning id into v_id;
  insert into memberships (user_id, business_id, role) values (v_uid, v_id, 'owner');

  insert into business_hours (business_id, weekday, opens_at, closes_at, is_closed)
  select v_id, d, case when d = 0 then '10:00'::time else '09:00'::time end,
         case when d = 0 then '16:00'::time else '20:00'::time end, false
  from generate_series(0, 6) as d;

  insert into message_templates (business_id, key, body) values
    (v_id, 'notify_2_turns',
     'Hola {nombre}, te saluda {negocio}. Faltan 2 turnos para el tuyo ({tiempo}). Ve saliendo. Sigue tu turno aquí: {enlace}'),
    (v_id, 'reminder_inactive',
     'Hola {nombre}, en {negocio} te extrañamos. ¿Te apartamos un turno? Toma el tuyo sin filas aquí: {enlace}'),
    (v_id, 'share_queue',
     'Toma tu turno en {negocio} sin esperar en el local: {enlace}');

  insert into privacy_policy_versions (business_id, version, body) values (v_id, 1,
    'AVISO DE PRIVACIDAD (plantilla base — revisar con abogado). ' || p_name ||
    ' es responsable del tratamiento de los datos personales (nombre y número de celular) que usted ' ||
    'entrega para tomar turno. Finalidad: gestionar su turno, contactarlo por WhatsApp sobre su turno y, ' ||
    'si lo acepta, enviarle recordatorios y beneficios de fidelidad. Usted puede conocer, actualizar, ' ||
    'rectificar y suprimir sus datos, y revocar esta autorización, solicitándolo en el local. ' ||
    'Tratamiento conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.');

  return v_id;
end $$;

revoke all on function create_business(text, text, text) from public;
grant execute on function create_business(text, text, text) to authenticated, service_role;
