-- 0032 · Estimado y formulario según quién hace cada servicio (REQ-035.6, REQ-035.7, REQ-035.10;
-- T-053/T-054). queue_snapshot agrega a cada turno en espera los barberos que hacen su servicio
-- (capableBarberIds, para estimateQueue) y get_public_business a cada servicio los suyos
-- (barberIds, para el formulario). Redefinición completa de 0008; los permisos se conservan.

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
        'preferredBarberId', t.preferred_barber_id, 'displayNumber', t.display_number,
        'capableBarberIds', coalesce((select jsonb_agg(bs.barber_id) from barber_services bs
                                      where bs.service_id = t.service_id), '[]'::jsonb)
      ) order by t.queue_order)
      from tickets t where t.business_id = p_business_id and t.status = 'waiting'
        and t.business_day = business_day_bogota(now())), '[]'::jsonb)
  )
$$;

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
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'durationMin', s.duration_min, 'price', s.price,
                                                 'barberIds', coalesce((select jsonb_agg(bs.barber_id) from barber_services bs
                                                                        where bs.service_id = s.id), '[]'::jsonb)) order by s.sort_order, s.name)
                 from services s where s.business_id = z.id and s.is_active), '[]'::jsonb),
    'queue', queue_snapshot(z.id)
  );
end $$;
