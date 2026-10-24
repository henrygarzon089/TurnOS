-- 0012 · El barbero solo llama al primero de su fila (T-030 trazabilidad, REQ-007.8, PA-04)

-- Transición de estado: valida, aplica efectos, registra evento. Idempotente (REQ-011.4).
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
        if t.id <> (select x.id from tickets x
                    where x.business_id = t.business_id and x.status = 'waiting'
                      and x.business_day = business_day_bogota(now())
                      and (x.preferred_barber_id = v_barber or x.preferred_barber_id is null)
                    order by x.queue_order limit 1) then
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


-- REQ-007.1 / REQ-007.2: llama al primer turno de la lista del barbero. SKIP LOCKED resuelve la
-- carrera entre dos barberos que llaman a la vez al mismo turno de "el que esté libre".
create or replace function call_next(p_barber_id uuid default null)
returns tickets
language plpgsql security definer set search_path = public as $$
declare
  v_barber uuid;
  v_biz uuid;
  v_ticket uuid;
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

  select id into v_ticket
  from tickets
  where business_id = v_biz and status = 'waiting' and business_day = business_day_bogota(now())
    and (preferred_barber_id = v_barber or preferred_barber_id is null)
  order by queue_order
  for update skip locked
  limit 1;

  if v_ticket is null then
    raise exception 'NO_TICKETS' using errcode = 'P0006';
  end if;

  perform set_config('turnos.from_call_next', '1', true);
  t := transition_ticket(v_ticket, 'called', (case when is_owner_of(v_biz) then 'owner' else 'barber' end)::actor_type, null, v_barber);
  perform set_config('turnos.from_call_next', '', true);
  return t;
end $$;

