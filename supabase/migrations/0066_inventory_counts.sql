-- 0066 · Hito 13, inventario: conteos, alerta de consumo y rendimiento sugerido (T-123, ADR-039)
-- Cubre: REQ-073.2–073.7. Diseño: design.md §18.3 (record_stock_count) y §18.5 (ejemplos M y N).

-- REQ-073.4 alerta: más del porcentaje del negocio y al menos una unidad entera de exceso
create or replace function inventory_is_alert(p_real int, p_expected numeric, p_pct int) returns boolean
language sql immutable as $$
  select p_real > p_expected * (1 + p_pct / 100.0) and p_real - p_expected >= 1
$$;

-- REQ-073.2 / REQ-073.3 / REQ-073.6 / REQ-073.7 el dueño registra el conteo de un sitio.
-- p_lines: [{itemId, counted, reason?}]. p_at: hora del conteo, solo para pruebas (sin sesión).
create or replace function record_stock_count(p_location_id uuid, p_lines jsonb, p_at timestamptz default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  loc inventory_locations%rowtype;
  v_at timestamptz := case when auth.uid() is null then coalesce(p_at, now()) else now() end;
  v_prev timestamptz;
  v_kind stock_count_kind;
  v_pct int;
  v_count uuid;
  ln jsonb;
  i inventory_items%rowtype;
  v_counted int;
  v_reason stock_adjustment_reason;
  v_system int;
  v_diff int;
  v_services int;
  v_expected numeric(10, 2);
  v_real int;
  v_measuring boolean;
  v_alert boolean;
  v_out jsonb := '[]';
begin
  select * into loc from inventory_locations where id = p_location_id for update;
  if not found then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if auth.uid() is not null and not is_owner_of(loc.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if loc.status = 'closed' then
    raise exception 'STATION_CLOSED' using errcode = 'P0004';
  end if;

  -- Una línea por ítem válido del sitio; las del sitio que hacen falta, obligatorias
  if exists (select 1 from jsonb_array_elements(coalesce(p_lines, '[]')) l
             left join inventory_items it on it.id = (l ->> 'itemId')::uuid and it.business_id = loc.business_id
             where it.id is null
                or (loc.kind = 'shelf' and it.use <> 'sale')
                or (loc.kind = 'station' and it.use <> 'internal'))
     or (select count(*) from jsonb_array_elements(coalesce(p_lines, '[]')))
        <> (select count(distinct l ->> 'itemId') from jsonb_array_elements(coalesce(p_lines, '[]')) l) then
    raise exception 'INVALID_ITEM' using errcode = 'P0004';
  end if;
  if exists (select 1 from inventory_items it
             where it.business_id = loc.business_id and it.is_active
               and case loc.kind when 'warehouse' then true
                                 when 'shelf' then it.use = 'sale'
                                 else it.use = 'internal' and it.station_qty > 0 end
               and not exists (select 1 from jsonb_array_elements(coalesce(p_lines, '[]')) l
                               where (l ->> 'itemId')::uuid = it.id)) then
    raise exception 'MISSING_LINES' using errcode = 'P0004';
  end if;

  select max(counted_at) into v_prev from stock_counts where location_id = loc.id;
  v_kind := case when loc.kind = 'station' and loc.status = 'closing' then 'closing'
                 when v_prev is null then 'initial'
                 when loc.kind = 'station' then 'weekly'
                 else 'monthly' end;
  select inventory_alert_pct into v_pct from businesses where id = loc.business_id;

  insert into stock_counts (business_id, location_id, kind, window_start, counted_at, created_by)
  values (loc.business_id, loc.id, v_kind, v_prev, v_at, auth.uid())
  returning id into v_count;

  for ln in select * from jsonb_array_elements(coalesce(p_lines, '[]')) loop
    select * into i from inventory_items where id = (ln ->> 'itemId')::uuid;
    v_counted := (ln ->> 'counted')::int;
    if v_counted is null or v_counted < 0 then
      raise exception 'INVALID_QTY' using errcode = 'P0004';
    end if;
    v_reason := nullif(ln ->> 'reason', '')::stock_adjustment_reason;
    v_system := stock_qty(loc.id, i.id);
    v_diff := v_counted - v_system;
    v_services := null; v_expected := null; v_real := null; v_measuring := false; v_alert := false;

    if v_kind = 'initial' then
      v_reason := 'initial';
    elsif loc.kind <> 'station' then
      if v_diff <> 0 and (v_reason is null or v_reason = 'initial') then
        raise exception 'REASON_REQUIRED' using errcode = 'P0004';
      end if;
    else
      v_reason := case when v_diff > 0 then 'surplus' end;
    end if;
    if v_diff = 0 then
      v_reason := null;
    end if;

    -- Movimiento de la diferencia: el stock queda igual a lo contado
    if v_diff < 0 then
      insert into stock_movements (business_id, item_id, kind, from_location_id, qty, reason, count_id, created_by)
      values (loc.business_id, i.id,
              (case when loc.kind = 'station' and v_kind <> 'initial' then 'use' else 'adjustment' end)::stock_movement_kind,
              loc.id, -v_diff, case when loc.kind = 'station' and v_kind <> 'initial' then null else v_reason end,
              v_count, auth.uid());
    elsif v_diff > 0 then
      insert into stock_movements (business_id, item_id, kind, to_location_id, qty, reason, count_id, created_by)
      values (loc.business_id, i.id, 'adjustment', loc.id, v_diff, v_reason, v_count, auth.uid());
    end if;

    -- REQ-073.2 / REQ-073.3 consumo esperado y real de la estación en la ventana
    if loc.kind = 'station' and v_prev is not null then
      select coalesce(sum(si.qty), 0)::int,
             coalesce(round(sum(si.qty::numeric / u.services_per_unit) filter (where u.services_per_unit is not null), 2), 0)
      into v_services, v_expected
      from sale_items si
      join sales s on s.id = si.sale_id
      join inventory_usage u on u.item_id = i.id and u.service_id = si.ref_id
      where si.kind = 'service' and s.status = 'active' and s.barber_id = loc.barber_id
        and s.business_id = loc.business_id and s.created_at > v_prev and s.created_at <= v_at;
      v_real := coalesce((select sum(m.qty) from stock_movements m
                          where m.from_location_id = loc.id and m.item_id = i.id and m.kind = 'empty'
                            and m.created_at > v_prev and m.created_at <= v_at), 0)::int
                + greatest(-v_diff, 0);
      v_measuring := not exists (select 1 from inventory_usage u where u.item_id = i.id and u.services_per_unit is not null)
                     or exists (select 1 from inventory_usage u where u.item_id = i.id and u.services_per_unit is null);
      v_alert := not v_measuring and inventory_is_alert(v_real, v_expected, v_pct);
    end if;

    insert into stock_count_lines (count_id, business_id, item_id, system_qty, counted_qty, difference, reason,
                                   services, expected_use, real_use, measuring, alert)
    values (v_count, loc.business_id, i.id, v_system, v_counted, v_diff, v_reason, v_services, v_expected, v_real,
            v_measuring, v_alert);

    -- REQ-073.7 al cerrar la estación, lo contado vuelve a la bodega
    if v_kind = 'closing' and v_counted > 0 then
      insert into stock_movements (business_id, item_id, kind, from_location_id, to_location_id, qty, count_id, created_by)
      select loc.business_id, i.id, 'transfer', loc.id, w.id, v_counted, v_count, auth.uid()
      from inventory_locations w where w.business_id = loc.business_id and w.kind = 'warehouse';
    end if;

    v_out := v_out || jsonb_build_object('itemId', i.id, 'name', i.name, 'unitLabel', i.unit_label,
                                         'systemQty', v_system, 'countedQty', v_counted, 'difference', v_diff,
                                         'reason', v_reason, 'services', v_services, 'expectedUse', v_expected,
                                         'realUse', v_real, 'measuring', v_measuring, 'alert', v_alert);
  end loop;

  if v_kind = 'closing' then
    update inventory_locations set status = 'closed' where id = loc.id;
  end if;

  return jsonb_build_object('countId', v_count, 'kind', v_kind, 'windowStart', v_prev, 'countedAt', v_at,
                            'lines', v_out);
end $$;

-- REQ-073.5 insumos en "Midiendo" con 4 o más conteos con consumo → rendimiento sugerido
create or replace function inventory_yield_suggestions(p_business_id uuid)
returns table (item_id uuid, name text, windows int, services int, real_use int, suggested int)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select i.id, i.name, count(*)::int, sum(cl.services)::int, sum(cl.real_use)::int,
         greatest(1, floor(sum(cl.services)::numeric / sum(cl.real_use)))::int
  from inventory_items i
  join stock_count_lines cl on cl.item_id = i.id and cl.measuring and cl.real_use > 0
  where i.business_id = p_business_id and i.is_active and i.use = 'internal'
    and exists (select 1 from inventory_usage u where u.item_id = i.id and u.services_per_unit is null)
  group by i.id, i.name
  having count(*) >= 4
  order by i.name;
end $$;

-- REQ-073.5 el dueño acepta (o cambia) el rendimiento sugerido: queda en los servicios "Midiendo"
create or replace function accept_yield(p_item_id uuid, p_services_per_unit int) returns void
language plpgsql security definer set search_path = public as $$
declare
  i inventory_items%rowtype := inventory_owned_item(p_item_id);
begin
  if p_services_per_unit is null or p_services_per_unit < 1 then
    raise exception 'INVALID_YIELD' using errcode = 'P0004';
  end if;
  update inventory_usage set services_per_unit = p_services_per_unit
  where item_id = i.id and services_per_unit is null;
end $$;

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  inventory_is_alert(int, numeric, int),
  record_stock_count(uuid, jsonb, timestamptz),
  inventory_yield_suggestions(uuid),
  accept_yield(uuid, int)
from public, anon, authenticated;
grant execute on function
  inventory_is_alert(int, numeric, int),
  record_stock_count(uuid, jsonb, timestamptz),
  inventory_yield_suggestions(uuid),
  accept_yield(uuid, int)
to service_role;
-- Personal (cada una valida al dueño por dentro)
grant execute on function
  record_stock_count(uuid, jsonb, timestamptz),
  inventory_yield_suggestions(uuid),
  accept_yield(uuid, int)
to authenticated;
