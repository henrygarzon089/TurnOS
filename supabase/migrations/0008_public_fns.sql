-- 0008 · Funciones públicas (vía server actions con service_role) y cierre automático (T-014)
-- Cubre: REQ-001.1, REQ-001.4–1.5, REQ-003.3–3.5, REQ-004.1, REQ-004.7, REQ-014, REQ-017.2, ADR-009, ADR-014

-- ¿Está abierto el negocio en este instante? Override manual del día > horario.
create or replace function is_business_open(p_business_id uuid, p_at timestamptz default now())
returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  z businesses%rowtype;
  v_local timestamp := p_at at time zone 'America/Bogota';
  h business_hours%rowtype;
begin
  select * into z from businesses where id = p_business_id;
  if not found then return false; end if;
  if z.queue_override <> 'auto' and z.queue_override_day = v_local::date then
    return z.queue_override = 'open';
  end if;
  select * into h from business_hours where business_id = p_business_id and weekday = extract(dow from v_local)::int;
  if not found or h.is_closed then return false; end if;
  return v_local::time >= h.opens_at and v_local::time < h.closes_at;
end $$;

-- Próxima apertura legible ("Hoy a las 9:00 a. m.", "Mañana a las 10:00 a. m.", "El lunes a las 9:00 a. m.")
create or replace function next_opening_text(p_business_id uuid, p_at timestamptz default now())
returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_local timestamp := p_at at time zone 'America/Bogota';
  d int; h business_hours%rowtype; i int;
  days text[] := array['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
begin
  for i in 0..7 loop
    d := (extract(dow from v_local)::int + i) % 7;
    select * into h from business_hours where business_id = p_business_id and weekday = d;
    if found and not h.is_closed then
      if i = 0 and v_local::time < h.opens_at then
        return 'Hoy a las ' || to_char(h.opens_at, 'FMHH12:MI') || case when h.opens_at < '12:00' then ' a. m.' else ' p. m.' end;
      elsif i = 1 then
        return 'Mañana a las ' || to_char(h.opens_at, 'FMHH12:MI') || case when h.opens_at < '12:00' then ' a. m.' else ' p. m.' end;
      elsif i > 1 then
        return 'El ' || days[d + 1] || ' a las ' || to_char(h.opens_at, 'FMHH12:MI') || case when h.opens_at < '12:00' then ' a. m.' else ' p. m.' end;
      end if;
    end if;
  end loop;
  return null;
end $$;

-- Foto de la fila sin datos personales, para calcular posición/tiempo en el servidor (ADR-013).
create or replace function queue_snapshot(p_business_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.display_name, 'status', b.status,
        'busyUntil', (
          select case when t.status = 'in_service' then t.started_at + make_interval(mins => t.service_duration_min)
                      when t.status = 'called' then t.called_at + make_interval(mins => t.service_duration_min) end
          from tickets t where t.assigned_barber_id = b.id and t.status in ('called', 'in_service')
          order by t.called_at desc limit 1)
      ) order by b.sort_order)
      from barbers b where b.business_id = p_business_id and b.is_active), '[]'::jsonb),
    'waiting', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'queueOrder', t.queue_order, 'durationMin', t.service_duration_min,
        'preferredBarberId', t.preferred_barber_id, 'displayNumber', t.display_number
      ) order by t.queue_order)
      from tickets t where t.business_id = p_business_id and t.status = 'waiting'
        and t.business_day = business_day_bogota(now())), '[]'::jsonb)
  )
$$;

-- REQ-001.1: portada pública del negocio.
create or replace function get_public_business(p_slug text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  z businesses%rowtype;
begin
  select * into z from businesses where slug = p_slug;
  if not found then return null; end if;
  return jsonb_build_object(
    'id', z.id,
    'name', z.name,
    'slug', z.slug,
    'address', z.address,
    'pwaName', coalesce(z.pwa_name, z.name),
    'isOpen', is_business_open(z.id),
    'nextOpening', next_opening_text(z.id),
    'closesAt', (select to_char(h.closes_at, 'HH24:MI') from business_hours h
                 where h.business_id = z.id and h.weekday = extract(dow from now() at time zone 'America/Bogota')::int and not h.is_closed),
    'privacyVersion', (select max(version) from privacy_policy_versions where business_id = z.id),
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'durationMin', s.duration_min, 'price', s.price) order by s.sort_order, s.name)
                 from services s where s.business_id = z.id and s.is_active), '[]'::jsonb),
    'queue', queue_snapshot(z.id)
  );
end $$;

-- REQ-003.3–3.5: tomar turno. Devuelve {token, existing}. El servidor ya validó y normalizó.
-- p_privacy_version se guarda en la ficha del cliente a partir de 0011 (T-031).
create or replace function join_queue(
  p_slug text, p_name text, p_phone text, p_service_id uuid,
  p_preferred_barber_id uuid default null, p_privacy_version int default null, p_source ticket_source default 'qr'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  z businesses%rowtype;
  t tickets%rowtype;
  v_existing text;
begin
  select * into z from businesses where slug = p_slug;
  if not found then raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0002'; end if;
  if not is_business_open(z.id) then raise exception 'BUSINESS_CLOSED' using errcode = 'P0007'; end if;

  -- REQ-003.5: ya tiene un turno activo → devolver el existente
  select public_token into v_existing from tickets
  where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
  if v_existing is not null then
    return jsonb_build_object('token', v_existing, 'existing', true);
  end if;

  if p_preferred_barber_id is not null and not exists (
    select 1 from barbers b where b.id = p_preferred_barber_id and b.business_id = z.id and b.is_active and b.status not in ('off', 'paused')
  ) then
    raise exception 'BARBER_UNAVAILABLE' using errcode = 'P0005';
  end if;

  insert into tickets (business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, source)
  values (z.id, trim(p_name), p_phone, p_service_id, p_preferred_barber_id, p_source)
  returning * into t;

  return jsonb_build_object('token', t.public_token, 'existing', false);
exception
  when unique_violation then
    -- Carrera entre dos envíos (REQ-011.5): devolver el que ganó
    select public_token into v_existing from tickets
    where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
    return jsonb_build_object('token', v_existing, 'existing', true);
end $$;

-- REQ-004.1 / REQ-004.7: "Mi turno" por token. Sin datos de otros clientes.
create or replace function get_ticket_by_token(p_token text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  t tickets%rowtype;
  z businesses%rowtype;
begin
  select * into t from tickets where public_token = p_token;
  if not found then return null; end if;
  select * into z from businesses where id = t.business_id;
  return jsonb_build_object(
    'id', t.id,
    'business', jsonb_build_object('id', z.id, 'name', z.name, 'slug', z.slug, 'graceMinutes', z.grace_minutes),
    'displayNumber', t.display_number,
    'customerName', t.customer_name,
    'serviceName', t.service_name,
    'serviceDurationMin', t.service_duration_min,
    'preferredBarberId', t.preferred_barber_id,
    'assignedBarberId', t.assigned_barber_id,
    'assignedBarberName', (select display_name from barbers where id = t.assigned_barber_id),
    'preferredBarberName', (select display_name from barbers where id = t.preferred_barber_id),
    'status', t.status,
    'queueOrder', t.queue_order,
    'createdAt', t.created_at,
    'calledAt', t.called_at,
    'cancelReason', t.cancel_reason,
    'queue', queue_snapshot(t.business_id)
  );
end $$;

-- REQ-005.2: cancelar por token (cliente).
create or replace function cancel_ticket_by_token(p_token text)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
begin
  select * into t from tickets where public_token = p_token;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  t := transition_ticket(t.id, 'cancelled', 'customer', 'customer');
  return jsonb_build_object('status', t.status);
end $$;

-- REQ-014 / ADR-014: cancela los turnos activos de negocios ya cerrados (cierre + 60 min, o
-- fila cerrada manualmente hoy, o turnos de días anteriores).
create or replace function close_expired_queues()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
  v_local timestamp := now() at time zone 'America/Bogota';
begin
  for r in
    select t.id
    from tickets t
    join businesses z on z.id = t.business_id
    left join business_hours h on h.business_id = z.id and h.weekday = extract(dow from v_local)::int
    where t.status in ('waiting', 'called')
      and (
        t.business_day < v_local::date
        or (z.queue_override = 'closed' and z.queue_override_day = v_local::date)
        or (coalesce(h.is_closed, true))
        or (v_local::time >= h.closes_at + interval '60 minutes')
      )
  loop
    perform transition_ticket(r.id, 'cancelled', 'system', 'closing');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

revoke all on function is_business_open(uuid, timestamptz), next_opening_text(uuid, timestamptz), queue_snapshot(uuid),
  get_public_business(text), join_queue(text, text, text, uuid, uuid, int, ticket_source),
  get_ticket_by_token(text), cancel_ticket_by_token(text), close_expired_queues() from public;
grant execute on function is_business_open(uuid, timestamptz), next_opening_text(uuid, timestamptz), queue_snapshot(uuid)
  to authenticated, service_role;
grant execute on function get_public_business(text), join_queue(text, text, text, uuid, uuid, int, ticket_source),
  get_ticket_by_token(text), cancel_ticket_by_token(text), close_expired_queues() to service_role;

-- Cierre automático cada 15 minutos (pg_cron). Idempotente: si ya existe el job, se reemplaza.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'turnos_close_expired_queues';
    perform cron.schedule('turnos_close_expired_queues', '*/15 * * * *', 'select public.close_expired_queues()');
  end if;
end $$;
