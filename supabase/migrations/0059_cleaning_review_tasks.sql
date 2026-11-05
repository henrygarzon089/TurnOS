-- 0059 · Hito 11, limpieza: revisión del dueño, historial, tareas periódicas y purga (T-102, ADR-037)
-- Cubre: REQ-063.1–063.7, REQ-064.1, 064.2, 064.4, 064.6. Diseño: design.md §16.3–§16.4.

-- ¿La foto ya pasó los 90 días (o ya se purgó)? REQ-064.6: desde ese día no se muestra
create or replace function cleaning_photos_gone(p_created_at timestamptz, p_purged_at timestamptz) returns boolean
language sql stable set search_path = public as $$
  select p_purged_at is not null or p_created_at < cleaning_now() - interval '90 days'
$$;

-- --------------------------------------------------- revisión del dueño ----
-- REQ-063.1–063.3 todos los puntos actuales de Cierre y Entre clientes, cada uno Bien o Falla
create or replace function submit_cleaning_inspection(p_business_id uuid, p_items jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := cleaning_now();
  v_sent text[];
  v_list text[];
  e jsonb;
  v_barber uuid;
  v_snapshot jsonb;
  v_id uuid;
  u constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not (select cleaning_enabled from businesses where id = p_business_id) then
    raise exception 'CLEANING_DISABLED' using errcode = 'P0004';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'LIST_CHANGED' using errcode = 'P0004';
  end if;

  select coalesce(array_agg(x ->> 'id' order by x ->> 'id'), '{}') into v_sent from jsonb_array_elements(p_items) x;
  select coalesce(array_agg(id::text order by id::text), '{}') into v_list
    from cleaning_checklist_items where business_id = p_business_id and kind in ('closing', 'between_clients');
  if v_sent is distinct from v_list or cardinality(v_list) = 0 then
    raise exception 'LIST_CHANGED' using errcode = 'P0004';
  end if;

  for e in select x from jsonb_array_elements(p_items) x loop
    if jsonb_typeof(e -> 'ok') is distinct from 'boolean' then
      raise exception 'INSPECTION_INCOMPLETE' using errcode = 'P0004';
    end if;
  end loop;
  for e in select x from jsonb_array_elements(p_items) x loop
    if length(btrim(e ->> 'note')) > 200 then
      raise exception 'INVALID_NOTE' using errcode = 'P0004';
    end if;
    v_barber := nullif(e ->> 'barberId', '')::uuid;
    if v_barber is not null and ((e ->> 'ok')::boolean
       or not exists (select 1 from barbers where business_id = p_business_id and id = v_barber and is_active)) then
      raise exception 'INVALID_BARBER' using errcode = 'P0004';
    end if;
    if nullif(e ->> 'photoPath', '') is not null
       and (e ->> 'photoPath') !~ ('^' || p_business_id::text || '/inspections/' || u || '\.webp$') then
      raise exception 'INVALID_PATH' using errcode = 'P0004';
    end if;
  end loop;

  -- REQ-060.4 copia de las etiquetas: primero el cierre, después entre clientes
  select jsonb_agg(jsonb_build_object(
           'group', c.kind, 'label', c.label, 'ok', (x ->> 'ok')::boolean,
           'note', nullif(btrim(x ->> 'note'), ''), 'photoPath', nullif(x ->> 'photoPath', ''),
           'barberId', nullif(x ->> 'barberId', '')::uuid)
         order by c.kind, c.sort_order)
    into v_snapshot
    from cleaning_checklist_items c
    join jsonb_array_elements(p_items) x on (x ->> 'id')::uuid = c.id
   where c.business_id = p_business_id;

  insert into cleaning_inspections (business_id, done_by, created_at, items)
  values (p_business_id, auth.uid(), v_now, v_snapshot)
  returning id into v_id;

  return jsonb_build_object('id', v_id,
    'failures', (select count(*) from jsonb_array_elements(v_snapshot) i where not (i ->> 'ok')::boolean));
end $$;

-- -------------------------------------------------------------- historial ----
-- REQ-063.5–063.7 por semana (lunes a domingo) y por barbero; solo conteos, sin niveles
create or replace function cleaning_history(p_business_id uuid, p_weeks int default 8) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := business_day_bogota(cleaning_now());
  v_week date := date_trunc('week', v_today)::date;
  v_enabled_on date;
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_weeks is null or p_weeks not between 1 and 52 then
    raise exception 'INVALID_WEEKS' using errcode = 'P0004';
  end if;
  select cleaning_enabled_on into v_enabled_on from businesses where id = p_business_id;

  return (
    select coalesce(jsonb_agg(wk.j order by wk.ws desc), '[]'::jsonb)
    from (
      select w.ws, jsonb_build_object(
        'weekStart', w.ws,
        'deepDone', exists (select 1 from cleaning_records r where r.business_id = p_business_id
                              and r.kind = 'deep' and r.week_start = w.ws),
        'missedClosings', (
          select count(*) from generate_series(w.ws, least(w.ws + 6, v_today - 1), interval '1 day') d
          where v_enabled_on is not null and d::date >= v_enabled_on
            and cleaning_is_open_day(p_business_id, d::date)
            and not exists (select 1 from cleaning_records r where r.business_id = p_business_id
                              and r.kind = 'closing' and r.business_day = d::date)),
        'inspections', (select count(*) from cleaning_inspections i where i.business_id = p_business_id
                          and date_trunc('week', business_day_bogota(i.created_at))::date = w.ws),
        'generalFailures', (
          select count(*) from cleaning_inspections i, jsonb_array_elements(i.items) it
          where i.business_id = p_business_id
            and date_trunc('week', business_day_bogota(i.created_at))::date = w.ws
            and not (it ->> 'ok')::boolean and it -> 'barberId' = 'null'::jsonb),
        'barbers', (
          select coalesce(jsonb_agg(jsonb_build_object(
                   'barberId', p.barber_id, 'name', cleaning_done_by_name(p_business_id, p.barber_id),
                   'complete', p.complete, 'incomplete', p.incomplete, 'late', p.late, 'failures', p.failures)
                 order by p.barber_id is null, cleaning_done_by_name(p_business_id, p.barber_id)), '[]'::jsonb)
          from (
            select a.barber_id,
                   count(*) filter (where a.src = 'r' and a.is_complete) as complete,
                   count(*) filter (where a.src = 'r' and not a.is_complete) as incomplete,
                   count(*) filter (where a.src = 'r' and a.is_late) as late,
                   count(*) filter (where a.src = 'f') as failures
            from (
              select 'r' as src, r.barber_id, r.is_complete, r.is_late from cleaning_records r
               where r.business_id = p_business_id and r.week_start = w.ws
              union all
              select 'f', (it ->> 'barberId')::uuid, null, null
                from cleaning_inspections i, jsonb_array_elements(i.items) it
               where i.business_id = p_business_id
                 and date_trunc('week', business_day_bogota(i.created_at))::date = w.ws
                 and not (it ->> 'ok')::boolean and it -> 'barberId' <> 'null'::jsonb
            ) a
            group by a.barber_id
          ) p),
        'entries', (
          select coalesce(jsonb_agg(en.j order by en.at desc), '[]'::jsonb)
          from (
            select r.created_at as at, cleaning_record_json(r) || jsonb_build_object('type', 'record') as j
              from cleaning_records r where r.business_id = p_business_id and r.week_start = w.ws
            union all
            select i.created_at, jsonb_build_object(
                     'type', 'inspection', 'id', i.id, 'businessDay', business_day_bogota(i.created_at),
                     'at', cleaning_iso(i.created_at), 'doneBy', 'Dueño',
                     'failures', (select count(*) from jsonb_array_elements(i.items) it where not (it ->> 'ok')::boolean))
              from cleaning_inspections i
             where i.business_id = p_business_id
               and date_trunc('week', business_day_bogota(i.created_at))::date = w.ws
          ) en)
      ) as j
      from (select (v_week - 7 * g)::date as ws from generate_series(0, p_weeks - 1) g) w
    ) wk);
end $$;

-- REQ-063.6/064.6 detalle de un registro: puntos, notas, quién, hora y fotos (si no pasaron 90 días)
create or replace function cleaning_record_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r cleaning_records;
  v_gone boolean;
begin
  select * into r from cleaning_records where id = p_id;
  if not found or not is_owner_of(r.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_gone := cleaning_photos_gone(r.created_at, r.photos_purged_at);
  return cleaning_record_json(r) || jsonb_build_object(
    'items', r.items,
    'photos', case when v_gone then '[]'::jsonb else to_jsonb(r.photo_paths) end,
    'photosPurged', v_gone and cardinality(r.photo_paths) > 0 or r.photos_purged_at is not null);
end $$;

create or replace function cleaning_inspection_detail(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  i cleaning_inspections;
  v_gone boolean;
begin
  select * into i from cleaning_inspections where id = p_id;
  if not found or not is_owner_of(i.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_gone := cleaning_photos_gone(i.created_at, i.photos_purged_at);
  return jsonb_build_object(
    'id', i.id, 'at', cleaning_iso(i.created_at), 'doneBy', 'Dueño',
    'items', case when v_gone
                  then (select jsonb_agg(it || jsonb_build_object('photoPath', null, 'photoPurged', it ->> 'photoPath' is not null))
                        from jsonb_array_elements(i.items) it)
                  else i.items end,
    'photosPurged', v_gone);
end $$;

-- ------------------------------------------------------ tareas periódicas ----
-- REQ-064.1 crear o editar (solo el dueño)
create or replace function save_cleaning_task(p_business_id uuid, p_id uuid, p_name text, p_every_days int,
                                              p_is_active boolean)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_name text := btrim(p_name);
  v_id uuid;
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_name is null or length(v_name) not between 1 and 80 then
    raise exception 'INVALID_NAME' using errcode = 'P0004';
  end if;
  if p_every_days is null or p_every_days not between 1 and 730 then
    raise exception 'INVALID_FREQUENCY' using errcode = 'P0004';
  end if;
  if p_id is null then
    insert into cleaning_tasks (business_id, name, every_days, is_active)
    values (p_business_id, v_name, p_every_days, coalesce(p_is_active, true))
    returning id into v_id;
  else
    update cleaning_tasks set name = v_name, every_days = p_every_days, is_active = coalesce(p_is_active, true)
     where id = p_id and business_id = p_business_id
    returning id into v_id;
    if v_id is null then
      raise exception 'NOT_FOUND' using errcode = 'P0004';
    end if;
  end if;
  return v_id;
end $$;

-- REQ-064.2/064.3 cada vez que se hizo, con fecha, nota y adjunto opcionales; no reemplaza la anterior
create or replace function record_cleaning_task_run(p_business_id uuid, p_task_id uuid, p_done_on date,
                                                    p_note text, p_attachment_path text)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_now timestamptz := cleaning_now();
  v_note text := nullif(btrim(p_note), '');
  v_path text := nullif(p_attachment_path, '');
  v_id uuid;
  u constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from cleaning_tasks where id = p_task_id and business_id = p_business_id) then
    raise exception 'NOT_FOUND' using errcode = 'P0004';
  end if;
  if p_done_on is null or p_done_on > business_day_bogota(v_now) then
    raise exception 'INVALID_DATE' using errcode = 'P0004';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'INVALID_NOTE' using errcode = 'P0004';
  end if;
  if v_path is not null
     and v_path !~ ('^' || p_business_id::text || '/tasks/' || p_task_id::text || '/' || u || '\.(webp|pdf)$') then
    raise exception 'INVALID_PATH' using errcode = 'P0004';
  end if;
  insert into cleaning_task_runs (business_id, task_id, done_on, note, attachment_path, created_by, created_at)
  values (p_business_id, p_task_id, p_done_on, v_note, v_path, auth.uid(), v_now)
  returning id into v_id;
  return v_id;
end $$;

-- REQ-064.4 tareas con última vez, próximo vencimiento y estado (overdue, soon ≤ 7 días, ok)
create or replace function cleaning_tasks_list(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := business_day_bogota(cleaning_now());
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', t.id, 'name', t.name, 'everyDays', t.every_days, 'isActive', t.is_active,
             'lastDone', t.last_done, 'nextDue', t.last_done + t.every_days,
             'status', case when t.last_done is null or t.last_done + t.every_days < v_today then 'overdue'
                            when t.last_done + t.every_days <= v_today + 7 then 'soon'
                            else 'ok' end,
             'runs', (select coalesce(jsonb_agg(jsonb_build_object(
                        'id', x.id, 'doneOn', x.done_on, 'note', x.note, 'attachmentPath', x.attachment_path,
                        'at', cleaning_iso(x.created_at)) order by x.done_on desc, x.created_at desc), '[]'::jsonb)
                      from cleaning_task_runs x where x.task_id = t.id))
           order by not t.is_active, t.last_done + t.every_days nulls first, t.name), '[]'::jsonb)
    from (select k.*, (select max(done_on) from cleaning_task_runs x where x.task_id = k.id) as last_done
          from cleaning_tasks k where k.business_id = p_business_id) t);
end $$;

-- ----------------------------------------------------------------- purga ----
-- §16.3 una vez por día y negocio: el primero que la reclama la corre
create or replace function cleaning_purge_claim(p_business_id uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_today date := business_day_bogota(cleaning_now());
begin
  update businesses set cleaning_purged_on = v_today
   where id = p_business_id and (cleaning_purged_on is null or cleaning_purged_on < v_today);
  return found;
end $$;

-- REQ-064.6 fotos de registros y revisiones de más de 90 días que siguen en Storage
create or replace function cleaning_photos_to_purge(p_business_id uuid, p_limit int) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'records', (select coalesce(jsonb_agg(jsonb_build_object('id', r.id, 'paths', to_jsonb(r.photo_paths))), '[]'::jsonb)
                from (select id, photo_paths from cleaning_records
                      where business_id = p_business_id and photos_purged_at is null and cardinality(photo_paths) > 0
                        and created_at < cleaning_now() - interval '90 days'
                      order by created_at limit p_limit) r),
    'inspections', (select coalesce(jsonb_agg(jsonb_build_object('id', i.id, 'paths', i.paths)), '[]'::jsonb)
                    from (select id, (select jsonb_agg(it ->> 'photoPath') from jsonb_array_elements(items) it
                                      where it ->> 'photoPath' is not null) as paths
                          from cleaning_inspections
                          where business_id = p_business_id and photos_purged_at is null
                            and created_at < cleaning_now() - interval '90 days'
                            and exists (select 1 from jsonb_array_elements(items) it where it ->> 'photoPath' is not null)
                          order by created_at limit p_limit) i))
$$;

-- Después de borrar los objetos: quita las rutas y marca la fecha (los registros se conservan)
create or replace function mark_cleaning_photos_purged(p_business_id uuid, p_record_ids uuid[], p_inspection_ids uuid[])
returns void
language plpgsql security definer set search_path = public as $$
begin
  update cleaning_records set photo_paths = '{}', photos_purged_at = now()
   where business_id = p_business_id and id = any(coalesce(p_record_ids, '{}'));
  update cleaning_inspections
     set items = (select jsonb_agg(it || jsonb_build_object('photoPath', null, 'photoPurged', it ->> 'photoPath' is not null))
                  from jsonb_array_elements(items) it),
         photos_purged_at = now()
   where business_id = p_business_id and id = any(coalesce(p_inspection_ids, '{}'));
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  cleaning_photos_gone(timestamptz, timestamptz),
  submit_cleaning_inspection(uuid, jsonb),
  cleaning_history(uuid, int),
  cleaning_record_detail(uuid),
  cleaning_inspection_detail(uuid),
  save_cleaning_task(uuid, uuid, text, int, boolean),
  record_cleaning_task_run(uuid, uuid, date, text, text),
  cleaning_tasks_list(uuid),
  cleaning_purge_claim(uuid),
  cleaning_photos_to_purge(uuid, int),
  mark_cleaning_photos_purged(uuid, uuid[], uuid[])
from public, anon, authenticated;
grant execute on function
  cleaning_photos_gone(timestamptz, timestamptz),
  submit_cleaning_inspection(uuid, jsonb),
  cleaning_history(uuid, int),
  cleaning_record_detail(uuid),
  cleaning_inspection_detail(uuid),
  save_cleaning_task(uuid, uuid, text, int, boolean),
  record_cleaning_task_run(uuid, uuid, date, text, text),
  cleaning_tasks_list(uuid),
  cleaning_purge_claim(uuid),
  cleaning_photos_to_purge(uuid, int),
  mark_cleaning_photos_purged(uuid, uuid[], uuid[])
to service_role;
-- Personal: todo es del dueño (cada una lo valida por dentro). La purga, solo service_role.
grant execute on function
  submit_cleaning_inspection(uuid, jsonb),
  cleaning_history(uuid, int),
  cleaning_record_detail(uuid),
  cleaning_inspection_detail(uuid),
  save_cleaning_task(uuid, uuid, text, int, boolean),
  record_cleaning_task_run(uuid, uuid, date, text, text),
  cleaning_tasks_list(uuid)
to authenticated;
