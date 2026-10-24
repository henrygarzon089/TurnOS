-- 0020 · close_expired_queues: "cierre + 60 min" en timestamp, no en time (REQ-014)
-- `closes_at + interval '60 minutes'` sobre `time` da la vuelta a medianoche: con cierre a las
-- 23:30 el límite quedaba en las 00:30 de hoy y el cron cancelaba los turnos todo el día.
-- Se compara contra el instante local de hoy (fecha + cierre + 60 min). Encontrado al correr los
-- E2E de Hito 1 con horario de 24 h (tasks.md, T-014).

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
        or (coalesce(h.is_closed, true))
        or (v_local >= v_local::date + h.closes_at + interval '60 minutes')
      )
  loop
    perform transition_ticket(r.id, 'cancelled', 'system', 'closing');
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;
