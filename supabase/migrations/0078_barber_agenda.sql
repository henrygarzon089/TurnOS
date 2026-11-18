-- T-280 · "Mi agenda" del barbero (REQ-099, ADR-073, design §31.1).
-- El barbero lee sus citas pendientes de hoy a +7 días solo por esta función; la RLS de
-- `appointments` no cambia (sigue viendo la tabla solo hoy, REQ-054.6 para la tabla).
create or replace function barber_agenda(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_me uuid;
  v_today date := business_day_bogota(now());
begin
  v_me := my_barber_id(p_business_id);
  if auth.uid() is null or v_me is null then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_from < v_today or p_to < p_from or p_to - p_from > 7 then
    raise exception 'INVALID_RANGE' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'acceptsAppointments', (select b.accepts_appointments and b.is_active from barbers b where b.id = v_me),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', a.id, 'day', a.business_day, 'startsAt', a.starts_at, 'endsAt', a.ends_at,
        'customerName', a.customer_name, 'serviceName', a.service_name,
        'durationMin', a.service_duration_min, 'late', appointment_lapsed(a.starts_at)
      ) order by a.starts_at)
      from appointments a
      where a.barber_id = v_me and a.status = 'booked' and a.business_day between p_from and p_to
    ), '[]'::jsonb)
  );
end $$;

revoke all on function barber_agenda(uuid, date, date) from public, anon;
grant execute on function barber_agenda(uuid, date, date) to authenticated;

-- REQ-099.7: reservar, cancelar o mover una cita avisa al canal `queue:<business_id>` (ADR-008).
-- Hasta ahora ninguna función de citas lo emitía.
create or replace function appointments_notify_queue() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform notify_queue_changed(new.business_id, 'appointment');
  return new;
end $$;

revoke all on function appointments_notify_queue() from public, anon, authenticated;

create trigger appointments_notify_queue
  after insert or update of status, barber_id, starts_at on appointments
  for each row execute function appointments_notify_queue();
