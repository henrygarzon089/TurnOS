-- 0027 · Resumen semanal y ocupación (T-048)
-- Cubre: REQ-028.1, REQ-028.2, REQ-028.4, REQ-021.1. Diseño: design.md §5.3 (semana lunes–domingo,
-- PA-21; ocupación = minutos en servicio ÷ (minutos de apertura × sillas)). REQ-028.3 (comparar con
-- la semana anterior) se arma en la app llamando dos veces a esta función.
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
    'sold', (select coalesce(sum(total), 0) from wk_sales)
  ) into v;
  return v;
end $$;

revoke all on function weekly_summary(uuid, date) from public;
grant execute on function weekly_summary(uuid, date) to authenticated, service_role;
