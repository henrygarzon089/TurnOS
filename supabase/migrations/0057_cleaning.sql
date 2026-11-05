-- 0057 · Hito 11, limpieza y bioseguridad: datos, listas, activación, RLS y bucket privado (T-100, ADR-037)
-- Cubre: REQ-060.1–060.3, REQ-063.4, REQ-064.5. Diseño: design.md §16.1–§16.4.
-- Con la limpieza apagada nada cambia. Los registros y avisos son 0058; revisión, tareas y purga, 0059.

-- ------------------------------------------------------------ columnas ----
-- REQ-060.1 nace apagada; cleaning_enabled_on es el primer día encendida (REQ-062.8) y no cambia
alter table businesses
  add column cleaning_enabled boolean not null default false,
  add column cleaning_enabled_on date,
  add column cleaning_purged_on date;

create type cleaning_kind as enum ('opening', 'closing', 'deep', 'between_clients');

-- ------------------------------------------------------------- tablas ----
-- REQ-060.2/060.3 los puntos de cada lista, en orden
create table cleaning_checklist_items (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  kind cleaning_kind not null,
  label text not null check (label = btrim(label) and length(label) between 1 and 80),
  sort_order int not null,
  created_at timestamptz not null default now()
);
create index cleaning_checklist_items_list_idx on cleaning_checklist_items (business_id, kind, sort_order);

-- REQ-061 apertura y cierre por día, profunda por semana; items = copia [{label, done, note}]
create table cleaning_records (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  kind cleaning_kind not null check (kind <> 'between_clients'),
  business_day date not null,
  week_start date not null,
  done_by uuid not null,
  barber_id uuid,
  created_at timestamptz not null default now(),
  is_complete boolean not null,
  is_late boolean not null default false,
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  photo_paths text[] not null default '{}',
  photos_purged_at timestamptz,
  constraint cleaning_records_week_ck check (week_start = date_trunc('week', business_day)::date),
  foreign key (business_id, barber_id) references barbers (business_id, id)
);
create unique index cleaning_records_daily_uq on cleaning_records (business_id, kind, business_day)
  where kind in ('opening', 'closing');
create unique index cleaning_records_deep_uq on cleaning_records (business_id, week_start)
  where kind = 'deep';

-- REQ-063 revisión del dueño; items = copia [{group, label, ok, note, photoPath, barberId}]
create table cleaning_inspections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  done_by uuid not null,
  created_at timestamptz not null default now(),
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  photos_purged_at timestamptz
);
create index cleaning_inspections_biz_idx on cleaning_inspections (business_id, created_at);

-- REQ-062.3 "Cierre sin registrar" marcado como visto por el dueño
create table cleaning_missed_acks (
  business_id uuid not null references businesses (id) on delete cascade,
  business_day date not null,
  note text check (note is null or length(note) <= 200),
  acked_by uuid not null,
  acked_at timestamptz not null default now(),
  primary key (business_id, business_day)
);

-- REQ-064.1/064.2 tareas periódicas del dueño y cada vez que se hicieron
create table cleaning_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  every_days int not null check (every_days between 1 and 730),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (business_id, id)
);

create table cleaning_task_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  task_id uuid not null,
  done_on date not null,
  note text check (note is null or length(note) <= 200),
  attachment_path text,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint cleaning_task_runs_past_ck check (done_on <= business_day_bogota(created_at)),
  foreign key (business_id, task_id) references cleaning_tasks (business_id, id) on delete cascade
);
create index cleaning_task_runs_task_idx on cleaning_task_runs (task_id, done_on desc);

-- ------------------------------------------------------------------ RLS ----
-- §16.2 el dueño lee; el barbero no ve tablas (sus datos salen de cleaning_today, 0058);
-- todos los cambios van por funciones security definer
alter table cleaning_checklist_items enable row level security;
alter table cleaning_checklist_items force row level security;
alter table cleaning_records enable row level security;
alter table cleaning_records force row level security;
alter table cleaning_inspections enable row level security;
alter table cleaning_inspections force row level security;
alter table cleaning_missed_acks enable row level security;
alter table cleaning_missed_acks force row level security;
alter table cleaning_tasks enable row level security;
alter table cleaning_tasks force row level security;
alter table cleaning_task_runs enable row level security;
alter table cleaning_task_runs force row level security;

create policy cleaning_checklist_items_owner_select on cleaning_checklist_items for select to authenticated
  using (is_owner_of(business_id));
create policy cleaning_records_owner_select on cleaning_records for select to authenticated
  using (is_owner_of(business_id));
create policy cleaning_inspections_owner_select on cleaning_inspections for select to authenticated
  using (is_owner_of(business_id));
create policy cleaning_missed_acks_owner_select on cleaning_missed_acks for select to authenticated
  using (is_owner_of(business_id));
create policy cleaning_tasks_owner_select on cleaning_tasks for select to authenticated
  using (is_owner_of(business_id));
create policy cleaning_task_runs_owner_select on cleaning_task_runs for select to authenticated
  using (is_owner_of(business_id));

revoke all on cleaning_checklist_items, cleaning_records, cleaning_inspections, cleaning_missed_acks,
  cleaning_tasks, cleaning_task_runs from public, anon, authenticated;
grant select on cleaning_checklist_items, cleaning_records, cleaning_inspections, cleaning_missed_acks,
  cleaning_tasks, cleaning_task_runs to authenticated;
grant all on cleaning_checklist_items, cleaning_records, cleaning_inspections, cleaning_missed_acks,
  cleaning_tasks, cleaning_task_runs to service_role;

-- ------------------------------------------------------------ funciones ----
-- Barbero activo del negocio (el dueño con silla también lo es, pero se reconoce por is_owner_of)
create or replace function cleaning_is_active_barber(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from barbers
                 where business_id = p_business_id and id = my_barber_id(p_business_id) and is_active)
$$;

-- REQ-060.2 los puntos por defecto (documento de Henry); solo llena las listas vacías
create or replace function cleaning_seed_lists(p_business_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_defaults jsonb := jsonb_build_object(
    'opening', jsonb_build_array('Ventilar',
      'Preparar la solución desinfectante del día, marcada con la fecha',
      'Dotación y toallas limpias en cada estación', 'Baño limpio con jabón y toallas',
      'Calentador de toallas encendido', 'Revisar la nevera de bebidas'),
    'closing', jsonb_build_array('Barrer y trapear',
      'Desinfectar todas las herramientas y desechar la solución', 'Lavacabezas y desagüe',
      'Espejos, mesones, sillas y rincón de niños', 'Baño completo', 'Basura separada por colores',
      'Toallas a lavar', 'Apagar equipos'),
    'deep', jsonb_build_array('Sillas a fondo, con mecanismos',
      'Desagües, vidrios, zonas altas y lámparas', 'Debajo de muebles y detrás de estaciones',
      'Nevera, plantas y fechas de vencimiento'),
    'between_clients', jsonb_build_array('Pelo barrido', 'Herramientas lavadas y desinfectadas',
      'Máquinas con Cool Care', 'Cuchilla nueva', 'Silla desinfectada', 'Capa, papel cuello y toalla',
      'Manos o guantes'));
  v_kind text;
begin
  for v_kind in select jsonb_object_keys(v_defaults) loop
    if not exists (select 1 from cleaning_checklist_items
                   where business_id = p_business_id and kind = v_kind::cleaning_kind) then
      insert into cleaning_checklist_items (business_id, kind, label, sort_order)
      select p_business_id, v_kind::cleaning_kind, e.label, e.ord
      from jsonb_array_elements_text(v_defaults -> v_kind) with ordinality as e(label, ord);
    end if;
  end loop;
end $$;

-- REQ-060.1/060.2 encender o apagar; la primera vez fija el día y siembra las listas
create or replace function cleaning_set_enabled(p_business_id uuid, p_enabled boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  update businesses
     set cleaning_enabled = coalesce(p_enabled, false),
         cleaning_enabled_on = case when p_enabled then coalesce(cleaning_enabled_on, business_day_bogota())
                                    else cleaning_enabled_on end
   where id = p_business_id;
  if p_enabled then
    perform cleaning_seed_lists(p_business_id);
  end if;
end $$;

-- REQ-060.3 reemplaza la lista en el orden dado: conserva los ids que vienen, crea los nuevos
-- (id null) y borra los que faltan. Los registros guardan su copia, así que borrar es seguro.
create or replace function cleaning_save_list(p_business_id uuid, p_kind cleaning_kind, p_items jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  e record;
  v_label text;
  v_id uuid;
  v_ids uuid[] := '{}';
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'LIST_EMPTY' using errcode = 'P0004';
  end if;

  for e in select value as item from jsonb_array_elements(p_items) loop
    v_label := btrim(e.item ->> 'label');
    if v_label is null or length(v_label) not between 1 and 80 then
      raise exception 'INVALID_LABEL' using errcode = 'P0004';
    end if;
    v_id := nullif(e.item ->> 'id', '')::uuid;
    if v_id is not null then
      if v_id = any(v_ids) or not exists (select 1 from cleaning_checklist_items
                                          where id = v_id and business_id = p_business_id and kind = p_kind) then
        raise exception 'INVALID_ITEM' using errcode = 'P0004';
      end if;
      v_ids := v_ids || v_id;
    end if;
  end loop;

  delete from cleaning_checklist_items
   where business_id = p_business_id and kind = p_kind and not (id = any(v_ids));

  for e in select value as item, ord from jsonb_array_elements(p_items) with ordinality as x(value, ord) loop
    v_label := btrim(e.item ->> 'label');
    v_id := nullif(e.item ->> 'id', '')::uuid;
    if v_id is null then
      insert into cleaning_checklist_items (business_id, kind, label, sort_order)
      values (p_business_id, p_kind, v_label, e.ord);
    else
      update cleaning_checklist_items set label = v_label, sort_order = e.ord where id = v_id;
    end if;
  end loop;

  return (select jsonb_agg(jsonb_build_object('id', id, 'label', label) order by sort_order)
          from cleaning_checklist_items where business_id = p_business_id and kind = p_kind);
end $$;

-- ------------------------------------------------------------- Storage ----
-- §16.3 bucket `cleaning`, privado: nada se lee sin sesión. Rutas:
--   <negocio>/records/<día>/<uuid>.webp            dueño y barberos activos (subir y abrir)
--   <negocio>/inspections/<uuid>.webp              solo el dueño
--   <negocio>/tasks/<tarea>/<uuid>.(webp|pdf)      solo el dueño, tarea del negocio
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('cleaning', 'cleaning', false, 5242880, array['image/webp', 'image/jpeg', 'application/pdf'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function cleaning_can_access(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  u constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
  m text[];
  v_biz uuid;
begin
  m := regexp_match(p_name, '^(' || u || ')/(?:(records)/\d{4}-\d{2}-\d{2}/' || u || '\.webp'
                         || '|(inspections)/' || u || '\.webp'
                         || '|tasks/(' || u || ')/' || u || '\.(?:webp|pdf))$');
  if m is null then return false; end if;
  v_biz := m[1]::uuid;
  if m[2] is not null then
    return is_owner_of(v_biz) or cleaning_is_active_barber(v_biz);
  end if;
  if m[3] is not null then
    return is_owner_of(v_biz);
  end if;
  return is_owner_of(v_biz)
     and exists (select 1 from cleaning_tasks where id = m[4]::uuid and business_id = v_biz);
end $$;

drop policy if exists turnos_cleaning_select on storage.objects;
drop policy if exists turnos_cleaning_insert on storage.objects;
drop policy if exists turnos_cleaning_delete on storage.objects;
create policy turnos_cleaning_select on storage.objects for select to authenticated
  using (bucket_id = 'cleaning' and public.cleaning_can_access(name));
create policy turnos_cleaning_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'cleaning' and public.cleaning_can_access(name));
-- Borrar: el dueño (la purga de 90 días corre con service_role, §16.3)
create policy turnos_cleaning_delete on storage.objects for delete to authenticated
  using (bucket_id = 'cleaning' and public.cleaning_can_access(name)
         and case when name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
                  then public.is_owner_of(substr(name, 1, 36)::uuid) else false end);

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  cleaning_is_active_barber(uuid),
  cleaning_seed_lists(uuid),
  cleaning_set_enabled(uuid, boolean),
  cleaning_save_list(uuid, cleaning_kind, jsonb),
  cleaning_can_access(text)
from public, anon, authenticated;
grant execute on function
  cleaning_is_active_barber(uuid),
  cleaning_seed_lists(uuid),
  cleaning_set_enabled(uuid, boolean),
  cleaning_save_list(uuid, cleaning_kind, jsonb),
  cleaning_can_access(text)
to service_role;
-- Personal (cada una valida el negocio por dentro); cleaning_can_access la usan las políticas de Storage
grant execute on function
  cleaning_set_enabled(uuid, boolean),
  cleaning_save_list(uuid, cleaning_kind, jsonb),
  cleaning_can_access(text)
to authenticated;
