-- REQ-078.17 / ADR-051: "Llamar a <número>" llama a ese turno o a nadie.
-- call_next recibe el turno que la pantalla muestra; sin él, todo sigue igual (0046).
drop function call_next(uuid);

create function call_next(p_barber_id uuid default null, p_expected uuid default null)
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

  -- REQ-078.17 "Llamar a <número>": si el primero ya no es ese turno, no se llama a nadie
  if p_expected is not null and v_ticket <> p_expected then
    raise exception 'NOT_NEXT' using errcode = 'P0006';
  end if;

  perform set_config('turnos.from_call_next', '1', true);
  t := transition_ticket(v_ticket, 'called', (case when is_owner_of(v_biz) then 'owner' else 'barber' end)::actor_type, null, v_barber);
  perform set_config('turnos.from_call_next', '', true);
  return t;
end $$;

revoke all on function call_next(uuid, uuid) from public;
grant execute on function call_next(uuid, uuid) to authenticated, service_role;

-- REQ-078.17: "Sigue" muestra el turno que "Llamar" llamaría ahora: el primero de la lista del
-- barbero que cabe antes de su próxima cita (barber_next_ticket, 0046), para el barbero en sesión.
create function my_next_ticket()
returns uuid
language sql stable security definer set search_path = public as $$
  select barber_next_ticket(m.barber_id)
  from memberships m
  where m.user_id = auth.uid() and m.barber_id is not null
  limit 1
$$;

revoke all on function my_next_ticket() from public;
grant execute on function my_next_ticket() to authenticated, service_role;
