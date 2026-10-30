-- 0033 · Hito 5, experiencia del cliente (T-058, ADR-025)
-- Cubre: REQ-036.1, REQ-037.1–37.6, REQ-038.1–38.7, REQ-039.1–39.6 (datos y funciones; las
-- pantallas van en T-059…T-062). Diseño: design.md §11.
-- La plantilla "cumpleaños" de los negocios que ya existen se crea en 0034: un valor nuevo de un
-- enum no se puede usar en la misma transacción que lo agrega.

-- ------------------------------------------------------------ columnas ----
-- REQ-036.1
alter table businesses add column google_review_url text
  check (google_review_url ~ '^https://' and length(google_review_url) <= 500);

-- REQ-037.1 / REQ-037.3: día y mes sin año, juntos, y una fecha que exista (29-feb sí)
alter table customers
  add column birthday_month smallint check (birthday_month between 1 and 12),
  add column birthday_day smallint check (birthday_day between 1 and 31),
  add constraint customers_birthday_pair check ((birthday_month is null) = (birthday_day is null)),
  add constraint customers_birthday_valid check (
    birthday_month is null
    or birthday_day <= extract(day from make_date(2000, birthday_month, 1) + interval '1 month - 1 day'));

-- REQ-038.1: los productos que ya existen quedan a la venta y sin cortesía (nada cambia en caja)
alter table products
  add column for_sale boolean not null default true,
  add column is_courtesy boolean not null default false,
  add column photo_path text;
alter table products add constraint products_business_id_uniq unique (business_id, id);

-- REQ-038.3–038.5: bebida de cortesía del turno (mismo negocio; si borran el producto, el turno
-- queda sin bebida en vez de bloquear el borrado)
alter table tickets
  add column courtesy_product_id uuid,
  add column courtesy_served_at timestamptz,
  add column courtesy_served_by uuid,
  add constraint tickets_courtesy_product_fk foreign key (business_id, courtesy_product_id)
    references products (business_id, id) on delete set null (courtesy_product_id);

-- REQ-037.4 plantilla "cumpleaños" (el texto lo ponen create_business y 0034)
alter type message_template_key add value if not exists 'birthday';

-- ------------------------------------------------------ barber_photos ----
-- REQ-039.1 fotos de cortes por barbero
create table barber_photos (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  barber_id uuid not null,
  path text not null unique check (length(path) between 1 and 300),
  created_at timestamptz not null default now(),
  foreign key (business_id, barber_id) references barbers (business_id, id) on delete cascade
);
create index barber_photos_barber_idx on barber_photos (barber_id, created_at desc);

alter table barber_photos enable row level security;
alter table barber_photos force row level security;
create policy barber_photos_select on barber_photos for select to authenticated
  using (is_member_of(business_id));
create policy barber_photos_owner on barber_photos for all to authenticated
  using (is_owner_of(business_id)) with check (is_owner_of(business_id));
create policy barber_photos_barber_insert on barber_photos for insert to authenticated
  with check (my_barber_id(business_id) = barber_id);
create policy barber_photos_barber_delete on barber_photos for delete to authenticated
  using (my_barber_id(business_id) = barber_id);

-- REQ-039.2 máximo 12 por barbero; el límite vive en la base, no solo en la UI
create or replace function barber_photos_limit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform 1 from barbers where id = new.barber_id for update; -- dos subidas a la vez no pasan de 12
  if (select count(*) from barber_photos where barber_id = new.barber_id) >= 12 then
    raise exception 'PHOTO_LIMIT' using errcode = 'P0013';
  end if;
  return new;
end $$;
create trigger barber_photos_limit before insert on barber_photos
  for each row execute function barber_photos_limit();

-- REQ-018.6 eliminar la ficha borra también el cumpleaños (anonymize_customer no lo conoce)
create or replace function customers_clear_birthday_on_anonymize() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.birthday_month := null;
  new.birthday_day := null;
  return new;
end $$;
create trigger customers_clear_birthday_on_anonymize before update of anonymized_at on customers
  for each row when (new.anonymized_at is not null and old.anonymized_at is null)
  execute function customers_clear_birthday_on_anonymize();

-- ------------------------------------------------------------ Storage ----
-- §11.3 bucket `media`: lectura pública (las fotos salen en páginas sin sesión), 300 KB, solo
-- imágenes. Escritura por ruta: <negocio>/barbers/<barbero>/<uuid>.webp (dueño o ese barbero) y
-- <negocio>/products/<uuid>.webp (dueño).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', true, 307200, array['image/*'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function media_can_write(p_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  m text[];
  v_biz uuid;
begin
  m := regexp_match(p_name,
    '^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/'
    '(?:barbers/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})|products)/'
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

drop policy if exists turnos_media_select on storage.objects;
drop policy if exists turnos_media_insert on storage.objects;
drop policy if exists turnos_media_update on storage.objects;
drop policy if exists turnos_media_delete on storage.objects;
create policy turnos_media_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.media_can_write(name));
create policy turnos_media_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.media_can_write(name));
create policy turnos_media_update on storage.objects for update to authenticated
  using (bucket_id = 'media' and public.media_can_write(name))
  with check (bucket_id = 'media' and public.media_can_write(name));
create policy turnos_media_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and public.media_can_write(name));

-- ------------------------------------------------------ create_business ----
-- Redefinición de 0002: agrega la plantilla "cumpleaños" (REQ-037.4) y el aviso de privacidad
-- por defecto menciona el cumpleaños como dato opcional (REQ-037.6).
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
     '¡Feliz cumpleaños, {nombre}! En {negocio} te deseamos un gran día.');

  insert into privacy_policy_versions (business_id, version, body) values (v_id, 1, default_privacy_text(p_name));

  return v_id;
end $$;

-- Texto por defecto del aviso (plantilla base, revisar con abogado). REQ-037.6
create or replace function default_privacy_text(p_name text) returns text
language sql immutable set search_path = public as $$
  select 'AVISO DE PRIVACIDAD (plantilla base — revisar con abogado). ' || p_name ||
    ' es responsable del tratamiento de los datos personales que usted entrega para tomar turno: ' ||
    'nombre, número de celular y, si quiere darlo, el día y mes de su cumpleaños (opcional). ' ||
    'Finalidad: gestionar su turno, contactarlo por WhatsApp sobre su turno, saludarlo en su cumpleaños y, ' ||
    'si lo acepta, enviarle recordatorios y beneficios de fidelidad. Usted puede conocer, actualizar, ' ||
    'rectificar y suprimir sus datos, y revocar esta autorización, solicitándolo en el local. ' ||
    'Tratamiento conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.'
$$;

-- ------------------------------------------------------- cortesía ----
-- REQ-038.6 producto de cortesía válido: activo, de cortesía y del mismo negocio
create or replace function courtesy_is_valid(p_business_id uuid, p_product_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from products p where p.id = p_product_id and p.business_id = p_business_id
                 and p.is_active and p.is_courtesy)
$$;

-- REQ-037.2 / REQ-038.3 / REQ-038.6: join_queue con cumpleaños y bebida de cortesía.
-- Redefinición de 0031 con parámetros nuevos al final (los llamados con nombre siguen igual).
drop function join_queue(text, text, text, uuid, uuid, int, ticket_source);
create function join_queue(
  p_slug text, p_name text, p_phone text, p_service_id uuid,
  p_preferred_barber_id uuid default null, p_privacy_version int default null, p_source ticket_source default 'qr',
  p_birthday_month int default null, p_birthday_day int default null, p_courtesy_product_id uuid default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  z businesses%rowtype;
  t tickets%rowtype;
  v_existing text;
  v_customer uuid;
begin
  select * into z from businesses where slug = p_slug;
  if not found then raise exception 'BUSINESS_NOT_FOUND' using errcode = 'P0002'; end if;
  if not is_business_open(z.id) then raise exception 'BUSINESS_CLOSED' using errcode = 'P0007'; end if;

  select public_token into v_existing from tickets
  where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
  if v_existing is not null then
    return jsonb_build_object('token', v_existing, 'existing', true);
  end if;

  if p_preferred_barber_id is not null and not exists (
    select 1 from barbers b where b.id = p_preferred_barber_id and b.business_id = z.id and b.is_active and b.status not in ('off', 'paused')
  ) then
    raise exception 'BARBER_UNAVAILABLE' using errcode = 'P0005';
  end if;

  -- REQ-035.7 si ya hay alguien presente, alguno de los presentes debe hacer el servicio (Q16)
  if p_preferred_barber_id is null
     and exists (select 1 from barbers b where b.business_id = z.id and b.is_active and b.status <> 'off')
     and not exists (
    select 1 from barbers b join barber_services bs on bs.barber_id = b.id and bs.service_id = p_service_id
    where b.business_id = z.id and b.is_active and b.status <> 'off'
  ) then
    raise exception 'NO_BARBER_FOR_SERVICE' using errcode = 'P0011';
  end if;

  -- REQ-038.6
  if p_courtesy_product_id is not null and not courtesy_is_valid(z.id, p_courtesy_product_id) then
    raise exception 'COURTESY_INVALID' using errcode = 'P0012';
  end if;

  v_customer := upsert_customer(z.id, p_phone, p_name, p_privacy_version);

  -- REQ-037.2 el cumpleaños del formulario nunca reemplaza uno ya guardado (REQ-037.3: el check
  -- de la tabla rechaza fechas imposibles)
  if p_birthday_month is not null and p_birthday_day is not null then
    update customers set birthday_month = p_birthday_month, birthday_day = p_birthday_day
     where id = v_customer and birthday_month is null;
  end if;

  insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, source,
                       courtesy_product_id)
  values (z.id, v_customer, trim(p_name), p_phone, p_service_id, p_preferred_barber_id, p_source, p_courtesy_product_id)
  returning * into t;

  return jsonb_build_object('token', t.public_token, 'existing', false);
exception
  when unique_violation then
    select public_token into v_existing from tickets
    where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
    return jsonb_build_object('token', v_existing, 'existing', true);
end $$;

-- REQ-038.4 cambiar o quitar la bebida desde "Mi turno", solo en espera
create or replace function set_ticket_courtesy(p_token text, p_product_id uuid default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
begin
  select * into t from tickets where public_token = p_token for update;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  if t.status <> 'waiting' then raise exception 'TICKET_NOT_WAITING' using errcode = 'P0004'; end if;
  if p_product_id is not null and not courtesy_is_valid(t.business_id, p_product_id) then
    raise exception 'COURTESY_INVALID' using errcode = 'P0012';
  end if;
  if t.courtesy_product_id is distinct from p_product_id then
    update tickets set courtesy_product_id = p_product_id where id = t.id;
    perform notify_queue_changed(t.business_id, 'ticket');
  end if;
end $$;

-- REQ-038.5 "Servida ✓": hora y quién; idempotente y sin desmarcar
create or replace function mark_courtesy_served(p_ticket_id uuid)
returns tickets
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
begin
  select * into t from tickets where id = p_ticket_id for update;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not is_member_of(t.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if t.courtesy_product_id is null then raise exception 'NO_COURTESY' using errcode = 'P0004'; end if;
  if t.courtesy_served_at is not null then return t; end if;
  update tickets set courtesy_served_at = now(), courtesy_served_by = auth.uid() where id = t.id
  returning * into t;
  perform notify_queue_changed(t.business_id, 'ticket');
  return t;
end $$;

-- ------------------------------------------------------- cumpleaños ----
-- REQ-037.4 / REQ-037.5 "Cumplen esta semana": hoy y los 6 días siguientes (día de Bogotá);
-- en año no bisiesto el 29-feb se celebra el 28. p_today solo para pruebas.
create or replace function birthdays_this_week(p_business_id uuid, p_today date default null)
returns table (id uuid, name text, phone_e164 text, birthday_month smallint, birthday_day smallint, celebrates_on date)
language plpgsql stable security definer set search_path = public as $$
declare
  v_today date := coalesce(p_today, business_day_bogota(now()));
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select c.id, c.name, c.phone_e164, c.birthday_month, c.birthday_day, g.d
  from customers c
  cross join lateral (select v_today + k as d from generate_series(0, 6) k) g
  where c.business_id = p_business_id
    and c.birthday_month is not null
    and c.anonymized_at is null
    and not c.do_not_contact
    and (
      (extract(month from g.d) = c.birthday_month and extract(day from g.d) = c.birthday_day)
      or (c.birthday_month = 2 and c.birthday_day = 29 and extract(month from g.d) = 2 and extract(day from g.d) = 28
          and extract(day from make_date(extract(year from g.d)::int, 3, 1) - 1) = 28)
    )
  order by g.d, c.name;
end $$;

-- REQ-037.2 el formulario no vuelve a pedir el cumpleaños si la ficha ya lo tiene
create or replace function customer_has_birthday(p_slug text, p_phone text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from customers c join businesses z on z.id = c.business_id
                 where z.slug = p_slug and c.phone_e164 = p_phone and c.anonymized_at is null
                   and c.birthday_month is not null)
$$;

-- ----------------------------------------------------------- fotos ----
-- REQ-039.5 / REQ-039.6 "Ver cortes": fotos de un barbero activo, de la más nueva a la más vieja
create or replace function get_barber_photos(p_slug text, p_barber_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'path', p.path, 'createdAt', p.created_at)
                            order by p.created_at desc, p.id), '[]'::jsonb)
  from barber_photos p
  join barbers b on b.id = p.barber_id and b.is_active
  join businesses z on z.id = p.business_id and z.slug = p_slug
  where p.barber_id = p_barber_id
$$;

-- ------------------------------------------------ lecturas ampliadas ----
-- Redefinición de 0032: productos a la venta (REQ-038.2), cortesías (REQ-038.3) y cuántas fotos
-- tiene cada barbero activo (REQ-039.5). Las fotos van como ruta del bucket `media`; la URL
-- pública la arma la app.
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

-- Redefinición de 0017: bebida del turno (REQ-038.4/038.5) y enlace de reseña solo con el turno
-- terminado (REQ-036.2–036.4).
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
    'googleReviewUrl', case when t.status = 'done' then z.google_review_url end
  );
end $$;

-- Filas del barbero y del dueño (REQ-038.5): leen `tickets` directo (RLS) y barber_queue_tickets
-- devuelve `setof tickets`, así que las columnas courtesy_* llegan sin cambiar funciones.

-- ------------------------------------------------------ permisos ADR-019 ----
revoke execute on function
  join_queue(text, text, text, uuid, uuid, int, ticket_source, int, int, uuid),
  set_ticket_courtesy(text, uuid),
  get_barber_photos(text, uuid),
  customer_has_birthday(text, text),
  courtesy_is_valid(uuid, uuid),
  default_privacy_text(text),
  mark_courtesy_served(uuid),
  birthdays_this_week(uuid, date),
  media_can_write(text),
  barber_photos_limit(),
  customers_clear_birthday_on_anonymize()
from public, anon, authenticated;
grant execute on function
  join_queue(text, text, text, uuid, uuid, int, ticket_source, int, int, uuid),
  set_ticket_courtesy(text, uuid),
  get_barber_photos(text, uuid),
  customer_has_birthday(text, text),
  courtesy_is_valid(uuid, uuid),
  default_privacy_text(text),
  mark_courtesy_served(uuid),
  birthdays_this_week(uuid, date),
  media_can_write(text),
  barber_photos_limit(),
  customers_clear_birthday_on_anonymize()
to service_role;
-- Personal (cada una valida negocio y rol por dentro)
grant execute on function mark_courtesy_served(uuid), birthdays_this_week(uuid, date) to authenticated;
-- Usada por las políticas de storage.objects (se evalúa con la sesión del usuario)
grant execute on function media_can_write(text) to authenticated;
