-- 0048 · Lo que la portada necesita para ofrecer citas (REQ-050.1, design.md §14.5, T-082): si están
-- encendidas, qué barberos las reciben y para qué servicios, y qué días de hoy a +7 tienen horario.
-- Función aparte para no redefinir get_public_business. Solo service_role (ADR-009).

create or replace function public_appointment_info(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', z.appointments_enabled,
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.display_name,
        'serviceIds', coalesce((select jsonb_agg(bs.service_id) from barber_services bs where bs.barber_id = b.id), '[]'::jsonb)
      ) order by b.sort_order, b.id)
      from barbers b where b.business_id = z.id and b.is_active and b.accepts_appointments), '[]'::jsonb),
    'openDays', coalesce((
      select jsonb_agg(d.day order by d.day)
      from (select (business_day_bogota(now()) + i) as day from generate_series(0, 7) i) d
      join business_hours h on h.business_id = z.id and h.weekday = extract(dow from d.day)::int and not h.is_closed
      where not (z.queue_override = 'closed' and z.queue_override_day = d.day)), '[]'::jsonb)
  )
  from businesses z where z.slug = p_slug
$$;

-- REQ-049.3 horas libres como un solo jsonb (las server actions llaman funciones escalares, ADR-009)
create or replace function public_appointment_slots_json(p_slug text, p_service_id uuid, p_barber_id uuid, p_day date)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('starts_at', s.starts_at, 'barber_ids', s.barber_ids) order by s.starts_at),
                  '[]'::jsonb)
  from public_appointment_slots(p_slug, p_service_id, p_barber_id, p_day) s
$$;

revoke all on function public_appointment_info(text), public_appointment_slots_json(text, uuid, uuid, date)
  from public, anon, authenticated;
grant execute on function public_appointment_info(text), public_appointment_slots_json(text, uuid, uuid, date)
  to service_role;
