-- 0037 · Hito 6, lecturas del envío automático (T-066, ADR-027). Diseño: design.md §12.4.
-- Cubre: REQ-040.1, 040.3, 040.5, 040.7, REQ-043.3. `claim_notification` devuelve solo texto y el
-- gateway solo hace `rpc`, así que dispatchQueueNotifications lee por aquí. Solo service_role.

-- La fila con lo que queue_snapshot no entrega (celular, nombre, enlace), los avisos registrados en
-- cualquier estado y los `claimed` que una ejecución dejó sin enviar. Apagado no entrega nada.
create or replace function get_notification_queue(p_business_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  z businesses%rowtype;
begin
  select * into z from businesses where id = p_business_id;
  if not found or not z.whatsapp_auto_enabled then
    return jsonb_build_object('enabled', false);
  end if;
  return jsonb_build_object(
    'enabled', true,
    'business', jsonb_build_object('name', z.name, 'graceMinutes', z.grace_minutes),
    'queue', queue_snapshot(z.id),
    'tickets', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'status', t.status, 'phoneE164', t.customer_phone_e164,
        'customerName', t.customer_name, 'publicToken', t.public_token))
      from tickets t where t.business_id = z.id and t.status in ('waiting', 'called')
        and t.business_day = business_day_bogota(now())), '[]'::jsonb),
    'recorded', coalesce((
      select jsonb_agg(jsonb_build_object('ticketId', n.ticket_id, 'kind', n.kind))
      from ticket_notifications n join tickets t on t.id = n.ticket_id
      where n.business_id = z.id and t.status in ('waiting', 'called')), '[]'::jsonb),
    'staleClaims', coalesce((
      select jsonb_agg(n.id) from ticket_notifications n
      where n.business_id = z.id and n.status = 'claimed' and n.meta_message_id is null
        and n.created_at < now() - interval '2 minutes'), '[]'::jsonb)
  );
end $$;

-- El aviso recién reclamado, para guardar su resultado con set_notification_status
create or replace function notification_id(p_ticket_id uuid, p_kind notification_kind)
returns uuid
language sql stable security definer set search_path = public as $$
  select id from ticket_notifications where ticket_id = p_ticket_id and kind = p_kind
$$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function get_notification_queue(uuid), notification_id(uuid, notification_kind)
from public, anon, authenticated;
grant execute on function get_notification_queue(uuid), notification_id(uuid, notification_kind)
to service_role;
