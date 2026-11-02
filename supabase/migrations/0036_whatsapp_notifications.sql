-- 0036 · Hito 6, aviso automático por WhatsApp (T-064, ADR-027)
-- Cubre: REQ-040.2, 040.3, 040.5–040.7, REQ-041.2, 041.4, 041.5, REQ-042.1–042.3, REQ-043.1–043.3
-- (datos y funciones; el envío, el webhook y las pantallas van en T-065…T-068). Diseño: design.md §12.
-- Apagado (`whatsapp_auto_enabled`, por defecto false) todo sigue como hoy con `wa.me`.

-- ------------------------------------------------------------ columnas ----
-- REQ-043.3 se activa por negocio; REQ-042.4 número que da la respuesta automática
alter table businesses
  add column whatsapp_auto_enabled boolean not null default false,
  add column whatsapp_contact_phone text check (whatsapp_contact_phone ~ '^\+[1-9][0-9]{7,14}$');

-- REQ-041.2 / REQ-042.3 fecha y hora del permiso y de la baja
alter table customers
  add column whatsapp_opt_in_at timestamptz,
  add column whatsapp_opt_out_at timestamptz;

-- -------------------------------------------------- ticket_notifications ----
-- REQ-040.3 / REQ-040.5 `unique (ticket_id, kind)` es lo que garantiza "una sola vez": dos
-- ejecuciones a la vez compiten por el mismo insert y solo una gana. REQ-040.2 `skipped` deja
-- constancia del turno que nació con 2 o menos delante.
create type notification_kind as enum ('two_left', 'called');
create type notification_status as enum ('skipped', 'claimed', 'sent', 'delivered', 'failed');

create table ticket_notifications (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  ticket_id uuid not null references tickets (id) on delete cascade,
  kind notification_kind not null,
  status notification_status not null,
  meta_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (ticket_id, kind)
);
create index ticket_notifications_meta_idx on ticket_notifications (meta_message_id) where meta_message_id is not null;
create index ticket_notifications_month_idx on ticket_notifications (business_id, created_at);

-- El dueño lee las de su negocio; nadie escribe por RLS, solo las funciones de abajo.
alter table ticket_notifications enable row level security;
alter table ticket_notifications force row level security;
create policy ticket_notifications_select on ticket_notifications for select to authenticated
  using (is_owner_of(business_id));
revoke all on ticket_notifications from public, anon, authenticated, service_role;
grant select on ticket_notifications to authenticated, service_role;

-- ------------------------------------------------------- permiso vigente ----
-- REQ-041.5 / REQ-042.3 la baja gana mientras no haya un permiso posterior
create or replace function whatsapp_consent_active(p_opt_in_at timestamptz, p_opt_out_at timestamptz)
returns boolean
language sql immutable set search_path = public as $$
  select p_opt_in_at is not null and (p_opt_out_at is null or p_opt_out_at < p_opt_in_at)
$$;

-- REQ-041.4 el permiso solo lo da el cliente: el personal no lo escribe, ni siquiera el dueño, que
-- sí tiene política de escritura sobre la ficha. `turnos.internal` es merge_customers.
create or replace function customers_whatsapp_consent_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and current_setting('turnos.internal', true) is distinct from '1'
     and ((tg_op = 'INSERT' and (new.whatsapp_opt_in_at is not null or new.whatsapp_opt_out_at is not null))
          or (tg_op = 'UPDATE' and (new.whatsapp_opt_in_at is distinct from old.whatsapp_opt_in_at
                                    or new.whatsapp_opt_out_at is distinct from old.whatsapp_opt_out_at))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger customers_whatsapp_consent_guard before insert or update on customers
  for each row execute function customers_whatsapp_consent_guard();

-- REQ-018.6 eliminar la ficha borra también el permiso y la baja (anonymize_customer no los conoce)
create or replace function customers_clear_birthday_on_anonymize() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.birthday_month := null;
  new.birthday_day := null;
  new.whatsapp_opt_in_at := null;
  new.whatsapp_opt_out_at := null;
  return new;
end $$;

-- REQ-041.2 guarda el permiso que el cliente marcó. Apagado no guarda nada (REQ-043.3).
create or replace function set_whatsapp_opt_in(p_business_id uuid, p_phone text) returns void
language sql security definer set search_path = public as $$
  update customers c set whatsapp_opt_in_at = now()
  from businesses z
  where z.id = p_business_id and z.whatsapp_auto_enabled
    and c.business_id = z.id and c.phone_e164 = p_phone
$$;

-- REQ-041.2 join_queue con la casilla del aviso. Redefinición de 0033 con el parámetro nuevo al
-- final (los llamados con nombre siguen igual). Si ya tiene turno activo también se guarda: el
-- cliente acaba de marcarla.
drop function join_queue(text, text, text, uuid, uuid, int, ticket_source, int, int, uuid);
create function join_queue(
  p_slug text, p_name text, p_phone text, p_service_id uuid,
  p_preferred_barber_id uuid default null, p_privacy_version int default null, p_source ticket_source default 'qr',
  p_birthday_month int default null, p_birthday_day int default null, p_courtesy_product_id uuid default null,
  p_whatsapp_opt_in boolean default false
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
    if p_whatsapp_opt_in then perform set_whatsapp_opt_in(z.id, p_phone); end if;
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

  if p_whatsapp_opt_in then perform set_whatsapp_opt_in(z.id, p_phone); end if;

  insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, source,
                       courtesy_product_id)
  values (z.id, v_customer, trim(p_name), p_phone, p_service_id, p_preferred_barber_id, p_source, p_courtesy_product_id)
  returning * into t;

  return jsonb_build_object('token', t.public_token, 'existing', false);
exception
  when unique_violation then
    select public_token into v_existing from tickets
    where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
    if p_whatsapp_opt_in then perform set_whatsapp_opt_in(z.id, p_phone); end if;
    return jsonb_build_object('token', v_existing, 'existing', true);
end $$;

-- ------------------------------------------------------------------ baja ----
-- REQ-042.1 / REQ-042.3 baja desde "Mi turno". Devuelve si había permiso que retirar.
create or replace function set_whatsapp_opt_out(p_token text) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
begin
  select * into t from tickets where public_token = p_token;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  update customers set whatsapp_opt_out_at = now()
   where id = t.customer_id and whatsapp_consent_active(whatsapp_opt_in_at, whatsapp_opt_out_at);
  return found;
end $$;

-- REQ-042.2 / REQ-042.3 baja por respuesta "PARAR"
create or replace function whatsapp_opt_out_by_phone(p_business_id uuid, p_phone text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update customers set whatsapp_opt_out_at = now()
   where business_id = p_business_id and phone_e164 = p_phone
     and whatsapp_consent_active(whatsapp_opt_in_at, whatsapp_opt_out_at);
  return found;
end $$;

-- ------------------------------------------------------------------ avisos ----
-- REQ-043.1 / REQ-043.2 tope del mes de Bogotá, por negocio. Cuenta todo lo que no sea `skipped`.
create or replace function notification_cap_reached(p_business_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select count(*) >= 3000 from ticket_notifications
  where business_id = p_business_id and status <> 'skipped'
    and created_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
$$;

-- REQ-040.3, 040.6, 041.5, 043.1, 043.3 decide si un aviso se envía. Solo con `claimed` se manda.
-- Un aviso manual previo conserva su autor: si este falla, no debe borrar "Avisado ✓" (REQ-040.7).
create or replace function claim_notification(p_ticket_id uuid, p_kind notification_kind) returns text
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
  v_id uuid;
begin
  select * into t from tickets where id = p_ticket_id for update;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;

  if not (select whatsapp_auto_enabled from businesses where id = t.business_id) then
    return 'disabled';
  end if;
  if t.customer_phone_e164 is null or not exists (
    select 1 from customers c where c.id = t.customer_id
      and whatsapp_consent_active(c.whatsapp_opt_in_at, c.whatsapp_opt_out_at)
  ) then
    return 'no_consent';
  end if;

  -- El bloqueo por negocio evita pasarse del tope por concurrencia
  perform pg_advisory_xact_lock(hashtext('ticket_notifications' || t.business_id::text));
  if notification_cap_reached(t.business_id) then
    return 'cap_reached';
  end if;

  insert into ticket_notifications (business_id, ticket_id, kind, status)
  values (t.business_id, t.id, p_kind, 'claimed')
  on conflict (ticket_id, kind) do nothing
  returning id into v_id;
  if v_id is null then
    return 'duplicate';
  end if;

  if t.notified_by is null then
    update tickets set notified_at = now() where id = t.id;
    perform notify_queue_changed(t.business_id, 'ticket');
  end if;
  return 'claimed';
end $$;

-- REQ-040.2 el turno que nace con 2 o menos delante nunca recibe "faltan 2"
create or replace function skip_two_left(p_ticket_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_business uuid;
begin
  select business_id into v_business from tickets where id = p_ticket_id;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  insert into ticket_notifications (business_id, ticket_id, kind, status)
  values (v_business, p_ticket_id, 'two_left', 'skipped')
  on conflict (ticket_id, kind) do nothing;
end $$;

-- REQ-040.7 / REQ-043.2 estado del aviso, por id (el envío) o por id de Meta (el webhook). Meta
-- repite y desordena eventos: el estado solo avanza y devuelve false si no hubo cambio.
-- `failed` quita "Avisado ✓" solo si lo puso el sistema (no borra un aviso manual).
create or replace function set_notification_status(
  p_status notification_status, p_id uuid default null, p_meta_message_id text default null, p_error text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  n ticket_notifications%rowtype;
begin
  if p_status not in ('sent', 'delivered', 'failed') then
    raise exception 'INVALID_NOTIFICATION_STATUS' using errcode = 'P0004';
  end if;

  select * into n from ticket_notifications
  where id = p_id or (p_id is null and meta_message_id = p_meta_message_id)
  for update;
  if not found then return false; end if;

  if n.status not in ('claimed', 'sent') or (n.status = 'sent' and p_status = 'sent') then
    return false;
  end if;

  update ticket_notifications
     set status = p_status,
         meta_message_id = coalesce(p_meta_message_id, meta_message_id),
         error_code = case when p_status = 'failed' then p_error else error_code end,
         updated_at = now()
   where id = n.id;

  if p_status = 'failed' then
    update tickets set notified_at = null where id = n.ticket_id and notified_by is null;
    if found then perform notify_queue_changed(n.business_id, 'ticket'); end if;
  end if;
  return true;
end $$;

-- REQ-043.2 contadores de /admin/mensajes. Recibe el negocio como birthdays_this_week.
create or replace function notification_month_stats(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'sent', count(*) filter (where status in ('sent', 'delivered')),
      'failed', count(*) filter (where status = 'failed'),
      'capReached', notification_cap_reached(p_business_id))
    from ticket_notifications
    where business_id = p_business_id
      and created_at >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
  );
end $$;

-- REQ-018.5 / REQ-042.3 fusionar fichas conserva la última decisión del cliente: la fecha más nueva
-- de permiso y de baja. Una baja de la ficha fusionada no se pierde. Igual a 0035 salvo esas dos
-- columnas.
create or replace function merge_customers(p_keep_id uuid, p_merge_id uuid)
returns customers
language plpgsql security definer set search_path = public as $$
declare
  k customers%rowtype;
  m customers%rowtype;
  kc loyalty_cards%rowtype;
  mc loyalty_cards%rowtype;
  target loyalty_cards%rowtype;
  other loyalty_cards%rowtype;
  prog loyalty_programs%rowtype;
  v_pref uuid;
begin
  if p_keep_id = p_merge_id then
    raise exception 'SAME_CUSTOMER' using errcode = 'P0004';
  end if;
  select * into k from customers where id = p_keep_id for update;
  select * into m from customers where id = p_merge_id for update;
  if k.id is null or m.id is null or k.business_id <> m.business_id then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(k.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if k.anonymized_at is not null or m.anonymized_at is not null then
    raise exception 'CUSTOMER_ANONYMIZED' using errcode = 'P0004';
  end if;

  select * into kc from loyalty_cards where customer_id = k.id and status in ('active', 'completed') for update;
  select * into mc from loyalty_cards where customer_id = m.id and status in ('active', 'completed') for update;
  if kc.status = 'completed' and mc.status = 'completed' then
    raise exception 'BOTH_REWARDS_PENDING' using errcode = 'P0004';
  end if;

  -- Historial
  update tickets set customer_id = k.id where customer_id = m.id;
  update reminders set customer_id = k.id where customer_id = m.id;
  update loyalty_cards set customer_id = k.id where customer_id = m.id and status = 'redeemed';

  -- Tarjetas abiertas: se juntan en una (ADR-016)
  if mc.id is not null and kc.id is null then
    update loyalty_cards set customer_id = k.id where id = mc.id;
  elsif mc.id is not null and kc.id is not null then
    if mc.status = 'completed' then
      target := mc; other := kc;
    else
      target := kc; other := mc;
    end if;
    update loyalty_stamps set card_id = target.id where card_id = other.id;
    delete from loyalty_cards where id = other.id;
    update loyalty_cards set customer_id = k.id, stamps = target.stamps + other.stamps
     where id = target.id returning * into target;
    select * into prog from loyalty_programs where business_id = k.business_id and enabled;
    if found and target.status = 'active' and target.stamps >= prog.visits_required then
      update loyalty_cards set status = 'completed', completed_at = now() where id = target.id;
    end if;
  end if;

  -- Preferido: el más elegido en los últimos 5 turnos terminados de la ficha unida
  select s.assigned_barber_id into v_pref
  from (
    select assigned_barber_id, count(*) as c
    from (select assigned_barber_id from tickets
          where customer_id = k.id and status = 'done' and assigned_barber_id is not null
          order by finished_at desc nulls last limit 5) last5
    group by assigned_barber_id order by c desc limit 1
  ) s;

  delete from customers where id = m.id;

  perform set_config('turnos.internal', '1', true);
  update customers
     set visits_count = k.visits_count + m.visits_count,
         first_visit_at = least(k.first_visit_at, m.first_visit_at),
         last_visit_at = greatest(k.last_visit_at, m.last_visit_at),
         notes = nullif(concat_ws(E'\n', nullif(trim(k.notes), ''), nullif(trim(m.notes), '')), ''),
         privacy_version = case when coalesce(m.privacy_version, 0) > coalesce(k.privacy_version, 0)
                                then m.privacy_version else k.privacy_version end,
         privacy_accepted_at = case when coalesce(m.privacy_version, 0) > coalesce(k.privacy_version, 0)
                                    then m.privacy_accepted_at else k.privacy_accepted_at end,
         do_not_contact = k.do_not_contact or m.do_not_contact,
         birthday_month = coalesce(k.birthday_month, m.birthday_month),
         birthday_day = coalesce(k.birthday_day, m.birthday_day),
         whatsapp_opt_in_at = greatest(k.whatsapp_opt_in_at, m.whatsapp_opt_in_at),
         whatsapp_opt_out_at = greatest(k.whatsapp_opt_out_at, m.whatsapp_opt_out_at),
         preferred_barber_id = case when k.preferred_barber_manual then k.preferred_barber_id
                                    else coalesce(v_pref, k.preferred_barber_id, m.preferred_barber_id) end
   where id = k.id
  returning * into k;
  perform set_config('turnos.internal', '', true);
  return k;
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  join_queue(text, text, text, uuid, uuid, int, ticket_source, int, int, uuid, boolean),
  whatsapp_consent_active(timestamptz, timestamptz),
  customers_whatsapp_consent_guard(),
  set_whatsapp_opt_in(uuid, text),
  set_whatsapp_opt_out(text),
  whatsapp_opt_out_by_phone(uuid, text),
  notification_cap_reached(uuid),
  claim_notification(uuid, notification_kind),
  skip_two_left(uuid),
  set_notification_status(notification_status, uuid, text, text),
  notification_month_stats(uuid)
from public, anon, authenticated;
grant execute on function
  join_queue(text, text, text, uuid, uuid, int, ticket_source, int, int, uuid, boolean),
  whatsapp_consent_active(timestamptz, timestamptz),
  customers_whatsapp_consent_guard(),
  set_whatsapp_opt_in(uuid, text),
  set_whatsapp_opt_out(text),
  whatsapp_opt_out_by_phone(uuid, text),
  notification_cap_reached(uuid),
  claim_notification(uuid, notification_kind),
  skip_two_left(uuid),
  set_notification_status(notification_status, uuid, text, text),
  notification_month_stats(uuid)
to service_role;
-- Personal (valida el negocio por dentro)
grant execute on function notification_month_stats(uuid) to authenticated;
