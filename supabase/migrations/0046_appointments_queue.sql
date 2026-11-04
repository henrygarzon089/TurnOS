-- 0046 · Citas: llegada, prioridad en la fila, "Llamar al siguiente" y cierre (REQ-052, REQ-053,
-- REQ-054.4, ADR-033, design.md §14.3, T-079). La cita llegada es un turno normal: caja, fidelidad,
-- membresía y avisos no cambian. Agrega los valores de plantilla (se usan en 0047: un valor nuevo de
-- enum no se usa en la misma transacción que lo agrega).

alter type message_template_key add value if not exists 'appointment_confirm';
alter type message_template_key add value if not exists 'appointment_reminder';
alter type message_template_key add value if not exists 'appointment_cancelled';

alter table tickets add column appointment_id uuid unique references appointments(id);

-- ------------------------------------------------------- próxima cita ----
-- Inicio de la próxima cita pendiente de hoy del barbero que no perdió la hora (null = ninguna)
create or replace function barber_next_appointment_start(p_barber_id uuid) returns timestamptz
language sql stable security definer set search_path = public as $$
  select min(a.starts_at) from appointments a
  where a.barber_id = p_barber_id and a.status = 'booked'
    and a.business_day = business_day_bogota(now()) and not appointment_lapsed(a.starts_at)
$$;

-- REQ-052.4 el primer turno de la lista del barbero (REQ-035.9) que cabe antes de su próxima cita;
-- una cita llegada (scheduled_at) siempre cabe.
create or replace function barber_next_ticket(p_barber_id uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select x.id from tickets x
  join barbers b on b.id = p_barber_id and b.business_id = x.business_id
  where x.status = 'waiting' and x.business_day = business_day_bogota(now())
    and in_barber_list(x.preferred_barber_id, x.service_id, p_barber_id)
    and (x.scheduled_at is not null
         or barber_next_appointment_start(p_barber_id) is null
         or now() + make_interval(mins => x.service_duration_min) <= barber_next_appointment_start(p_barber_id))
  order by x.queue_order
  limit 1
$$;

-- REQ-052.4 "Llamar al siguiente" (misma carrera de REQ-007.2) salta lo que no cabe
create or replace function call_next(p_barber_id uuid default null)
returns tickets
language plpgsql security definer set search_path = public as $$
declare
  v_barber uuid;
  v_biz uuid;
  v_ticket uuid;
  v_next timestamptz;
  t tickets%rowtype;
begin
  -- Resolver barbero: el propio, o uno del negocio si lo pide el dueño
  if p_barber_id is null then
    select barber_id into v_barber from memberships where user_id = auth.uid() and barber_id is not null limit 1;
  else
    select id into v_barber from barbers where id = p_barber_id;
  end if;
  if v_barber is null then
    raise exception 'BARBER_REQUIRED' using errcode = 'P0005';
  end if;
  select business_id into v_biz from barbers where id = v_barber;
  if auth.uid() is not null and not (is_owner_of(v_biz) or my_barber_id(v_biz) = v_barber) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from barbers where id = v_barber and (status in ('paused', 'off') or not is_active)) then
    raise exception 'BARBER_UNAVAILABLE' using errcode = 'P0005';
  end if;
  if exists (select 1 from tickets where business_id = v_biz and assigned_barber_id = v_barber and status in ('called', 'in_service')) then
    raise exception 'BARBER_BUSY' using errcode = 'P0005';
  end if;

  v_next := barber_next_appointment_start(v_barber);
  select id into v_ticket
  from tickets
  where business_id = v_biz and status = 'waiting' and business_day = business_day_bogota(now())
    and in_barber_list(preferred_barber_id, service_id, v_barber)
    and (scheduled_at is not null or v_next is null
         or now() + make_interval(mins => service_duration_min) <= v_next)
  order by queue_order
  for update skip locked
  limit 1;

  if v_ticket is null then
    if v_next is not null and exists (
      select 1 from tickets where business_id = v_biz and status = 'waiting' and business_day = business_day_bogota(now())
        and in_barber_list(preferred_barber_id, service_id, v_barber)
    ) then
      raise exception 'NEXT_APPOINTMENT' using errcode = 'P0006',
        detail = to_char(v_next at time zone 'America/Bogota', 'HH24:MI');
    end if;
    raise exception 'NO_TICKETS' using errcode = 'P0006';
  end if;

  perform set_config('turnos.from_call_next', '1', true);
  t := transition_ticket(v_ticket, 'called', (case when is_owner_of(v_biz) then 'owner' else 'barber' end)::actor_type, null, v_barber);
  perform set_config('turnos.from_call_next', '', true);
  return t;
end $$;

-- REQ-007.8 / REQ-052.4 "el primero de su fila" del barbero es el primero que cabe
create or replace function transition_ticket(
  p_ticket_id uuid,
  p_to ticket_status,
  p_actor actor_type,
  p_reason text default null,
  p_barber_id uuid default null -- barbero que atiende (al llamar); si es null se infiere
) returns tickets
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
  v_actor actor_type;
  v_allowed actor_type[];
  v_barber uuid;
  v_now timestamptz := now();
begin
  select * into t from tickets where id = p_ticket_id for update;
  if not found then
    raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_actor := ticket_actor(t, p_actor);

  -- Idempotencia: ya está en ese estado → sin cambios ni evento
  if t.status = p_to then
    return t;
  end if;

  select allowed_actors into v_allowed from ticket_transitions
  where from_status = t.status and to_status = p_to;
  if v_allowed is null then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0004',
      detail = format('%s → %s', t.status, p_to);
  end if;
  if not (v_actor = any (v_allowed)) then
    raise exception 'FORBIDDEN' using errcode = '42501',
      hint = format('%s no puede pasar un turno de %s a %s', v_actor, t.status, p_to);
  end if;

  -- Barbero que ejecuta (para asignación y estado)
  v_barber := coalesce(p_barber_id, t.assigned_barber_id,
                       case when v_actor in ('barber', 'owner') then my_barber_id(t.business_id) end);

  case p_to
    when 'called' then
      if v_barber is null then
        raise exception 'BARBER_REQUIRED' using errcode = 'P0005';
      end if;
      -- REQ-007.8 / PA-04: el barbero solo llama al primero de su lista (el dueño sí puede saltar).
      -- call_next ya eligió el primero disponible (con SKIP LOCKED) y lo marca con un GUC.
      if v_actor = 'barber' and current_setting('turnos.from_call_next', true) is distinct from '1' then
        -- REQ-052.4 el primero que cabe antes de su próxima cita
        if t.id is distinct from barber_next_ticket(v_barber) then
          raise exception 'FORBIDDEN' using errcode = '42501',
            hint = 'Solo puedes llamar al primero de tu fila.';
        end if;
      end if;
      if exists (select 1 from tickets x where x.business_id = t.business_id and x.assigned_barber_id = v_barber
                 and x.status in ('called', 'in_service') and x.id <> t.id) then
        raise exception 'BARBER_BUSY' using errcode = 'P0005';
      end if;
      if exists (select 1 from barbers b where b.id = v_barber and (b.status in ('paused', 'off') or not b.is_active)) then
        raise exception 'BARBER_UNAVAILABLE' using errcode = 'P0005';
      end if;
      update tickets set status = 'called', assigned_barber_id = v_barber, called_at = v_now where id = t.id;
    when 'in_service' then
      update tickets set status = 'in_service', started_at = v_now where id = t.id;
      update barbers set status = 'busy' where id = t.assigned_barber_id and status <> 'busy';
    when 'done' then
      update tickets set status = 'done', finished_at = v_now, payment_status = 'pending' where id = t.id;
      update barbers set status = 'available' where id = t.assigned_barber_id and status = 'busy';
    when 'no_show' then
      update tickets set status = 'no_show', finished_at = v_now where id = t.id;
      update barbers set status = 'available' where id = t.assigned_barber_id and status = 'busy';
    when 'cancelled' then
      update tickets set status = 'cancelled', finished_at = v_now,
        cancel_reason = coalesce(nullif(p_reason, '')::cancel_reason,
                                 case v_actor when 'customer' then 'customer'::cancel_reason
                                              when 'system' then 'closing'::cancel_reason
                                              else 'business'::cancel_reason end)
        where id = t.id;
      update barbers set status = 'available' where id = t.assigned_barber_id and status = 'busy';
    when 'waiting' then -- devolver a la fila (dueño)
      update tickets set status = 'waiting', assigned_barber_id = null, called_at = null where id = t.id;
  end case;

  insert into ticket_events (business_id, ticket_id, from_status, to_status, actor_type, actor_user_id, reason)
  values (t.business_id, t.id, t.status, p_to, v_actor, auth.uid(), p_reason);

  select * into t from tickets where id = t.id;
  return t;
end $$;

-- ------------------------------------------------------------- llegada ----
-- REQ-052.2, 052.3, 052.5: la cita se vuelve un turno de la fila
create or replace function mark_appointment_arrived(p_id uuid) returns tickets
language plpgsql security definer set search_path = public as $$
declare
  a appointments%rowtype;
  v_barber uuid;
  v_on_time boolean;
  v_prev bigint;
  v_lo bigint;
  v_hi bigint;
  v_try int;
  t tickets%rowtype;
begin
  select * into a from appointments where id = p_id for update;
  if not found then raise exception 'APPOINTMENT_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not (is_owner_of(a.business_id) or my_barber_id(a.business_id) = a.barber_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if a.status <> 'booked' or a.business_day <> business_day_bogota(now()) then
    raise exception 'NOT_ARRIVABLE' using errcode = 'P0004';
  end if;

  v_barber := a.barber_id;
  -- REQ-052.5 "El que esté libre" con el barbero en pausa o ausente: otro presente que haga el servicio
  if a.any_barber and exists (select 1 from barbers where id = a.barber_id and (status in ('paused', 'off') or not is_active)) then
    select b.id into v_barber from barbers b
    where b.business_id = a.business_id and b.is_active and b.status in ('available', 'busy')
      and barber_does_service(b.id, a.service_id)
    order by (b.status <> 'available'), b.sort_order, b.id
    limit 1;
    v_barber := coalesce(v_barber, a.barber_id);
  end if;

  v_on_time := not appointment_lapsed(a.starts_at);
  begin
    insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id,
                         preferred_barber_id, source, scheduled_at, appointment_id)
    values (a.business_id, a.customer_id, a.customer_name, a.customer_phone_e164, a.service_id,
            v_barber, 'manual', case when v_on_time then a.starts_at end, a.id)
    returning * into t;
  exception when unique_violation then
    raise exception 'ALREADY_IN_QUEUE' using errcode = 'P0004';
  end;

  -- REQ-052.2 delante de los sin cita de su barbero y detrás de sus citas llegadas con hora anterior
  if v_on_time then
    for v_try in 1..2 loop
      select max(x.queue_order) into v_prev from tickets x
      where x.business_id = t.business_id and x.business_day = t.business_day and x.status = 'waiting'
        and x.id <> t.id and x.preferred_barber_id = v_barber
        and x.scheduled_at is not null and x.scheduled_at <= a.starts_at;
      if v_prev is not null then
        v_lo := v_prev;
        select min(x.queue_order) into v_hi from tickets x
        where x.business_id = t.business_id and x.business_day = t.business_day and x.status = 'waiting'
          and x.id <> t.id and x.queue_order > v_prev;
      else
        select min(x.queue_order) into v_hi from tickets x
        where x.business_id = t.business_id and x.business_day = t.business_day and x.status = 'waiting'
          and x.id <> t.id and in_barber_list(x.preferred_barber_id, x.service_id, v_barber);
        if v_hi is null then exit; end if; -- nadie en su fila: se queda al final
        select max(x.queue_order) into v_lo from tickets x
        where x.business_id = t.business_id and x.business_day = t.business_day and x.status = 'waiting'
          and x.id <> t.id and x.queue_order < v_hi;
        v_lo := coalesce(v_lo, v_hi - 2000);
      end if;
      if v_hi is null then exit; end if; -- ya es el último después de su cita anterior
      if v_hi - v_lo >= 2 then
        update tickets set queue_order = (v_lo + v_hi) / 2 where id = t.id;
        exit;
      end if;
      -- Sin hueco entero: renumerar la fila de hoy × 1000 conservando el orden (como reorder_ticket)
      update tickets x set queue_order = r.rn * 1000
      from (select id, row_number() over (order by queue_order, sequence) as rn from tickets
            where business_id = t.business_id and business_day = t.business_day and status = 'waiting' and id <> t.id) r
      where x.id = r.id;
    end loop;
  end if;

  update appointments set status = 'arrived', arrived_at = now(), ticket_id = t.id, barber_id = v_barber,
                          any_barber = any_barber and v_barber = a.barber_id
   where id = a.id;
  select * into t from tickets where id = t.id;
  return t;
end $$;

-- ------------------------------------------------------------- cierre ----
-- Redefinición de 0029: además, las citas pendientes que perdieron la hora quedan "No vino" cuando
-- su día ya pasó o la fila de hoy se cerró (REQ-052.6). No toca citas futuras de un día cerrado a
-- mano: el dueño las ve marcadas y avisa (ADR-033).
create or replace function close_expired_queues()
returns int
language plpgsql security definer set search_path = public as $$
declare
  v_count int := 0;
  r record;
  v_local timestamp := now() at time zone 'America/Bogota';
begin
  for r in
    select t.id
    from tickets t
    join businesses z on z.id = t.business_id
    left join business_hours h on h.business_id = z.id and h.weekday = extract(dow from v_local)::int
    where t.status in ('waiting', 'called')
      and (
        t.business_day < v_local::date
        or (z.queue_override = 'closed' and z.queue_override_day = v_local::date)
        or (
          not (z.queue_override = 'open' and z.queue_override_day = v_local::date)
          and (
            coalesce(h.is_closed, true)
            or v_local >= v_local::date + h.closes_at + interval '60 minutes'
          )
        )
      )
  loop
    perform transition_ticket(r.id, 'cancelled', 'system', 'closing');
    v_count := v_count + 1;
  end loop;

  update appointments a set status = 'no_show'
  from businesses z
  left join business_hours h on h.business_id = z.id and h.weekday = extract(dow from v_local)::int
  where z.id = a.business_id and a.status = 'booked' and appointment_lapsed(a.starts_at)
    and (
      a.business_day < v_local::date
      or (z.queue_override = 'closed' and z.queue_override_day = v_local::date)
      or (
        not (z.queue_override = 'open' and z.queue_override_day = v_local::date)
        and (coalesce(h.is_closed, true) or v_local >= v_local::date + h.closes_at + interval '60 minutes')
      )
    );
  return v_count;
end $$;

-- ------------------------------------------------------------ vistas ----
-- REQ-052.1, 054.4 citas pendientes de hoy: el dueño todas, el barbero las suyas
create or replace function appointments_today(p_business_id uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  v_mine uuid;
begin
  if auth.uid() is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_mine := case when auth.uid() is not null and not is_owner_of(p_business_id) then my_barber_id(p_business_id) end;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'startsAt', a.starts_at, 'endsAt', a.ends_at, 'customerName', a.customer_name,
      'serviceName', a.service_name, 'durationMin', a.service_duration_min,
      'barberId', a.barber_id, 'barberName', b.display_name, 'anyBarber', a.any_barber,
      'late', appointment_lapsed(a.starts_at),
      'barberUnavailable', not b.is_active or b.status in ('paused', 'off')
    ) order by a.starts_at, b.sort_order)
    from appointments a join barbers b on b.id = a.barber_id
    where a.business_id = p_business_id and a.status = 'booked'
      and a.business_day = business_day_bogota(now())
      and (v_mine is null or a.barber_id = v_mine)
  ), '[]'::jsonb);
end $$;

-- REQ-054.1, 054.3, 054.4 agenda del dueño
create or replace function appointments_agenda(p_business_id uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', a.id, 'day', a.business_day, 'startsAt', a.starts_at, 'endsAt', a.ends_at,
      'customerName', a.customer_name, 'phone', a.customer_phone_e164, 'token', a.public_token,
      'serviceId', a.service_id, 'serviceName', a.service_name, 'price', a.service_price,
      'barberId', a.barber_id, 'barberName', b.display_name, 'anyBarber', a.any_barber,
      'status', a.status, 'source', a.source, 'cancelReason', a.cancel_reason,
      'late', a.status = 'booked' and appointment_lapsed(a.starts_at),
      'barberUnavailable', a.business_day = business_day_bogota(now()) and (not b.is_active or b.status in ('paused', 'off')),
      'dayClosed', coalesce(h.is_closed, true) or (z.queue_override = 'closed' and z.queue_override_day = a.business_day)
    ) order by a.starts_at, b.sort_order)
    from appointments a
    join barbers b on b.id = a.barber_id
    join businesses z on z.id = a.business_id
    left join business_hours h on h.business_id = a.business_id and h.weekday = extract(dow from a.business_day)::int
    where a.business_id = p_business_id and a.business_day between p_from and p_to
  ), '[]'::jsonb);
end $$;

-- Redefinición de 0032 (REQ-053, design.md §14.4): `scheduledAt` en cada turno y los huecos de las
-- citas pendientes de hoy. Sin datos personales.
create or replace function queue_snapshot(p_business_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.display_name, 'status', b.status,
        'busyUntil', (
          select case when t.status = 'in_service' then t.started_at + make_interval(mins => t.service_duration_min)
                      when t.status = 'called' then t.called_at + make_interval(mins => t.service_duration_min) end
          from tickets t where t.assigned_barber_id = b.id and t.status in ('called', 'in_service')
          order by t.called_at desc limit 1)
      ) order by b.sort_order)
      from barbers b where b.business_id = p_business_id and b.is_active), '[]'::jsonb),
    'waiting', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id, 'queueOrder', t.queue_order, 'durationMin', t.service_duration_min,
        'preferredBarberId', t.preferred_barber_id, 'displayNumber', t.display_number,
        'capableBarberIds', coalesce((select jsonb_agg(bs.barber_id) from barber_services bs
                                      where bs.service_id = t.service_id), '[]'::jsonb),
        'scheduledAt', t.scheduled_at
      ) order by t.queue_order)
      from tickets t where t.business_id = p_business_id and t.status = 'waiting'
        and t.business_day = business_day_bogota(now())), '[]'::jsonb),
    'appointments', coalesce((
      select jsonb_agg(jsonb_build_object('barberId', a.barber_id, 'startAt', a.starts_at, 'endAt', a.ends_at)
                       order by a.starts_at)
      from appointments a where a.business_id = p_business_id and a.status = 'booked'
        and a.business_day = business_day_bogota(now()) and not appointment_lapsed(a.starts_at)), '[]'::jsonb)
  )
$$;

-- ------------------------------------------------------------ permisos ----
revoke all on function barber_next_appointment_start(uuid), barber_next_ticket(uuid), mark_appointment_arrived(uuid),
  appointments_today(uuid), appointments_agenda(uuid, date, date) from public, anon;
grant execute on function barber_next_appointment_start(uuid), barber_next_ticket(uuid) to service_role;
grant execute on function mark_appointment_arrived(uuid), appointments_today(uuid), appointments_agenda(uuid, date, date)
  to authenticated, service_role;
