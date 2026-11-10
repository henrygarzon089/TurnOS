-- 0071 · Pantalla del televisor como el tablero Cliente-Pantalla (T-176, design §22.7)
-- Cubre: REQ-078.25, REQ-013.1, REQ-013.2. Agrega el número de turno al actual, a cada siguiente y a
-- "el primero libre", y la hora de la cita (`scheduledAt`) cuando el siguiente es una cita llegada.
-- Siguen los nombres cortos y nunca el celular. `next` y `anyone` pasan de texto a objetos; la app
-- acepta las dos formas (normalizeScreenView) mientras la 0071 no esté en producción.

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
        'current', (select jsonb_build_object('name', short_name(t.customer_name), 'number', t.display_number,
                                              'status', t.status, 'calledAt', t.called_at)
                    from tickets t where t.assigned_barber_id = b.id and t.status in ('called', 'in_service')
                    order by t.called_at desc limit 1),
        'next', coalesce((select jsonb_agg(jsonb_build_object('name', short_name(t.customer_name),
                                                              'number', t.display_number,
                                                              'scheduledAt', t.scheduled_at)
                                           order by t.queue_order)
                 from (select customer_name, display_number, scheduled_at, queue_order from tickets t
                       where t.business_id = z.id and t.status = 'waiting' and t.preferred_barber_id = b.id
                         and t.business_day = business_day_bogota(now())
                       order by queue_order limit 3) t), '[]'::jsonb)
      ) order by b.sort_order)
      from barbers b where b.business_id = z.id and b.is_active and b.status <> 'off'), '[]'::jsonb),
    'anyone', coalesce((select jsonb_agg(jsonb_build_object('name', short_name(t.customer_name),
                                                            'number', t.display_number)
                                         order by t.queue_order)
               from (select customer_name, display_number, queue_order from tickets t
                     where t.business_id = z.id and t.status = 'waiting' and t.preferred_barber_id is null
                       and t.business_day = business_day_bogota(now())
                     order by queue_order limit 8) t), '[]'::jsonb),
    'waitingCount', (select count(*) from tickets t where t.business_id = z.id and t.status = 'waiting'
                     and t.business_day = business_day_bogota(now()))
  );
end $$;
revoke all on function get_screen_queue(text, text) from public;
grant execute on function get_screen_queue(text, text) to service_role;
