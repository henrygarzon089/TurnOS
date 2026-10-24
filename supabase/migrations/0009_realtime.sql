-- 0009 · Señal de tiempo real por Broadcast (T-015, ADR-008)
-- Cubre: REQ-004.2, REQ-006.3, REQ-006.5, REQ-011.2, NFR-002
-- Un solo canal por negocio: queue:<business_id>. Payload sin datos personales.

create or replace function notify_queue_changed(p_business_id uuid, p_kind text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(
    jsonb_build_object('type', 'queue_changed', 'kind', p_kind, 'at', now()),
    'queue_changed',
    'queue:' || p_business_id::text,
    false
  );
exception when others then
  -- Nunca bloquear la operación de la fila por un fallo del canal (NFR-003)
  raise warning 'realtime.send falló: %', sqlerrm;
end $$;

create or replace function tickets_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT'
     or new.status is distinct from old.status
     or new.queue_order is distinct from old.queue_order
     or new.assigned_barber_id is distinct from old.assigned_barber_id
     or new.preferred_barber_id is distinct from old.preferred_barber_id then
    perform notify_queue_changed(new.business_id, 'ticket');
  end if;
  return new;
end $$;

create trigger tickets_broadcast after insert or update on tickets
  for each row execute function tickets_broadcast();

create or replace function barbers_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.status is distinct from old.status or new.is_active is distinct from old.is_active then
    perform notify_queue_changed(new.business_id, 'barber');
  end if;
  return new;
end $$;

create trigger barbers_broadcast after insert or update on barbers
  for each row execute function barbers_broadcast();

-- Cambios de horario/override también cambian lo que ve el cliente (abierto/cerrado)
create or replace function businesses_broadcast() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.queue_override is distinct from old.queue_override or new.queue_override_day is distinct from old.queue_override_day then
    perform notify_queue_changed(new.id, 'business');
  end if;
  return new;
end $$;

create trigger businesses_broadcast after update on businesses
  for each row execute function businesses_broadcast();
