-- 0006 · Máquina de estados del turno (T-012, ADR-011)
-- Cubre: REQ-005.2, REQ-007.3–7.5, REQ-007.7, REQ-008.2, REQ-011.4, REQ-012.2, REQ-014.1
-- Diseño: design.md §3 (tabla de transiciones)

create table ticket_transitions (
  from_status ticket_status not null,
  to_status ticket_status not null,
  allowed_actors actor_type[] not null,
  primary key (from_status, to_status)
);

insert into ticket_transitions (from_status, to_status, allowed_actors) values
  ('waiting',    'called',     '{barber,owner}'),
  ('waiting',    'cancelled',  '{customer,owner,system}'),
  ('called',     'in_service', '{barber,owner}'),
  ('called',     'no_show',    '{barber,owner}'),
  ('called',     'waiting',    '{owner}'),
  ('called',     'cancelled',  '{customer,owner,system}'),
  ('in_service', 'done',       '{barber,owner}'),
  ('in_service', 'cancelled',  '{owner}');

alter table ticket_transitions enable row level security;
create policy ticket_transitions_read on ticket_transitions for select to authenticated using (true);

-- ¿Quién soy respecto a este turno? Devuelve el actor efectivo o lanza FORBIDDEN.
-- * service_role (auth.uid() null) puede actuar como customer o system (lo decide el servidor).
-- * dueño del negocio: owner.
-- * barbero del negocio: barber, pero solo sobre turnos asignados a él (o sin asignar al llamar).
create or replace function ticket_actor(p_ticket tickets, p_requested actor_type) returns actor_type
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_barber uuid;
begin
  if v_uid is null then
    if p_requested in ('customer', 'system') then
      return p_requested;
    end if;
    raise exception 'FORBIDDEN' using errcode = '42501', hint = 'Actor no permitido sin sesión.';
  end if;
  if is_owner_of(p_ticket.business_id) then
    return 'owner';
  end if;
  v_barber := my_barber_id(p_ticket.business_id);
  if v_barber is not null and p_requested = 'barber' then
    if p_ticket.assigned_barber_id is null or p_ticket.assigned_barber_id = v_barber then
      return 'barber';
    end if;
    raise exception 'FORBIDDEN' using errcode = '42501', hint = 'El turno está asignado a otro barbero.';
  end if;
  raise exception 'FORBIDDEN' using errcode = '42501';
end $$;

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

revoke all on function transition_ticket(uuid, ticket_status, actor_type, text, uuid) from public;
grant execute on function transition_ticket(uuid, ticket_status, actor_type, text, uuid) to authenticated, service_role;
revoke all on function ticket_actor(tickets, actor_type) from public;
