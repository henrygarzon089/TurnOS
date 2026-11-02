-- 0039 · Hito 6, lecturas de las pantallas del aviso (T-068, design.md §12.6)
-- Cubre: REQ-041.1, 041.3, 041.6, REQ-042.1, REQ-043.3. Solo lectura y texto: no cambia datos.
-- Sin esta migración las pantallas nuevas no aparecen: los campos llegan vacíos y se leen como apagado.

-- REQ-041.6 el aviso por defecto dice por dónde pasan los datos. Rige para los negocios nuevos; los
-- que ya existen lo publican con una versión nueva (REQ-002.5). Base: 0033.
create or replace function default_privacy_text(p_name text) returns text
language sql immutable set search_path = public as $$
  select 'AVISO DE PRIVACIDAD (plantilla base — revisar con abogado). ' || p_name ||
    ' es responsable del tratamiento de los datos personales que usted entrega para tomar turno: ' ||
    'nombre, número de celular y, si quiere darlo, el día y mes de su cumpleaños (opcional). ' ||
    'Finalidad: gestionar su turno, contactarlo por WhatsApp sobre su turno, saludarlo en su cumpleaños y, ' ||
    'si lo acepta, enviarle recordatorios y beneficios de fidelidad. ' ||
    'Avisos automáticos: si usted los pide al tomar turno, su celular y nombre pasan por WhatsApp (Meta) ' ||
    'para enviarle los avisos de su turno; puede dejar de recibirlos en "Mi turno" o respondiendo PARAR. ' ||
    'Usted puede conocer, actualizar, rectificar y suprimir sus datos, y revocar esta autorización, ' ||
    'solicitándolo en el local. Tratamiento conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.'
$$;

-- REQ-041.1 / REQ-041.3 casilla o línea según la ficha de ese celular
create or replace function customer_has_whatsapp_consent(p_slug text, p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from customers c join businesses z on z.id = c.business_id
                 where z.slug = p_slug and c.phone_e164 = p_phone
                   and whatsapp_consent_active(c.whatsapp_opt_in_at, c.whatsapp_opt_out_at))
$$;

-- REQ-043.3 el formulario sabe si el negocio tiene el aviso activo. Redefinición de 0033.
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
    'whatsappAutoEnabled', z.whatsapp_auto_enabled,
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'durationMin', s.duration_min, 'price', s.price,
                                                 'barberIds', coalesce((select jsonb_agg(bs.barber_id) from barber_services bs
                                                                        where bs.service_id = s.id), '[]'::jsonb)) order by s.sort_order, s.name)
                 from services s where s.business_id = z.id and s.is_active), '[]'::jsonb),
    'products', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'price', p.price, 'photoPath', p.photo_path)
                                           order by p.sort_order, p.name)
                 from products p where p.business_id = z.id and p.is_active and p.for_sale), '[]'::jsonb),
    'courtesies', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'photoPath', p.photo_path)
                                             order by p.sort_order, p.name)
                 from products p where p.business_id = z.id and p.is_active and p.is_courtesy), '[]'::jsonb),
    'photoCounts', coalesce((select jsonb_object_agg(b.id, n.c)
                 from barbers b
                 cross join lateral (select count(*)::int as c from barber_photos p where p.barber_id = b.id) n
                 where b.business_id = z.id and b.is_active and n.c > 0), '{}'::jsonb),
    'queue', queue_snapshot(z.id)
  );
end $$;

-- REQ-042.1 "Mi turno" ofrece la baja. Apagado no se ofrece aunque la ficha tenga permiso (REQ-043.3).
-- Redefinición de 0033.
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
        and whatsapp_consent_active(c.whatsapp_opt_in_at, c.whatsapp_opt_out_at))
  );
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function customer_has_whatsapp_consent(text, text) from public, anon, authenticated;
grant execute on function customer_has_whatsapp_consent(text, text) to service_role;
