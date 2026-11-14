-- T-226 · "Mi cita" con la foto del barbero (REQ-085.5, ADR-063, design §26.1).
-- Redefinición de 0045: suma barberPhoto (ruta en `media`, null sin foto). Nada más cambia.
create or replace function get_appointment_by_token(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', a.id, 'status', a.status, 'lapsed', a.status = 'booked' and appointment_lapsed(a.starts_at),
    'startsAt', a.starts_at, 'endsAt', a.ends_at, 'durationMin', a.service_duration_min,
    'serviceName', a.service_name, 'price', a.service_price, 'customerName', a.customer_name,
    'barberName', b.display_name, 'barberPhoto', b.photo_path, 'cancelReason', a.cancel_reason,
    'ticketToken', t.public_token,
    'business', jsonb_build_object('name', z.name, 'slug', z.slug, 'address', z.address)
  )
  from appointments a
  join businesses z on z.id = a.business_id
  join barbers b on b.id = a.barber_id
  left join tickets t on t.id = a.ticket_id
  where a.public_token = p_token
$$;

revoke all on function get_appointment_by_token(text) from public, anon, authenticated;
grant execute on function get_appointment_by_token(text) to service_role;
