-- 0017 · Progreso de fidelidad visible (T-036)
-- Cubre: REQ-019.3, REQ-019.5, REQ-019.7
-- customer_loyalty: estado de la tarjeta de un cliente (lo usan "Mi turno", la fila del barbero y
-- la ficha). get_ticket_by_token se redefine para incluirlo (solo la tarjeta del propio cliente).

create or replace function customer_loyalty(p_customer_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  c customers%rowtype;
  prog loyalty_programs%rowtype;
  card loyalty_cards%rowtype;
begin
  select * into c from customers where id = p_customer_id;
  if not found or c.anonymized_at is not null then return null; end if;
  if auth.uid() is not null and not is_member_of(c.business_id) then return null; end if;
  select * into prog from loyalty_programs where business_id = c.business_id;
  if not found or not prog.enabled then
    return jsonb_build_object('enabled', false);
  end if;
  select * into card from loyalty_cards
   where customer_id = c.id and status in ('active', 'completed')
   order by created_at desc limit 1;
  return jsonb_build_object(
    'enabled', true,
    'stamps', case when card.status = 'completed' then greatest(card.stamps, prog.visits_required)
                   else coalesce(card.stamps, 0) end,
    'required', prog.visits_required,
    'available', coalesce(card.status = 'completed', false),
    'rewardType', prog.reward_type,
    'rewardServiceName', (select name from services where id = prog.reward_service_id),
    'rewardAmount', prog.reward_amount,
    'cardId', card.id
  );
end $$;

revoke all on function customer_loyalty(uuid) from public;
grant execute on function customer_loyalty(uuid) to authenticated, service_role;

-- REQ-019.7: "Mi turno" incluye el progreso de la tarjeta del cliente (redefinición de 0008).
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
    'queue', queue_snapshot(t.business_id),
    'loyalty', case when t.customer_id is null then null else customer_loyalty(t.customer_id) end
  );
end $$;
