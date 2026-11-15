-- 0074 · Hito 20: fotos del barbero, de los servicios, logo y portada (REQ-085…087, REQ-090.2,
-- ADR-063, design.md §26.1). Reutiliza el bucket público `media` de 0033 (lectura pública, 300 KB,
-- el celular reduce la foto antes de subirla): solo se amplían las rutas que se pueden escribir.
--   <negocio>/barbers/<barbero>/<uuid>.webp  foto del barbero (dueño o ese barbero; ya existía)
--   <negocio>/services/<uuid>.webp           foto de un servicio (dueño)
--   <negocio>/brand/<uuid>.webp              logo y portada (dueño)
-- Escribir la ruta en la tabla lo cuidan las políticas de siempre: el dueño escribe barberos,
-- servicios y negocio; el barbero solo su fila (barbers_restrict_self_update no bloquea photo_path).

-- ------------------------------------------------------------- columnas ----
alter table barbers add column photo_path text;
alter table services add column photo_path text;
alter table businesses add column logo_path text;
alter table businesses add column cover_path text;

-- La ruta debe ser del mismo negocio (y del mismo barbero): nadie apunta a la foto de otro.
alter table barbers add constraint barbers_photo_path_own check (
  photo_path is null or photo_path ~ ('^' || business_id::text || '/barbers/' || id::text
                                      || '/[0-9a-f-]{36}\.webp$'));
alter table services add constraint services_photo_path_own check (
  photo_path is null or photo_path ~ ('^' || business_id::text || '/services/[0-9a-f-]{36}\.webp$'));
alter table businesses add constraint businesses_logo_path_own check (
  logo_path is null or logo_path ~ ('^' || id::text || '/brand/[0-9a-f-]{36}\.webp$'));
alter table businesses add constraint businesses_cover_path_own check (
  cover_path is null or cover_path ~ ('^' || id::text || '/brand/[0-9a-f-]{36}\.webp$'));

-- ------------------------------------------------------------- Storage ----
-- Redefinición de 0033: suma `services` y `brand` (solo el dueño).
create or replace function media_can_write(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  m text[];
  v_biz uuid;
begin
  m := regexp_match(p_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
    '(?:barbers/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|products|services|brand)/'
    '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$');
  if m is null then return false; end if;
  v_biz := m[1]::uuid;
  if m[2] is null then
    return is_owner_of(v_biz);
  end if;
  if not exists (select 1 from barbers where id = m[2]::uuid and business_id = v_biz) then
    return false;
  end if;
  return is_owner_of(v_biz) or my_barber_id(v_biz) = m[2]::uuid;
end $$;

-- ------------------------------------------------- lecturas públicas ----
-- Redefinición de 0039: suma logoPath, coverPath, photoPath por servicio y barberPhotos
-- ({ <barbero>: <ruta> } de los activos con foto). Permisos de 0008: solo service_role (ADR-009).
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
    'logoPath', z.logo_path,
    'coverPath', z.cover_path,
    'isOpen', is_business_open(z.id),
    'nextOpening', next_opening_text(z.id),
    'closesAt', (select to_char(h.closes_at, 'HH24:MI') from business_hours h
                 where h.business_id = z.id and h.weekday = extract(dow from now() at time zone 'America/Bogota')::int and not h.is_closed),
    'privacyVersion', (select max(version) from privacy_policy_versions where business_id = z.id),
    'whatsappAutoEnabled', z.whatsapp_auto_enabled,
    'services', coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'durationMin', s.duration_min, 'price', s.price,
                                                 'photoPath', s.photo_path,
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
    'barberPhotos', coalesce((select jsonb_object_agg(b.id, b.photo_path)
                 from barbers b where b.business_id = z.id and b.is_active and b.photo_path is not null), '{}'::jsonb),
    'queue', queue_snapshot(z.id)
  );
end $$;

-- Redefinición de 0072: suma la foto del barbero asignado y del preferido (REQ-085.5).
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
    'business', jsonb_build_object('id', z.id, 'name', z.name, 'slug', z.slug, 'graceMinutes', z.grace_minutes,
                                   'logoPath', z.logo_path),
    'displayNumber', t.display_number,
    'customerName', t.customer_name,
    'serviceName', t.service_name,
    'serviceDurationMin', t.service_duration_min,
    'servicePrice', t.service_price,
    'preferredBarberId', t.preferred_barber_id,
    'assignedBarberId', t.assigned_barber_id,
    'assignedBarberName', (select display_name from barbers where id = t.assigned_barber_id),
    'assignedBarberPhoto', (select photo_path from barbers where id = t.assigned_barber_id),
    'preferredBarberName', (select display_name from barbers where id = t.preferred_barber_id),
    'preferredBarberPhoto', (select photo_path from barbers where id = t.preferred_barber_id),
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

-- Redefinición de 0048: cada barbero que recibe citas trae su foto (REQ-089.1).
create or replace function public_appointment_info(p_slug text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'enabled', z.appointments_enabled,
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.display_name, 'photoPath', b.photo_path,
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
