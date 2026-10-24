-- 0011 · Pantalla pública del televisor (T-027)
-- Cubre: REQ-013.1–13.3, REQ-031.2. Nombres abreviados (primer nombre + inicial) y sin celulares.

create or replace function short_name(p_name text) returns text
language sql immutable as $$
  select case
    when array_length(parts, 1) >= 2 then initcap(parts[1]) || ' ' || upper(left(parts[2], 1)) || '.'
    else initcap(coalesce(parts[1], ''))
  end
  from (select regexp_split_to_array(trim(regexp_replace(p_name, '\s+', ' ', 'g')), ' ') as parts) s
$$;

create or replace function get_screen_queue(p_slug text, p_key text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  z businesses%rowtype;
begin
  select * into z from businesses where slug = p_slug;
  if not found or z.screen_key <> p_key then return null; end if;
  return jsonb_build_object(
    'id', z.id,
    'name', z.name,
    'slug', z.slug,
    'isOpen', is_business_open(z.id),
    'barbers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', b.id, 'name', b.display_name, 'status', b.status,
        'current', (select jsonb_build_object('name', short_name(t.customer_name), 'status', t.status, 'calledAt', t.called_at)
                    from tickets t where t.assigned_barber_id = b.id and t.status in ('called', 'in_service')
                    order by t.called_at desc limit 1),
        'next', coalesce((select jsonb_agg(short_name(t.customer_name) order by t.queue_order)
                 from (select customer_name, queue_order from tickets t
                       where t.business_id = z.id and t.status = 'waiting' and t.preferred_barber_id = b.id
                         and t.business_day = business_day_bogota(now())
                       order by queue_order limit 3) t), '[]'::jsonb)
      ) order by b.sort_order)
      from barbers b where b.business_id = z.id and b.is_active and b.status <> 'off'), '[]'::jsonb),
    'anyone', coalesce((select jsonb_agg(short_name(t.customer_name) order by t.queue_order)
               from (select customer_name, queue_order from tickets t
                     where t.business_id = z.id and t.status = 'waiting' and t.preferred_barber_id is null
                       and t.business_day = business_day_bogota(now())
                     order by queue_order limit 8) t), '[]'::jsonb),
    'waitingCount', (select count(*) from tickets t where t.business_id = z.id and t.status = 'waiting'
                     and t.business_day = business_day_bogota(now()))
  );
end $$;
revoke all on function short_name(text), get_screen_queue(text, text) from public;
grant execute on function short_name(text) to authenticated, service_role;
grant execute on function get_screen_queue(text, text) to service_role;
