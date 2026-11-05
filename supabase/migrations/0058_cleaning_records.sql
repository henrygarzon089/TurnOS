-- 0058 · Hito 11, limpieza: registrar apertura, cierre y profunda, y los avisos (T-101, ADR-037)
-- Cubre: REQ-060.4, REQ-060.5, REQ-061.1–061.11, REQ-062.1–062.8. Diseño: design.md §16.4–§16.5.

-- ------------------------------------------------------------ auxiliares ----
-- Hora actual. Las pruebas pgTAP la fijan con `turnos.test_now`; solo se respeta con la sesión de
-- postgres (en Supabase la app entra como `authenticator`), así nadie la cambia desde la app.
create or replace function cleaning_now() returns timestamptz
language sql stable set search_path = public as $$
  select case when session_user = 'postgres'
              then coalesce(nullif(current_setting('turnos.test_now', true), '')::timestamptz, now())
              else now() end
$$;

-- REQ-062.1/062.3 ¿el negocio abre ese día? El cierre o la apertura a mano del dueño gana al horario.
create or replace function cleaning_is_open_day(p_business_id uuid, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when z.queue_override <> 'auto' and z.queue_override_day = p_day then z.queue_override = 'open'
    else exists (select 1 from business_hours h where h.business_id = p_business_id
                   and h.weekday = extract(dow from p_day)::int and not h.is_closed)
  end
  from businesses z where z.id = p_business_id
$$;

-- Horario del día (null si ese día de la semana está cerrado por horario)
create or replace function cleaning_hours(p_business_id uuid, p_day date) returns business_hours
language sql stable security definer set search_path = public as $$
  select * from business_hours where business_id = p_business_id
     and weekday = extract(dow from p_day)::int and not is_closed
$$;

-- 'owner' o 'barber' (activo); si no, FORBIDDEN
create or replace function cleaning_actor(p_business_id uuid) returns text
language plpgsql stable security definer set search_path = public as $$
begin
  if is_owner_of(p_business_id) then return 'owner'; end if;
  if cleaning_is_active_barber(p_business_id) then return 'barber'; end if;
  raise exception 'FORBIDDEN' using errcode = '42501';
end $$;

-- Quién hizo un registro: el nombre del barbero, o "Dueño"
create or replace function cleaning_done_by_name(p_business_id uuid, p_barber_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select display_name from barbers where business_id = p_business_id and id = p_barber_id), 'Dueño')
$$;

create or replace function cleaning_iso(p_at timestamptz) returns text
language sql immutable as $$
  select to_char(p_at at time zone 'America/Bogota', 'YYYY-MM-DD"T"HH24:MI:SS') || '-05:00'
$$;

create or replace function cleaning_record_json(r cleaning_records) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when r.id is null then null else jsonb_build_object(
    'id', r.id, 'kind', r.kind, 'businessDay', r.business_day,
    'doneBy', cleaning_done_by_name(r.business_id, r.barber_id), 'at', cleaning_iso(r.created_at),
    'isComplete', r.is_complete, 'isLate', r.is_late) end
$$;

create or replace function cleaning_list_json(p_business_id uuid, p_kind cleaning_kind) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'label', label) order by sort_order), '[]'::jsonb)
  from cleaning_checklist_items where business_id = p_business_id and kind = p_kind
$$;

-- REQ-062.1 apertura pendiente: abre hoy, ya pasó la hora y no hay apertura
create or replace function cleaning_opening_pending(p_business_id uuid, p_now timestamptz) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_day date := business_day_bogota(p_now);
  v_time time := (p_now at time zone 'America/Bogota')::time;
  h business_hours;
begin
  if not cleaning_is_open_day(p_business_id, v_day) then return false; end if;
  if exists (select 1 from cleaning_records where business_id = p_business_id
               and kind = 'opening' and business_day = v_day) then
    return false;
  end if;
  h := cleaning_hours(p_business_id, v_day);
  -- Abierto a mano un día que el horario tiene cerrado: no hay hora de apertura, se pide desde ya
  return h.business_id is null or v_time >= h.opens_at;
end $$;

-- ---------------------------------------------------------- cleaning_today ----
-- REQ-061.11/062.1 lo que ve quien abre "Limpieza": registros de hoy y de la semana, aviso y listas
create or replace function cleaning_today(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_actor text := cleaning_actor(p_business_id);
  v_now timestamptz := cleaning_now();
  v_day date := business_day_bogota(v_now);
  h business_hours;
  v_lists jsonb;
begin
  if not (select cleaning_enabled from businesses where id = p_business_id) then
    return jsonb_build_object('enabled', false);
  end if;
  h := cleaning_hours(p_business_id, v_day);
  v_lists := jsonb_build_object(
    'opening', cleaning_list_json(p_business_id, 'opening'),
    'closing', cleaning_list_json(p_business_id, 'closing'),
    'deep', cleaning_list_json(p_business_id, 'deep'));
  if v_actor = 'owner' then
    v_lists := v_lists || jsonb_build_object('betweenClients', cleaning_list_json(p_business_id, 'between_clients'));
  end if;
  return jsonb_build_object(
    'enabled', true,
    'isOwner', v_actor = 'owner',
    'businessDay', v_day,
    'weekStart', date_trunc('week', v_day)::date,
    'isOpenDay', cleaning_is_open_day(p_business_id, v_day),
    'opensAt', to_char(h.opens_at, 'HH24:MI'),
    'closesAt', to_char(h.closes_at, 'HH24:MI'),
    'closingFrom', to_char(h.closes_at - interval '1 hour', 'HH24:MI'),
    'openingPending', cleaning_opening_pending(p_business_id, v_now),
    'opening', (select cleaning_record_json(r) from cleaning_records r where r.business_id = p_business_id
                  and r.kind = 'opening' and r.business_day = v_day),
    'closing', (select cleaning_record_json(r) from cleaning_records r where r.business_id = p_business_id
                  and r.kind = 'closing' and r.business_day = v_day),
    'deep', (select cleaning_record_json(r) from cleaning_records r where r.business_id = p_business_id
               and r.kind = 'deep' and r.week_start = date_trunc('week', v_day)::date),
    'lists', v_lists);
end $$;

-- -------------------------------------------------- submit_cleaning_record ----
-- §16.5, en orden; el primer error gana
create or replace function submit_cleaning_record(p_business_id uuid, p_kind cleaning_kind, p_items jsonb,
                                                  p_photo_paths text[])
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_actor text := cleaning_actor(p_business_id);
  v_now timestamptz := cleaning_now();
  v_day date := business_day_bogota(v_now);
  v_week date := date_trunc('week', v_day)::date;
  v_time time := (v_now at time zone 'America/Bogota')::time;
  h business_hours;
  prev cleaning_records;
  v_sent uuid[];
  v_list uuid[];
  v_snapshot jsonb;
  v_complete boolean;
  v_late boolean := false;
  v_photos text[] := coalesce(p_photo_paths, '{}');
  v_path text;
  v_id uuid;
  u constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  -- 1. apagada / tipo
  if not (select cleaning_enabled from businesses where id = p_business_id) then
    raise exception 'CLEANING_DISABLED' using errcode = 'P0004';
  end if;
  if p_kind = 'between_clients' then
    raise exception 'INVALID_KIND' using errcode = 'P0004';
  end if;

  -- 2. ya existe (REQ-061.2)
  select * into prev from cleaning_records
   where business_id = p_business_id and kind = p_kind
     and (case when p_kind = 'deep' then week_start = v_week else business_day = v_day end);
  if found then
    raise exception 'ALREADY_RECORDED' using errcode = 'P0004',
      detail = jsonb_build_object('doneBy', cleaning_done_by_name(p_business_id, prev.barber_id),
                                  'at', cleaning_iso(prev.created_at))::text;
  end if;

  -- 3. hora mínima del cierre para el barbero (REQ-061.7); la medianoche la pone business_day (061.10)
  h := cleaning_hours(p_business_id, v_day);
  if p_kind = 'closing' and v_actor = 'barber' and h.business_id is not null
     and v_time < h.closes_at - interval '1 hour' then
    raise exception 'CLOSING_TOO_EARLY' using errcode = 'P0004',
      detail = jsonb_build_object('from', to_char(h.closes_at - interval '1 hour', 'HH24:MI'))::text;
  end if;

  -- 4. exactamente los puntos actuales (REQ-060.5)
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'LIST_CHANGED' using errcode = 'P0004';
  end if;
  select coalesce(array_agg((e ->> 'id')::uuid order by (e ->> 'id')), '{}') into v_sent
    from jsonb_array_elements(p_items) e;
  select coalesce(array_agg(id order by id::text), '{}') into v_list
    from cleaning_checklist_items where business_id = p_business_id and kind = p_kind;
  if v_sent::text[] is distinct from (select coalesce(array_agg(x::text order by x::text), '{}') from unnest(v_list) x)
     or cardinality(v_list) = 0 then
    raise exception 'LIST_CHANGED' using errcode = 'P0004';
  end if;

  -- 5. nota en cada punto sin marcar (REQ-061.3)
  if exists (select 1 from jsonb_array_elements(p_items) e
             where coalesce((e ->> 'done')::boolean, false) = false
               and coalesce(length(btrim(e ->> 'note')), 0) not between 1 and 200) then
    raise exception 'NOTE_REQUIRED' using errcode = 'P0004';
  end if;

  -- 6. fotos (REQ-061.4) en la carpeta privada del negocio (REQ-064.5)
  if p_kind = 'closing' and cardinality(v_photos) <> 1 then
    raise exception 'PHOTO_REQUIRED' using errcode = 'P0004';
  end if;
  if cardinality(v_photos) > 3 then
    raise exception 'TOO_MANY_PHOTOS' using errcode = 'P0004';
  end if;
  foreach v_path in array v_photos loop
    if v_path !~ ('^' || p_business_id::text || '/records/\d{4}-\d{2}-\d{2}/' || u || '\.webp$') then
      raise exception 'INVALID_PATH' using errcode = 'P0004';
    end if;
  end loop;

  -- 7. copia de las etiquetas en el orden de la lista (REQ-060.4)
  select jsonb_agg(jsonb_build_object(
           'label', c.label,
           'done', coalesce((e ->> 'done')::boolean, false),
           'note', case when coalesce((e ->> 'done')::boolean, false) then null else btrim(e ->> 'note') end)
         order by c.sort_order),
         bool_and(coalesce((e ->> 'done')::boolean, false))
    into v_snapshot, v_complete
    from cleaning_checklist_items c
    join jsonb_array_elements(p_items) e on (e ->> 'id')::uuid = c.id
   where c.business_id = p_business_id and c.kind = p_kind;

  if p_kind = 'opening' and h.business_id is not null then
    v_late := v_time > h.opens_at + interval '30 minutes';   -- REQ-061.8
  end if;

  begin
    insert into cleaning_records (business_id, kind, business_day, week_start, done_by, barber_id,
                                  created_at, is_complete, is_late, items, photo_paths)
    values (p_business_id, p_kind, v_day, v_week, auth.uid(),
            case when v_actor = 'barber' then my_barber_id(p_business_id) end,
            v_now, v_complete, v_late, v_snapshot, v_photos)
    returning id into v_id;
  exception when unique_violation then
    -- Dos celulares a la vez: el segundo recibe el mismo aviso que si hubiera llegado después
    select * into prev from cleaning_records
     where business_id = p_business_id and kind = p_kind
       and (case when p_kind = 'deep' then week_start = v_week else business_day = v_day end);
    raise exception 'ALREADY_RECORDED' using errcode = 'P0004',
      detail = jsonb_build_object('doneBy', cleaning_done_by_name(p_business_id, prev.barber_id),
                                  'at', cleaning_iso(prev.created_at))::text;
  end;

  return jsonb_build_object('id', v_id, 'isComplete', v_complete, 'isLate', v_late);
end $$;

-- --------------------------------------------------- cleaning_owner_summary ----
-- REQ-062.1/062.3–062.5 y REQ-064.4: lo que el dueño ve en su panel
create or replace function cleaning_owner_summary(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_now timestamptz := cleaning_now();
  v_today date := business_day_bogota(v_now);
  v_week date := date_trunc('week', v_today)::date;
  z businesses;
  v_since date;
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into z from businesses where id = p_business_id;
  if not z.cleaning_enabled then
    return jsonb_build_object('enabled', false);
  end if;
  v_since := greatest(z.cleaning_enabled_on, v_today - 14);   -- REQ-062.8, como máximo 14 días

  return jsonb_build_object(
    'enabled', true,
    'businessDay', v_today,
    'openingPending', cleaning_opening_pending(p_business_id, v_now),
    'missedClosings', (
      select coalesce(jsonb_agg(jsonb_build_object('day', d::date) order by d), '[]'::jsonb)
      from generate_series(v_since, v_today - 1, interval '1 day') d
      where cleaning_is_open_day(p_business_id, d::date)
        and not exists (select 1 from cleaning_records r where r.business_id = p_business_id
                          and r.kind = 'closing' and r.business_day = d::date)
        and not exists (select 1 from cleaning_missed_acks a where a.business_id = p_business_id
                          and a.business_day = d::date)),
    'deepPending', not exists (select 1 from cleaning_records r where r.business_id = p_business_id
                                 and r.kind = 'deep' and r.week_start = v_week),
    'deepMissedWeeks', (
      select coalesce(jsonb_agg(w::date order by w desc), '[]'::jsonb)
      from generate_series(greatest(date_trunc('week', z.cleaning_enabled_on)::date, v_week - 56),
                           v_week - 7, interval '7 days') w
      where not exists (select 1 from cleaning_records r where r.business_id = p_business_id
                          and r.kind = 'deep' and r.week_start = w::date)),
    'flagged', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'id', r.id, 'kind', r.kind, 'day', r.business_day,
               'doneBy', cleaning_done_by_name(r.business_id, r.barber_id), 'at', cleaning_iso(r.created_at),
               'isComplete', r.is_complete, 'isLate', r.is_late,
               'notes', (select coalesce(jsonb_agg(jsonb_build_object('label', i ->> 'label', 'note', i ->> 'note')), '[]'::jsonb)
                         from jsonb_array_elements(r.items) i where not (i ->> 'done')::boolean))
             order by r.business_day desc, r.created_at desc), '[]'::jsonb)
      from cleaning_records r
      where r.business_id = p_business_id and r.business_day > v_today - 7
        and (not r.is_complete or r.is_late)),
    'tasksDue', (
      select coalesce(jsonb_agg(jsonb_build_object('id', t.id, 'name', t.name, 'nextDue', t.next_due,
                                                   'overdue', t.next_due is null or t.next_due < v_today)
                                order by t.next_due nulls first, t.name), '[]'::jsonb)
      from (select k.id, k.name,
                   (select max(done_on) from cleaning_task_runs x where x.task_id = k.id) + k.every_days as next_due
            from cleaning_tasks k where k.business_id = p_business_id and k.is_active) t
      where t.next_due is null or t.next_due <= v_today + 7));
end $$;

-- REQ-062.3 el dueño marca como visto un cierre sin registrar
create or replace function ack_missed_closing(p_business_id uuid, p_day date, p_note text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_today date := business_day_bogota(cleaning_now());
  v_note text := nullif(btrim(p_note), '');
begin
  if not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if v_note is not null and length(v_note) > 200 then
    raise exception 'INVALID_NOTE' using errcode = 'P0004';
  end if;
  if p_day is null or p_day >= v_today
     or p_day < (select cleaning_enabled_on from businesses where id = p_business_id)
     or not cleaning_is_open_day(p_business_id, p_day)
     or exists (select 1 from cleaning_records where business_id = p_business_id
                  and kind = 'closing' and business_day = p_day) then
    raise exception 'NOT_MISSED' using errcode = 'P0004';
  end if;
  insert into cleaning_missed_acks (business_id, business_day, note, acked_by)
  values (p_business_id, p_day, v_note, auth.uid())
  on conflict (business_id, business_day) do update set note = excluded.note, acked_by = excluded.acked_by,
    acked_at = now();
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  cleaning_now(),
  cleaning_is_open_day(uuid, date),
  cleaning_hours(uuid, date),
  cleaning_actor(uuid),
  cleaning_done_by_name(uuid, uuid),
  cleaning_iso(timestamptz),
  cleaning_record_json(cleaning_records),
  cleaning_list_json(uuid, cleaning_kind),
  cleaning_opening_pending(uuid, timestamptz),
  cleaning_today(uuid),
  submit_cleaning_record(uuid, cleaning_kind, jsonb, text[]),
  cleaning_owner_summary(uuid),
  ack_missed_closing(uuid, date, text)
from public, anon, authenticated;
grant execute on function
  cleaning_now(),
  cleaning_is_open_day(uuid, date),
  cleaning_hours(uuid, date),
  cleaning_actor(uuid),
  cleaning_done_by_name(uuid, uuid),
  cleaning_iso(timestamptz),
  cleaning_record_json(cleaning_records),
  cleaning_list_json(uuid, cleaning_kind),
  cleaning_opening_pending(uuid, timestamptz),
  cleaning_today(uuid),
  submit_cleaning_record(uuid, cleaning_kind, jsonb, text[]),
  cleaning_owner_summary(uuid),
  ack_missed_closing(uuid, date, text)
to service_role;
-- Personal (cada una valida el negocio por dentro)
grant execute on function
  cleaning_today(uuid),
  submit_cleaning_record(uuid, cleaning_kind, jsonb, text[]),
  cleaning_owner_summary(uuid),
  ack_missed_closing(uuid, date, text)
to authenticated;
