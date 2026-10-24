-- 0007 · Operaciones de fila (T-013)
-- Cubre: REQ-007.1–7.2, REQ-007.6, REQ-010.1–10.2, REQ-010.4–10.6, REQ-012.2–12.3, REQ-016.3, ADR-012

-- Lista de un barbero: sus preferidos + "el que esté libre", en orden de fila (REQ-006.1)
create or replace function barber_queue_tickets(p_barber_id uuid)
returns setof tickets
language sql stable security definer set search_path = public as $$
  select t.* from tickets t
  join barbers b on b.id = p_barber_id and b.business_id = t.business_id
  where t.status = 'waiting'
    and t.business_day = business_day_bogota(now())
    and (t.preferred_barber_id = p_barber_id or t.preferred_barber_id is null)
  order by t.queue_order
$$;

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

  t := transition_ticket(v_ticket, 'called', (case when is_owner_of(v_biz) then 'owner' else 'barber' end)::actor_type, null, v_barber);
  return t;
end $$;

-- REQ-010: pausa / vuelta / presente / ausente. p_reassign: los turnos que lo eligieron pasan a
-- "el que esté libre" conservando su posición (REQ-010.2 opción b).
create or replace function set_barber_status(p_barber_id uuid, p_status barber_status, p_reassign boolean default false)
returns barbers
language plpgsql security definer set search_path = public as $$
declare
  b barbers%rowtype;
begin
  select * into b from barbers where id = p_barber_id for update;
  if not found then
    raise exception 'BARBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not (is_owner_of(b.business_id) or my_barber_id(b.business_id) = b.id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_status = 'busy' then
    raise exception 'INVALID_STATUS' using errcode = 'P0004', hint = 'busy lo pone el turno.';
  end if;
  if p_status in ('paused', 'off') and exists (
    select 1 from tickets where assigned_barber_id = b.id and status in ('called', 'in_service')) then
    raise exception 'BARBER_BUSY' using errcode = 'P0005', hint = 'Termina o resuelve el turno actual antes de pausar.';
  end if;

  update barbers
     set status = p_status,
         present_day = case when p_status = 'off' then null else coalesce(present_day, business_day_bogota(now())) end
   where id = b.id;

  if p_status in ('paused', 'off') and p_reassign then
    with moved as (
      update tickets set preferred_barber_id = null
      where business_id = b.business_id and preferred_barber_id = b.id and status = 'waiting'
      returning id, business_id
    )
    insert into ticket_events (business_id, ticket_id, from_status, to_status, actor_type, actor_user_id, reason, meta)
    select business_id, id, 'waiting', 'waiting',
           (case when auth.uid() is null then 'system' when is_owner_of(b.business_id) then 'owner' else 'barber' end)::actor_type, auth.uid(),
           'reassigned', jsonb_build_object('from_barber', b.id)
    from moved;
  end if;

  select * into b from barbers where id = b.id;
  return b;
end $$;

-- REQ-012.3: el dueño (o barbero) agrega un cliente de mostrador, con o sin celular.
create or replace function add_manual_ticket(
  p_business_id uuid, p_name text, p_phone text, p_service_id uuid, p_preferred_barber_id uuid default null
) returns tickets
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
begin
  if auth.uid() is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  insert into tickets (business_id, customer_name, customer_phone_e164, service_id, preferred_barber_id, source)
  values (p_business_id, p_name, nullif(p_phone, ''), p_service_id, p_preferred_barber_id, 'manual')
  returning * into t;
  return t;
end $$;

-- ADR-012: mover un turno después de otro (o al principio con p_after_ticket_id = null).
create or replace function reorder_ticket(p_ticket_id uuid, p_after_ticket_id uuid default null)
returns tickets
language plpgsql security definer set search_path = public as $$
declare
  t tickets%rowtype;
  v_prev bigint;
  v_next bigint;
begin
  select * into t from tickets where id = p_ticket_id for update;
  if not found then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  if auth.uid() is not null and not is_owner_of(t.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if t.status <> 'waiting' then
    raise exception 'INVALID_TRANSITION' using errcode = 'P0004', hint = 'Solo se reordenan turnos en espera.';
  end if;

  if p_after_ticket_id is null then
    v_prev := 0;
  else
    select queue_order into v_prev from tickets
    where id = p_after_ticket_id and business_id = t.business_id and status = 'waiting';
    if v_prev is null then raise exception 'TICKET_NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  select min(queue_order) into v_next from tickets
  where business_id = t.business_id and status = 'waiting' and business_day = t.business_day
    and queue_order > v_prev and id <> t.id;

  if v_next is null then
    update tickets set queue_order = v_prev + 1000 where id = t.id;
  elsif v_next - v_prev > 1 then
    update tickets set queue_order = v_prev + (v_next - v_prev) / 2 where id = t.id;
  else
    -- Sin hueco: renumerar la fila del día conservando el orden y colocando t después de prev
    with ordered as (
      select id, row_number() over (order by queue_order, created_at) as rn
      from tickets
      where business_id = t.business_id and status = 'waiting' and business_day = t.business_day and id <> t.id
    ), target as (
      select coalesce((select rn from ordered where id = p_after_ticket_id), 0) as pos
    )
    update tickets x set queue_order = sub.new_order
    from (
      select id, (rn + case when rn > (select pos from target) then 1 else 0 end) * 1000 as new_order from ordered
      union all
      select t.id, ((select pos from target) + 1) * 1000
    ) sub
    where x.id = sub.id;
  end if;

  insert into ticket_events (business_id, ticket_id, from_status, to_status, actor_type, actor_user_id, reason, meta)
  values (t.business_id, t.id, 'waiting', 'waiting', 'owner', auth.uid(), 'reordered', jsonb_build_object('after', p_after_ticket_id));

  select * into t from tickets where id = t.id;
  return t;
end $$;

-- REQ-016.3 / CB-20: al retirar un barbero, sus turnos en espera pasan a "el que esté libre".
create or replace function remove_barber(p_barber_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_biz uuid;
  v_user uuid;
begin
  select business_id, user_id into v_biz, v_user from barbers where id = p_barber_id;
  if v_biz is null then
    raise exception 'BARBER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not is_owner_of(v_biz) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from tickets where assigned_barber_id = p_barber_id and status in ('called', 'in_service')) then
    raise exception 'BARBER_BUSY' using errcode = 'P0005', hint = 'Resuelve el turno actual antes de retirarlo.';
  end if;
  perform set_barber_status(p_barber_id, 'off', true);
  update barbers set is_active = false where id = p_barber_id;
  if v_user is not null then
    delete from memberships where user_id = v_user and business_id = v_biz and role = 'barber';
  end if;
  update invitations set expires_at = now() where barber_id = p_barber_id and accepted_at is null;
end $$;

revoke all on function barber_queue_tickets(uuid) from public;
revoke all on function call_next(uuid) from public;
revoke all on function set_barber_status(uuid, barber_status, boolean) from public;
revoke all on function add_manual_ticket(uuid, text, text, uuid, uuid) from public;
revoke all on function reorder_ticket(uuid, uuid) from public;
grant execute on function barber_queue_tickets(uuid), call_next(uuid),
  set_barber_status(uuid, barber_status, boolean), add_manual_ticket(uuid, text, text, uuid, uuid),
  reorder_ticket(uuid, uuid) to authenticated, service_role;
