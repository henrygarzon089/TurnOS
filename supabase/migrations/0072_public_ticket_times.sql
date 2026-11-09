-- T-174 · "Mi turno" como el tablero (REQ-078.22, REQ-078.23, design.md §22.7).
-- Redefinición de get_ticket_by_token (última en 0043): agrega
--   startedAt    → "Con <barbero> desde <hora>" (en servicio)
--   finishedAt   → "TERMINADO · <hora>" (terminado)
--   servicePrice → "<servicio> · $ <precio>" en la fila del barbero (precio congelado del turno)
-- Las columnas ya existían en tickets (0005). Solo cambia la función; los permisos de 0008 se
-- conservan con create or replace (solo service_role; anon nunca, ADR-009).
-- Número 0072: la 0070 la tomó T-171 (barber_screens) y la 0071 está reservada para T-176.
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
    'servicePrice', t.service_price,
    'preferredBarberId', t.preferred_barber_id,
    'assignedBarberId', t.assigned_barber_id,
    'assignedBarberName', (select display_name from barbers where id = t.assigned_barber_id),
    'preferredBarberName', (select display_name from barbers where id = t.preferred_barber_id),
    'status', t.status,
    'queueOrder', t.queue_order,
    'createdAt', t.created_at,
    'calledAt', t.called_at,
    'startedAt', t.started_at,
    'finishedAt', t.finished_at,
    'cancelReason', t.cancel_reason,
    'queue', queue_snapshot(t.business_id),
    'loyalty', case when t.customer_id is null then null else customer_loyalty(t.customer_id) end,
    'courtesy', (select jsonb_build_object('productId', p.id, 'name', p.name, 'photoPath', p.photo_path,
                                           'served', t.courtesy_served_at is not null, 'servedAt', t.courtesy_served_at)
                 from products p where p.id = t.courtesy_product_id),
    'googleReviewUrl', case when t.status = 'done' then z.google_review_url end,
    'whatsappConsent', z.whatsapp_auto_enabled and exists (
      select 1 from customers c where c.id = t.customer_id
        and whatsapp_consent_active(c.whatsapp_opt_in_at, c.whatsapp_opt_out_at)),
    'membership', case when t.customer_id is null then null
                       else membership_status(t.business_id, t.customer_id) - 'membershipId' - 'periodId' end
  );
end $$;
