-- 0031 · La fila respeta qué servicios hace cada barbero (REQ-035.7–35.12, ADR-023, T-052)
-- La "lista del barbero" (REQ-006.1) pasa a ser: turnos que lo eligieron a él, más los de
-- "el que esté libre" cuyo servicio él hace. Un trigger en tickets valida preferido y asignado
-- (cubre join_queue, add_manual_ticket, reasignar y llamar con barbero). La caja no cambia
-- (REQ-035.13).

create or replace function in_barber_list(p_preferred uuid, p_service uuid, p_barber uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p_preferred = p_barber or (p_preferred is null and barber_does_service(p_barber, p_service));
$$;

-- REQ-035.8 / REQ-035.11 / REQ-035.12
create or replace function tickets_check_barber_service() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Preferido: al crear, o cuando cambia (reasignar). Uno que ya estaba se conserva (REQ-035.12).
  if new.preferred_barber_id is not null
     and (tg_op = 'INSERT' or new.preferred_barber_id is distinct from old.preferred_barber_id)
     and not barber_does_service(new.preferred_barber_id, new.service_id) then
    raise exception 'BARBER_CANT_DO_SERVICE' using errcode = 'P0010';
  end if;
  -- Asignado al llamar: debe hacer el servicio, salvo que sea el preferido del turno (REQ-035.12)
  if new.assigned_barber_id is not null
     and (tg_op = 'INSERT' or new.assigned_barber_id is distinct from old.assigned_barber_id)
     and new.assigned_barber_id is distinct from new.preferred_barber_id
     and not barber_does_service(new.assigned_barber_id, new.service_id) then
    raise exception 'BARBER_CANT_DO_SERVICE' using errcode = 'P0010';
  end if;
  return new;
end $$;
create trigger tickets_check_barber_service before insert or update of preferred_barber_id, assigned_barber_id, service_id
  on tickets for each row execute function tickets_check_barber_service();

-- REQ-035.9 lista del barbero
create or replace function barber_queue_tickets(p_barber_id uuid)
returns setof tickets
language sql stable security definer set search_path = public as $$
  select t.* from tickets t
  join barbers b on b.id = p_barber_id and b.business_id = t.business_id
  where t.status = 'waiting'
    and t.business_day = business_day_bogota(now())
    and in_barber_list(t.preferred_barber_id, t.service_id, p_barber_id)
  order by t.queue_order
$$;

-- REQ-035.9 "Llamar al siguiente" (misma carrera de REQ-007.2, con el filtro por servicio)
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
    and in_barber_list(preferred_barber_id, service_id, v_barber)
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

-- REQ-035.9 / REQ-007.8 "el primero de su fila" también ignora lo que el barbero no hace
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
                      and in_barber_list(x.preferred_barber_id, x.service_id, v_barber)
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

-- REQ-035.7
create or replace function join_queue(
  p_slug text, p_name text, p_phone text, p_service_id uuid,
  p_preferred_barber_id uuid default null, p_privacy_version int default null, p_source ticket_source default 'qr'
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

  -- REQ-035.7 si ya hay alguien presente (disponible, ocupado o en pausa), alguno de los presentes
  -- debe hacer el servicio; con nadie presente todavía, el turno entra como antes (Q16)
  if p_preferred_barber_id is null
     and exists (select 1 from barbers b where b.business_id = z.id and b.is_active and b.status <> 'off')
     and not exists (
    select 1 from barbers b join barber_services bs on bs.barber_id = b.id and bs.service_id = p_service_id
    where b.business_id = z.id and b.is_active and b.status <> 'off'
  ) then
    raise exception 'NO_BARBER_FOR_SERVICE' using errcode = 'P0011';
  end if;

  v_customer := upsert_customer(z.id, p_phone, p_name, p_privacy_version);

  insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, source)
  values (z.id, v_customer, trim(p_name), p_phone, p_service_id, p_preferred_barber_id, p_source)
  returning * into t;

  return jsonb_build_object('token', t.public_token, 'existing', false);
exception
  when unique_violation then
    select public_token into v_existing from tickets
    where business_id = z.id and customer_phone_e164 = p_phone and status in ('waiting', 'called', 'in_service');
    return jsonb_build_object('token', v_existing, 'existing', true);
end $$;

-- Permisos (ADR-019)
revoke execute on function in_barber_list(uuid, uuid, uuid), tickets_check_barber_service() from public, anon, authenticated;
grant execute on function in_barber_list(uuid, uuid, uuid), tickets_check_barber_service() to service_role;
