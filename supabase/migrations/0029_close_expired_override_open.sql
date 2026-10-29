-- 0029 · close_expired_queues respeta la fila abierta a mano ese día (REQ-017.2)
-- REQ-017.2: la apertura o el cierre manual del dueño "prevalece ese día". Antes el cron cancelaba
-- los turnos tras cierre + 60 min aunque el dueño hubiera abierto la fila (queue_override='open').
-- Los turnos de días anteriores se cancelan siempre (REQ-014.2).

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
  return v_count;
end $$;
