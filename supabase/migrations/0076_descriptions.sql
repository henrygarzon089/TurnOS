-- T-260 · Descripción de los servicios y del negocio (REQ-096, REQ-097, ADR-070, design §29.1).
-- Columnas opcionales con largo acotado; null es "sin descripción", nunca texto vacío ni solo espacios.
-- RLS sin cambios: las políticas de `services` y `businesses` ya cubren las columnas nuevas.
alter table services add column description text null
  constraint services_description_len check (description is null or char_length(btrim(description)) between 1 and 140 and char_length(description) <= 140);

alter table businesses add column description text null
  constraint businesses_description_len check (description is null or char_length(btrim(description)) between 1 and 200 and char_length(description) <= 200);

-- Redefinición de 0074: suma `description` del negocio y de cada servicio. Nada más cambia;
-- `create or replace` conserva los permisos de 0008 (solo service_role).
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
    'description', z.description,
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
                                                 'photoPath', s.photo_path, 'description', s.description,
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

