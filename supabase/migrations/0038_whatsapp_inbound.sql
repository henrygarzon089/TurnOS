-- 0038 · Hito 6, mensajes entrantes de WhatsApp (T-067, ADR-028). Diseño: design.md §12.5.
-- Cubre: REQ-042.2, 042.4, 042.5, REQ-018.6. La instalación tiene un solo número: el mensaje no dice
-- de qué negocio es, así que esto lo resuelve a partir del celular. Solo service_role.

-- REQ-042.2 / REQ-042.4 / REQ-042.5 a quién retirarle el permiso y qué número dar. El número sale del
-- negocio del aviso más reciente que sí le llegó; sin aviso, del único negocio activo; si no, null.
create or replace function whatsapp_inbound_context(p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_business uuid;
begin
  select n.business_id into v_business
  from ticket_notifications n join tickets t on t.id = n.ticket_id
  where t.customer_phone_e164 = p_phone and n.status in ('sent', 'delivered')
  order by n.created_at desc limit 1;

  if v_business is null and (select count(*) from businesses where whatsapp_auto_enabled) = 1 then
    select id into v_business from businesses where whatsapp_auto_enabled;
  end if;

  return jsonb_build_object(
    'optOutBusinessIds', coalesce((
      select jsonb_agg(c.business_id) from customers c
      where c.phone_e164 = p_phone and whatsapp_consent_active(c.whatsapp_opt_in_at, c.whatsapp_opt_out_at)
    ), '[]'::jsonb),
    'contactPhone', (select whatsapp_contact_phone from businesses where id = v_business));
end $$;

-- REQ-042.4 ventana móvil: `check_rate_limit` corta en ventanas fijas y dejaría pasar dos respuestas
-- seguidas. Devuelve true si este celular puede recibir una; las claves vencidas se borran aquí.
create or replace function claim_whatsapp_reply(p_phone text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_key text := 'wa-reply:' || p_phone;
begin
  perform pg_advisory_xact_lock(hashtext(v_key));
  delete from rate_limits where key like 'wa-reply:%' and window_start <= now() - interval '24 hours';
  if exists (select 1 from rate_limits where key = v_key) then
    return false;
  end if;
  insert into rate_limits (key, window_start, count) values (v_key, now(), 1);
  return true;
end $$;

-- Redefinición de 0005: su limpieza borra al azar lo de más de 2 horas y se llevaría la ventana de
-- 24 h de `claim_whatsapp_reply`, que limpia sus propias claves.
create or replace function check_rate_limit(p_key text, p_limit int, p_window interval default interval '1 hour')
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_window timestamptz := to_timestamp(floor(extract(epoch from now()) / extract(epoch from p_window)) * extract(epoch from p_window));
  v_count int;
begin
  insert into rate_limits (key, window_start, count) values (p_key, v_window, 1)
  on conflict (key, window_start) do update set count = rate_limits.count + 1
  returning count into v_count;
  -- Limpieza oportunista de ventanas viejas
  delete from rate_limits where window_start < now() - p_window * 2 and key not like 'wa-reply:%' and random() < 0.05;
  return v_count <= p_limit;
end $$;

-- REQ-018.6 redefinición de 0015: también borra el celular de la ventana de respuesta
create or replace function anonymize_customer(p_customer_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c customers%rowtype;
begin
  select * into c from customers where id = p_customer_id for update;
  if not found or c.anonymized_at is not null then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(c.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from tickets where customer_id = c.id and status in ('waiting', 'called', 'in_service')) then
    raise exception 'CUSTOMER_HAS_ACTIVE_TICKET' using errcode = 'P0005';
  end if;

  update tickets set customer_name = 'Cliente eliminado', customer_phone_e164 = null where customer_id = c.id;
  perform set_config('turnos.internal', '1', true);
  update customers
     set name = 'Cliente eliminado', phone_e164 = 'deleted:' || c.id::text, notes = null,
         preferred_barber_id = null, preferred_barber_manual = false, do_not_contact = true,
         anonymized_at = now()
   where id = c.id;
  perform set_config('turnos.internal', '', true);
  delete from reminders where customer_id = c.id;
  delete from rate_limits where key in ('phone:' || c.phone_e164, 'wa-reply:' || c.phone_e164);
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function whatsapp_inbound_context(text), claim_whatsapp_reply(text)
from public, anon, authenticated;
grant execute on function whatsapp_inbound_context(text), claim_whatsapp_reply(text) to service_role;
