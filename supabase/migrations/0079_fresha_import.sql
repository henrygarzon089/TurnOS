-- 0079 · Importar clientes y citas de Fresha (REQ-100, ADR-076, design.md §32.1, T-290)
-- Una sola llamada del dueño, import_fresha, guarda clientes y citas en una transacción y deja un
-- registro con conteos (sin datos personales). Los archivos nunca llegan a la base.

alter table customers add column imported_from text check (imported_from in ('fresha'));
alter table appointments add column external_ref text;
create unique index appointments_external_ref_idx on appointments (business_id, external_ref)
  where external_ref is not null;

create table customer_imports (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  created_by uuid,
  created_at timestamptz not null default now(),
  source text not null default 'fresha' check (source in ('fresha')),
  customers_new int not null default 0,
  customers_existing int not null default 0,
  appointments_created int not null default 0,
  appointments_rejected int not null default 0,
  rows_skipped int not null default 0
);
create index customer_imports_business_idx on customer_imports (business_id, created_at desc);
alter table customer_imports enable row level security;
alter table customer_imports force row level security;
create policy customer_imports_owner_select on customer_imports for select to authenticated
  using (is_owner_of(business_id));
revoke all on customer_imports from anon, authenticated;
grant select on customer_imports to authenticated;
grant all on customer_imports to service_role;

-- ---------------------------------------------------------------- clientes ----
-- REQ-100.3, 100.4, 100.5, 100.10. Devuelve {new, existing}. Sin grant: solo la llama import_fresha.
create or replace function import_customers_rows(p_business_id uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  v_phone text;
  v_name text;
  v_month smallint;
  v_day smallint;
  v_note text;
  v_new int := 0;
  v_existing int := 0;
  c customers%rowtype;
begin
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_phone := r->>'phone';
    v_name := left(trim(coalesce(r->>'name', '')), 60);
    if v_phone is null or v_phone !~ '^\+573[0-9]{9}$' or v_name = '' then
      continue;
    end if;
    -- Un valor mal formado no tumba la importación: se ignora (revisor-sql)
    v_month := case when r->>'birthdayMonth' ~ '^[0-9]{1,2}$' then (r->>'birthdayMonth')::smallint end;
    v_day := case when r->>'birthdayDay' ~ '^[0-9]{1,2}$' then (r->>'birthdayDay')::smallint end;
    if v_month is null or v_day is null or v_month not between 1 and 12
       or v_day < 1 or v_day > extract(day from make_date(2000, v_month, 1) + interval '1 month - 1 day') then
      v_month := null;
      v_day := null;
    end if;
    v_note := nullif(trim(coalesce(r->>'notes', '')), '');
    if v_note is not null then
      v_note := 'Fresha: ' || left(v_note, 500);
    end if;

    select * into c from customers where business_id = p_business_id and phone_e164 = v_phone for update;
    if not found then
      -- on conflict: un cliente pudo tomar turno con ese celular mientras se importaba
      insert into customers (business_id, phone_e164, name, birthday_month, birthday_day, notes, imported_from)
      values (p_business_id, v_phone, v_name, v_month, v_day, v_note, 'fresha')
      on conflict (business_id, phone_e164) do nothing;
      if found then
        v_new := v_new + 1;
      else
        v_existing := v_existing + 1;
      end if;
    else
      -- REQ-100.3 no se pisa nada: solo se completa el cumpleaños y se agrega la nota una vez
      update customers
         set birthday_month = case when c.birthday_month is null then v_month else c.birthday_month end,
             birthday_day = case when c.birthday_month is null then v_day else c.birthday_day end,
             notes = case
                       when v_note is null or position(v_note in coalesce(c.notes, '')) > 0 then c.notes
                       when coalesce(c.notes, '') = '' then v_note
                       else c.notes || E'\n' || v_note
                     end
       where id = c.id;
      v_existing := v_existing + 1;
    end if;
  end loop;
  return jsonb_build_object('new', v_new, 'existing', v_existing);
end $$;

-- ------------------------------------------------------------------- citas ----
-- REQ-100.6, 100.8, 100.9, 100.10. Sin la grilla de 15 min ni el límite de 7 días (design §32.1).
create or replace function import_appointments_rows(p_business_id uuid, p_rows jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  i int := -1;
  z businesses%rowtype;
  s services%rowtype;
  h business_hours%rowtype;
  v_phone text;
  v_name text;
  v_ref text;
  v_barber uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_dur int;
  v_local timestamp;
  v_day date;
  v_customer uuid;
  v_created int := 0;
  v_already int := 0;
  v_rejected jsonb := '[]'::jsonb;
  v_reason text;
begin
  select * into z from businesses where id = p_business_id;
  for r in select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    i := i + 1;
    v_reason := null;
    v_phone := r->>'phone';
    v_name := left(trim(coalesce(r->>'name', '')), 60);
    v_barber := case when r->>'barberId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     then (r->>'barberId')::uuid end;
    -- La hora debe traer la zona (Z o ±HH:MM); sin zona Postgres usaría la de la sesión (UTC)
    v_start := null;
    if r->>'startsAt' ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$' then
      begin
        v_start := (r->>'startsAt')::timestamptz;
      exception when others then
        v_start := null;
      end;
    end if;
    v_ref := coalesce(nullif(trim(r->>'ref'), ''), v_phone || '|' || (r->>'startsAt'));

    if v_ref is not null and exists (select 1 from appointments
                                      where business_id = p_business_id and external_ref = v_ref) then
      v_already := v_already + 1;
      continue;
    end if;

    select * into s from services
     where id = case when r->>'serviceId' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     then (r->>'serviceId')::uuid end
       and business_id = p_business_id and is_active;
    if not found or v_start is null or v_name = ''
       or v_phone is null or v_phone !~ '^\+573[0-9]{9}$'
       or not exists (select 1 from barbers b where b.id = v_barber and b.business_id = p_business_id and b.is_active) then
      v_reason := 'INVALID';
    end if;

    if v_reason is null then
      v_dur := case when r->>'durationMin' ~ '^[0-9]{1,3}$' then (r->>'durationMin')::int end;
      if v_dur is null or v_dur <= 0 or v_dur > 600 then
        v_dur := s.duration_min;
      end if;
      v_end := v_start + make_interval(mins => v_dur);
      v_local := v_start at time zone 'America/Bogota';
      v_day := v_local::date;
      select * into h from business_hours where business_id = p_business_id and weekday = extract(dow from v_day)::int;
      if v_start <= now() then
        v_reason := 'PAST';
      elsif not found or h.is_closed or (z.queue_override = 'closed' and z.queue_override_day = v_day) then
        v_reason := 'DAY_CLOSED';
      elsif v_local::time < h.opens_at or (v_end at time zone 'America/Bogota')::date <> v_day
            or (v_end at time zone 'America/Bogota')::time > h.closes_at then
        v_reason := 'OUTSIDE_HOURS';
      end if;
    end if;

    if v_reason is null then
      update appointments set status = 'no_show'
       where business_id = p_business_id and customer_phone_e164 = v_phone and status = 'booked'
         and appointment_lapsed(starts_at);
      if exists (select 1 from appointments where business_id = p_business_id
                   and customer_phone_e164 = v_phone and status = 'booked') then
        v_reason := 'HAS_BOOKING';
      end if;
    end if;

    if v_reason is null then
      perform pg_advisory_xact_lock(hashtext('appointments:' || v_barber::text));
      if not barber_time_free(v_barber, v_start, v_end) then
        v_reason := 'SLOT_TAKEN';
      end if;
    end if;

    if v_reason is not null then
      v_rejected := v_rejected || jsonb_build_object('index', i, 'reason', v_reason);
      continue;
    end if;

    -- REQ-100.6 el cliente se crea si no existía (sin cambiar una ficha que ya está); la cita lleva
    -- el nombre de la ficha, para que la agenda y Clientes digan lo mismo
    insert into customers (business_id, phone_e164, name, imported_from)
    values (p_business_id, v_phone, v_name, 'fresha')
    on conflict (business_id, phone_e164) do nothing;
    select id, name into v_customer, v_name from customers where business_id = p_business_id and phone_e164 = v_phone;

    begin
      insert into appointments (business_id, customer_id, customer_name, customer_phone_e164, service_id, service_name,
                                service_duration_min, service_price, barber_id, any_barber, starts_at, ends_at,
                                business_day, source, created_by, external_ref)
      values (p_business_id, v_customer, v_name, v_phone, s.id, s.name, v_dur, s.price, v_barber, false,
              v_start, v_end, v_day, 'owner', auth.uid(), v_ref);
      v_created := v_created + 1;
    exception when unique_violation then
      -- Un cliente reservó con ese celular mientras se importaba
      v_rejected := v_rejected || jsonb_build_object('index', i, 'reason', 'HAS_BOOKING');
    end;
  end loop;
  return jsonb_build_object('created', v_created, 'already', v_already, 'rejected', v_rejected);
end $$;

-- ------------------------------------------------------------- import_fresha ----
-- REQ-100.1, 100.11: solo el dueño con sesión; registra conteos, nunca filas.
create or replace function import_fresha(p_business_id uuid, p_customers jsonb, p_appointments jsonb,
                                         p_rows_skipped int default 0) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c jsonb;
  a jsonb := jsonb_build_object('created', 0, 'already', 0, 'rejected', '[]'::jsonb);
begin
  if auth.uid() is null or not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  -- Dos importaciones del mismo negocio van una detrás de otra (sin choques ni candados cruzados)
  perform pg_advisory_xact_lock(hashtext('import:' || p_business_id::text));
  if jsonb_array_length(coalesce(p_appointments, '[]'::jsonb)) > 0
     and not (select appointments_enabled from businesses where id = p_business_id) then
    raise exception 'APPOINTMENTS_DISABLED' using errcode = 'P0004';
  end if;
  c := import_customers_rows(p_business_id, p_customers);
  if jsonb_array_length(coalesce(p_appointments, '[]'::jsonb)) > 0 then
    a := import_appointments_rows(p_business_id, p_appointments);
  end if;
  insert into customer_imports (business_id, created_by, customers_new, customers_existing,
                                appointments_created, appointments_rejected, rows_skipped)
  values (p_business_id, auth.uid(), (c->>'new')::int, (c->>'existing')::int, (a->>'created')::int,
          jsonb_array_length(a->'rejected'), greatest(coalesce(p_rows_skipped, 0), 0));
  return jsonb_build_object(
    'customersNew', (c->>'new')::int, 'customersExisting', (c->>'existing')::int,
    'appointmentsCreated', (a->>'created')::int, 'appointmentsAlready', (a->>'already')::int,
    'rejected', a->'rejected');
end $$;

revoke all on function import_customers_rows(uuid, jsonb), import_appointments_rows(uuid, jsonb),
  import_fresha(uuid, jsonb, jsonb, int) from public, anon, authenticated;
grant execute on function import_fresha(uuid, jsonb, jsonb, int) to authenticated;

-- ------------------------------------------------- sin avisos a importados ----
-- REQ-100.5 (T-293): un cliente traído de Fresha no sale en "Clientes para recordar" ni en
-- "Cumplen esta semana" hasta que acepte el aviso de privacidad. Redefinen 0018 y 0033 igual,
-- con un filtro más.
create or replace function inactive_customers(p_business_id uuid)
returns table (id uuid, name text, phone_e164 text, days_since int, visits_count int,
               preferred_barber_name text, last_reminder_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.phone_e164,
         (business_day_bogota(now()) - business_day_bogota(c.last_visit_at))::int as days_since,
         c.visits_count,
         b.display_name,
         (select max(r.sent_at) from reminders r where r.customer_id = c.id)
  from customers c
  join businesses z on z.id = c.business_id
  left join barbers b on b.id = c.preferred_barber_id
  where c.business_id = p_business_id
    and (auth.uid() is null or is_member_of(p_business_id))
    and c.anonymized_at is null
    and not c.do_not_contact
    and (c.imported_from is null or c.privacy_accepted_at is not null)
    and c.visits_count >= 1
    and (business_day_bogota(now()) - business_day_bogota(c.last_visit_at)) > z.inactive_days
    and coalesce((select max(r.sent_at) from reminders r where r.customer_id = c.id), 'epoch')
        < now() - make_interval(days => z.reminder_cooldown_days)
  order by c.last_visit_at asc
$$;

create or replace function birthdays_this_week(p_business_id uuid, p_today date default null)
returns table (id uuid, name text, phone_e164 text, birthday_month smallint, birthday_day smallint, celebrates_on date)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := coalesce(p_today, business_day_bogota(now()));
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.phone_e164, c.birthday_month, c.birthday_day, g.d
  from customers c
  cross join lateral (select v_today + k as d from generate_series(0, 6) k) g
  where c.business_id = p_business_id
    and c.birthday_month is not null
    and c.anonymized_at is null
    and not c.do_not_contact
    and (c.imported_from is null or c.privacy_accepted_at is not null)
    and (
      (extract(month from g.d) = c.birthday_month and extract(day from g.d) = c.birthday_day)
      or (c.birthday_month = 2 and c.birthday_day = 29 and extract(month from g.d) = 2 and extract(day from g.d) = 28
          and extract(day from make_date(extract(year from g.d)::int, 3, 1) - 1) = 28)
    )
  order by g.d, c.name;
end $$;
