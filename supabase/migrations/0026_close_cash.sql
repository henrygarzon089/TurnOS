-- 0026 · Cierre de caja y reapertura (T-046)
-- Cubre: REQ-027.2 (cierre inmutable con totales, efectivo contado, diferencia, hora y quién),
-- REQ-027.3 (día cerrado bloquea ventas/anulaciones — trigger de 0021 —; reabrir con motivo),
-- REQ-027.5 (día de Bogotá). Diseño: design.md §5.2. Solo el dueño (PA-20).

create or replace function close_cash_day(p_business_id uuid, p_day date, p_cash_counted int)
returns cash_closures
language plpgsql security definer set search_path = public as $$
declare
  v_day date := coalesce(p_day, business_day_bogota(now()));
  v_totals jsonb;
  c cash_closures%rowtype;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_cash_counted is null or p_cash_counted < 0 then
    raise exception 'INVALID_CASH_COUNTED' using errcode = 'P0004';
  end if;
  if v_day > business_day_bogota(now()) then
    raise exception 'FUTURE_DAY' using errcode = 'P0004';
  end if;
  if exists (select 1 from cash_closures where business_id = p_business_id and business_day = v_day and status = 'active') then
    raise exception 'ALREADY_CLOSED' using errcode = 'P0004';
  end if;

  -- Foto del día: el mismo resumen de la caja, sin el detalle de ventas ni el cierre
  v_totals := cash_day_summary(p_business_id, v_day) - 'sales' - 'closure';

  insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
  values (p_business_id, v_day, v_totals, (v_totals ->> 'cashExpected')::int, p_cash_counted,
          p_cash_counted - (v_totals ->> 'cashExpected')::int, coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'))
  returning * into c;
  perform notify_queue_changed(p_business_id, 'cash_closure');
  return c;
end $$;

create or replace function reopen_cash_day(p_business_id uuid, p_day date, p_reason text)
returns cash_closures
language plpgsql security definer set search_path = public as $$
declare
  v_day date := coalesce(p_day, business_day_bogota(now()));
  c cash_closures%rowtype;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if length(trim(coalesce(p_reason, ''))) = 0 then raise exception 'REASON_REQUIRED' using errcode = 'P0004'; end if;
  update cash_closures set status = 'voided', reopen_reason = trim(p_reason), voided_at = now()
   where business_id = p_business_id and business_day = v_day and status = 'active'
  returning * into c;
  if not found then raise exception 'NOT_CLOSED' using errcode = 'P0004'; end if;
  perform notify_queue_changed(p_business_id, 'cash_closure');
  return c;
end $$;

-- REQ-027.4 cierres pasados (el más reciente por día)
create or replace function cash_closures_list(p_business_id uuid, p_limit int default 30)
returns table (business_day date, total int, difference int, closed_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.business_day, (c.totals ->> 'total')::int, c.difference, c.closed_at
  from cash_closures c
  where c.business_id = p_business_id and c.status = 'active'
    and (auth.uid() is null or is_owner_of(p_business_id))
  order by c.business_day desc
  limit p_limit
$$;

revoke all on function close_cash_day(uuid, date, int), reopen_cash_day(uuid, date, text), cash_closures_list(uuid, int) from public;
grant execute on function close_cash_day(uuid, date, int), reopen_cash_day(uuid, date, text), cash_closures_list(uuid, int)
  to authenticated, service_role;
