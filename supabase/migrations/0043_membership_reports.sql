-- 0043 · Membresía familiar: lecturas para las pantallas (REQ-048, ADR-030, design.md §13.3)
-- T-074: "Vencen esta semana" en "Membresías" (REQ-048.4) y la plantilla de renovación.

-- ------------------------------------------------- plantilla de renovación ----
-- REQ-048.4 / REQ-033 "Membresía por vencer". El valor del enum no se usa en esta misma
-- transacción: los negocios que ya existen la reciben en 0044 (como 'birthday' en 0033/0034).
alter type message_template_key add value if not exists 'membership_renewal';

-- Redefinición de 0033: agrega la plantilla de renovación a los negocios nuevos.
create or replace function create_business(p_name text, p_slug text, p_address text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = '28000';
  end if;

  insert into businesses (name, slug, address) values (p_name, p_slug, p_address) returning id into v_id;
  insert into memberships (user_id, business_id, role) values (v_uid, v_id, 'owner');

  insert into business_hours (business_id, weekday, opens_at, closes_at, is_closed)
  select v_id, d, case when d = 0 then '10:00'::time else '09:00'::time end,
         case when d = 0 then '16:00'::time else '20:00'::time end, false
  from generate_series(0, 6) as d;

  insert into message_templates (business_id, key, body) values
    (v_id, 'notify_2_turns',
     'Hola {nombre}, te saluda {negocio}. Faltan 2 turnos para el tuyo ({tiempo}). Ve saliendo. Sigue tu turno aquí: {enlace}'),
    (v_id, 'reminder_inactive',
     'Hola {nombre}, en {negocio} te extrañamos. ¿Te apartamos un turno? Toma el tuyo sin filas aquí: {enlace}'),
    (v_id, 'share_queue',
     'Toma tu turno en {negocio} sin esperar en el local: {enlace}'),
    (v_id, 'birthday',
     '¡Feliz cumpleaños, {nombre}! En {negocio} te deseamos un gran día.'),
    (v_id, 'membership_renewal',
     'Hola {nombre}, la membresía familiar en {negocio} vence el {fecha}. Renuévala en tu próxima visita.');

  insert into privacy_policy_versions (business_id, version, body) values (v_id, 1, default_privacy_text(p_name));

  return v_id;
end $$;

-- ------------------------------------------------------ vencen esta semana ----
-- REQ-048.4 membresías cuyo último periodo activo termina hoy o en los 6 días siguientes (Bogotá):
-- si ya pagaron el siguiente (REQ-045.4), el último es ese y no salen. Con titular y celular para
-- el botón de WhatsApp. Sin titular que siga en la familia, eliminado (REQ-018.6) o marcado
-- "No contactar" (REQ-020.5), no salen. p_today solo para pruebas.
create or replace function memberships_expiring(p_business_id uuid, p_today date default null)
returns table (membership_id uuid, customer_id uuid, name text, phone_e164 text, ends_on date)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := coalesce(p_today, business_day_bogota(now()));
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select f.id, c.id, c.name, c.phone_e164, last.ends_on
  from family_memberships f
  join lateral (select max(p.ends_on) as ends_on from membership_periods p
                where p.membership_id = f.id and p.status = 'active') last on true
  join customers c on c.id = f.holder_customer_id
  where f.business_id = p_business_id
    and last.ends_on between v_today and v_today + 6
    and c.anonymized_at is null
    and not c.do_not_contact
    and exists (select 1 from membership_members m
                where m.membership_id = f.id and m.customer_id = c.id and m.removed_at is null)
  order by last.ends_on, c.name;
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function memberships_expiring(uuid, date) from public, anon, authenticated;
grant execute on function memberships_expiring(uuid, date) to authenticated, service_role;

-- ============================================ T-075 · "Mi turno" y filas ====

-- ------------------------------------------------- get_ticket_by_token ----
-- Redefinición de 0039: agrega `membership` (REQ-048.1). Lo de membership_status sin los ids de la
-- familia ni datos de otros miembros: solo los cortes del periodo vigente, el total, el vencimiento
-- y el %. Null si el cliente no es miembro, no tiene periodo vigente o el plan está apagado.
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

-- ----------------------------------------------- membership_member_ids ----
-- REQ-048.2 etiqueta "Membresía" en las filas del barbero y del dueño: de los clientes dados, los que
-- son miembros (sin `removed_at`) de una familia con periodo vigente hoy. Vacío con el plan apagado
-- (REQ-044.5). Personal del negocio (barbero o dueño); nunca anon.
create or replace function membership_member_ids(p_business_id uuid, p_customer_ids uuid[])
returns uuid[]
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not exists (select 1 from membership_plans where business_id = p_business_id and enabled) then
    return '{}'::uuid[];
  end if;
  return coalesce((
    select array_agg(distinct m.customer_id order by m.customer_id)
      from membership_members m
      join membership_periods p on p.membership_id = m.membership_id
     where m.business_id = p_business_id and m.removed_at is null
       and m.customer_id = any (p_customer_ids)
       and p.status = 'active' and business_day_bogota(now()) between p.starts_on and p.ends_on
  ), '{}'::uuid[]);
end $$;

revoke execute on function membership_member_ids(uuid, uuid[]) from public, anon, authenticated;
grant execute on function membership_member_ids(uuid, uuid[]) to authenticated, service_role;
