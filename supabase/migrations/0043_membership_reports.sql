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

-- ============================================ T-076 · caja, cierre y semana ====

-- -------------------------------------------------------- cash_day_summary ----
-- Redefinición de 0025 (REQ-048.3, design.md §13.4): agrega `membershipFees` (Σ membership_total, la
-- cuota del ejemplo G) y `membershipCuts` {count, listValue} (líneas 'cut', ejemplo E). Las cuotas ya
-- estaban en `total` y las comisiones de los cortes en la liquidación por barbero. En el detalle, la
-- línea con membresía dice "(membresía)" y un corte en $ 0 sale "Sin pago (membresía)".
-- close_cash_day (0026) guarda la foto de esta función: el cierre trae las dos líneas sin redefinirla.
create or replace function cash_day_summary(p_business_id uuid, p_day date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_day date := coalesce(p_day, business_day_bogota(now()));
  v jsonb;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  with day_sales as (
    select * from sales where business_id = p_business_id and business_day = v_day
  ),
  active as (select * from day_sales where status = 'active'),
  pay as (
    select p.method, sum(p.amount)::int as amount
    from sale_payments p join active s on s.id = p.sale_id group by p.method
  ),
  -- REQ-048.3 cortes de membresía: cantidad y valor de lista (el descuento es todo el precio)
  cuts as (
    select coalesce(sum(i.qty), 0)::int as count, coalesce(sum(i.unit_price * i.qty), 0)::int as list_value
    from sale_items i join active s on s.id = i.sale_id where i.membership_benefit = 'cut'
  ),
  rewards as (
    select coalesce(sum(i.discount), 0)::int as amount
    from sale_items i join active s on s.id = i.sale_id where i.is_reward
  ),
  per_barber as (
    select s.barber_id, b.display_name as name, b.commission_pct as pct,
           count(*) filter (where exists (select 1 from sale_items i where i.sale_id = s.id and i.kind = 'service'))::int as services,
           sum(s.services_total)::int as sold,
           sum(s.commission_amount)::int as commission,
           sum(s.business_amount)::int as business
    from active s join barbers b on b.id = s.barber_id
    group by s.barber_id, b.display_name, b.commission_pct
  ),
  detail as (
    select s.id, s.created_at, s.status, s.voided_reason, s.total, s.commission_amount,
           b.display_name as barber_name, c.name as customer_name,
           (select string_agg(i.name || case when i.qty > 1 then ' ×' || i.qty else '' end
                              || case when i.is_reward then ' (premio)' when i.membership_benefit is not null then ' (membresía)' else '' end,
                              ', ' order by i.id)
            from sale_items i where i.sale_id = s.id) as items,
           (select string_agg(case p.method when 'cash' then 'Efectivo' when 'nequi' then 'Nequi'
                                             when 'transfer' then 'Transferencia' else 'Tarjeta' end, ' + ' order by p.id)
            from sale_payments p where p.sale_id = s.id) as methods,
           exists (select 1 from sale_items i where i.sale_id = s.id and i.membership_benefit = 'cut') as has_cut
    from day_sales s
    left join barbers b on b.id = s.barber_id
    left join customers c on c.id = s.customer_id
  )
  select jsonb_build_object(
    'day', v_day,
    'byMethod', jsonb_build_object(
      'cash', coalesce((select amount from pay where method = 'cash'), 0),
      'nequi', coalesce((select amount from pay where method = 'nequi'), 0),
      'transfer', coalesce((select amount from pay where method = 'transfer'), 0),
      'card', coalesce((select amount from pay where method = 'card'), 0)),
    'total', coalesce((select sum(total) from active), 0),
    'services', coalesce((select sum(services_total) from active), 0),
    'products', coalesce((select sum(products_total) from active), 0),
    'rewards', (select amount from rewards),
    'membershipFees', coalesce((select sum(membership_total) from active), 0),
    'membershipCuts', (select jsonb_build_object('count', count, 'listValue', list_value) from cuts),
    'commission', coalesce((select sum(commission_amount) from active), 0),
    'cashExpected', coalesce((select amount from pay where method = 'cash'), 0),
    'barbers', coalesce((select jsonb_agg(jsonb_build_object(
        'barberId', barber_id, 'name', name, 'pct', pct, 'services', services, 'sold', sold,
        'commission', commission, 'business', business) order by name)
      from per_barber where services > 0 or commission > 0), '[]'::jsonb),
    'sales', coalesce((select jsonb_agg(jsonb_build_object(
        'id', id, 'at', created_at, 'status', status, 'voidedReason', voided_reason, 'total', total,
        'commission', commission_amount, 'barberName', barber_name, 'customerName', customer_name,
        'items', items, 'methods', coalesce(methods, case when has_cut then 'Sin pago (membresía)' else 'Sin pago (premio)' end))
        order by created_at desc)
      from detail), '[]'::jsonb),
    'closure', (select jsonb_build_object('id', c.id, 'closedAt', c.closed_at, 'cashCounted', c.cash_counted,
                                          'cashExpected', c.cash_expected, 'difference', c.difference, 'totals', c.totals)
                from cash_closures c
                where c.business_id = p_business_id and c.business_day = v_day and c.status = 'active')
  ) into v;
  return v;
end $$;

-- ---------------------------------------------------------- weekly_summary ----
-- Redefinición de 0027 (REQ-048.3): las mismas dos líneas para la semana. `sold` ya incluía las cuotas.
create or replace function weekly_summary(p_business_id uuid, p_week_start date default null)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_any date := coalesce(p_week_start, business_day_bogota(now()));
  v_start date := v_any - (extract(isodow from v_any)::int - 1);   -- lunes
  v_from timestamptz := v_start::timestamp at time zone 'America/Bogota';
  v_to timestamptz := (v_start + 7)::timestamp at time zone 'America/Bogota';
  v_chairs int;
  v jsonb;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select greatest(chairs_count, 1) into v_chairs from businesses where id = p_business_id;

  with
  -- Intervalos "en servicio" (busy) del historial de estados (REQ-007.7): del evento busy al siguiente
  ev as (
    select barber_id, status, at, lead(at) over (partition by barber_id order by at, id) as next_at
    from barber_status_events
    where business_id = p_business_id and at < v_to
  ),
  busy as (
    select barber_id, greatest(at, v_from) as s, least(coalesce(next_at, least(now(), v_to)), v_to) as e
    from ev
    where status = 'busy' and coalesce(next_at, now()) > v_from
  ),
  days as (
    select d::date as day,
           (d::timestamp at time zone 'America/Bogota') as d_from,
           ((d + interval '1 day')::timestamp at time zone 'America/Bogota') as d_to,
           coalesce((select case when h.is_closed then 0
                                 else extract(epoch from (h.closes_at - h.opens_at))::int / 60 end
                     from business_hours h
                     where h.business_id = p_business_id and h.weekday = extract(dow from d)::int), 0) as open_minutes
    from generate_series(v_start, v_start + 6, interval '1 day') d
  ),
  day_busy as (
    select dy.day, dy.open_minutes,
           -- least/greatest ignoran NULL: sin intervalo (left join vacío) el día suma 0, no 24 h
           coalesce(sum(case when b.barber_id is null then 0
                             else greatest(extract(epoch from (least(b.e, dy.d_to) - greatest(b.s, dy.d_from))), 0) end) / 60, 0)::int as busy_minutes
    from days dy left join busy b on b.s < dy.d_to and b.e > dy.d_from
    group by dy.day, dy.open_minutes
  ),
  totals as (
    select sum(open_minutes)::int as open_minutes, sum(busy_minutes)::int as busy_minutes from day_busy
  ),
  wk_sales as (
    select * from sales
    where business_id = p_business_id and status = 'active' and business_day between v_start and v_start + 6
  ),
  barber_rows as (
    select b.id, b.display_name as name,
           coalesce((select sum(extract(epoch from (x.e - x.s))) / 60 from busy x where x.barber_id = b.id and x.e > x.s), 0)::int as busy_minutes,
           coalesce((select sum(i.qty) from sale_items i join wk_sales s on s.id = i.sale_id
                     where s.barber_id = b.id and i.kind = 'service'), 0)::int as services,
           coalesce((select sum(s.services_total) from wk_sales s where s.barber_id = b.id), 0)::int as sold,
           coalesce((select sum(s.commission_amount) from wk_sales s where s.barber_id = b.id), 0)::int as commission
    from barbers b
    where b.business_id = p_business_id and b.is_active
  )
  select jsonb_build_object(
    'weekStart', v_start,
    'weekEnd', v_start + 6,
    'chairs', v_chairs,
    'openMinutes', (select open_minutes from totals),
    'busyMinutes', (select busy_minutes from totals),
    'occupancyPct', (select round(busy_minutes * 100.0 / nullif(open_minutes * v_chairs, 0), 1) from totals),
    'days', (select jsonb_agg(jsonb_build_object(
               'day', day, 'openMinutes', open_minutes, 'busyMinutes', busy_minutes,
               'occupancyPct', coalesce(round(busy_minutes * 100.0 / nullif(open_minutes * v_chairs, 0), 1), 0)) order by day)
             from day_busy),
    'barbers', (select coalesce(jsonb_agg(jsonb_build_object(
                  'barberId', id, 'name', name, 'busyMinutes', busy_minutes,
                  'occupancyPct', coalesce(round(busy_minutes * 100.0 / nullif((select open_minutes from totals), 0), 1), 0),
                  'services', services, 'sold', sold, 'commission', commission) order by name), '[]'::jsonb)
                from barber_rows),
    'newCustomers', (select count(*) from customers c
                     where c.business_id = p_business_id and c.first_visit_at >= v_from and c.first_visit_at < v_to),
    'repeatCustomers', (select count(distinct t.customer_id) from tickets t join customers c on c.id = t.customer_id
                        where t.business_id = p_business_id and t.status = 'done'
                          and t.business_day between v_start and v_start + 6 and c.first_visit_at < v_from),
    'lostTickets', (select count(*) from tickets t
                    where t.business_id = p_business_id and t.status in ('no_show', 'cancelled')
                      and t.business_day between v_start and v_start + 6),
    'services', (select coalesce(sum(i.qty), 0) from sale_items i join wk_sales s on s.id = i.sale_id where i.kind = 'service'),
    'sold', (select coalesce(sum(total), 0) from wk_sales),
    'membershipFees', (select coalesce(sum(membership_total), 0) from wk_sales),
    'membershipCuts', (select jsonb_build_object('count', coalesce(sum(i.qty), 0), 'listValue', coalesce(sum(i.unit_price * i.qty), 0))
                       from sale_items i join wk_sales s on s.id = i.sale_id where i.membership_benefit = 'cut')
  ) into v;
  return v;
end $$;

-- ----------------------------------------------------- default_privacy_text ----
-- Redefinición de 0039 (REQ-048.5): el titular entrega el celular de los miembros para la membresía.
-- Rige para los negocios nuevos (create_business); los que ya existen publican una versión nueva
-- del aviso (REQ-002.5). Los permisos de 0033 se conservan con create or replace.
create or replace function default_privacy_text(p_name text) returns text
language sql immutable set search_path = public as $$
  select 'AVISO DE PRIVACIDAD (plantilla base — revisar con abogado). ' || p_name ||
    ' es responsable del tratamiento de los datos personales que usted entrega para tomar turno: ' ||
    'nombre, número de celular y, si quiere darlo, el día y mes de su cumpleaños (opcional). ' ||
    'Finalidad: gestionar su turno, contactarlo por WhatsApp sobre su turno, saludarlo en su cumpleaños y, ' ||
    'si lo acepta, enviarle recordatorios y beneficios de fidelidad. ' ||
    'Avisos automáticos: si usted los pide al tomar turno, su celular y nombre pasan por WhatsApp (Meta) ' ||
    'para enviarle los avisos de su turno; puede dejar de recibirlos en "Mi turno" o respondiendo PARAR. ' ||
    'Membresía familiar: si usted es titular de una membresía, entrega el nombre y el celular de los miembros ' ||
    'de su familia solo para reconocerlos al cobrar los cortes de la membresía, y declara que ellos lo autorizaron. ' ||
    'Usted puede conocer, actualizar, rectificar y suprimir sus datos, y revocar esta autorización, ' ||
    'solicitándolo en el local. Tratamiento conforme a la Ley 1581 de 2012 y el Decreto 1377 de 2013.'
$$;
