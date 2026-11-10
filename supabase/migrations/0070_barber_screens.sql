-- T-171 · Pantallas del barbero como el tablero Barbero-Otros (design §22.6, REQ-078.16).
-- 1) La lista de "Clientes" del barbero trae la fidelidad ("7/10") y si tiene membresía ("Familia").
-- 2) "Mis números" muestra las compras del barbero con descuento (REQ-068): el RLS de `sales` no se
--    las deja ver (la venta va sin barbero), así que se leen con una función propia.

-- ------------------------------------------------------------ barber_customers ----
-- Redefinición de 0014: mismas reglas de visibilidad (REQ-018.4) y tres columnas nuevas. Cambia el
-- tipo de retorno, por eso se borra antes.
drop function if exists barber_customers(text, int);
create function barber_customers(p_q text default null, p_limit int default 50)
returns table (id uuid, name text, phone_last4 text, last_visit_at timestamptz, visits_count int,
               in_queue_today boolean, stamps int, stamps_required int, has_membership boolean)
language sql stable security definer set search_path = public as $$
  with me as (
    select b.id as barber_id, b.business_id from barbers b
    join memberships ms on ms.barber_id = b.id
    where ms.user_id = auth.uid()
    limit 1
  ),
  queue_today as (
    select distinct t.customer_id from tickets t, me
    where t.business_id = me.business_id
      and t.business_day = business_day_bogota(now())
      and t.status in ('waiting', 'called', 'in_service')
      and (t.preferred_barber_id = me.barber_id or t.preferred_barber_id is null or t.assigned_barber_id = me.barber_id)
      and t.customer_id is not null
  ),
  served as (
    select distinct t.customer_id from tickets t, me
    where t.business_id = me.business_id and t.assigned_barber_id = me.barber_id and t.customer_id is not null
  ),
  program as (
    select lp.visits_required from loyalty_programs lp, me
    where lp.business_id = me.business_id and lp.enabled
  ),
  plan as (
    select 1 from membership_plans mp, me where mp.business_id = me.business_id and mp.enabled
  )
  select c.id, c.name, right(c.phone_e164, 4), c.last_visit_at, c.visits_count,
         c.id in (select customer_id from queue_today),
         -- Sin programa de fidelidad: null (la lista no muestra "X/10")
         case when exists (select 1 from program) then coalesce(
           (select lc.stamps from loyalty_cards lc
             where lc.customer_id = c.id and lc.status in ('active', 'completed')
             order by lc.status = 'completed' desc limit 1), 0) end,
         (select visits_required from program),
         exists (select 1 from plan) and exists (
           select 1 from membership_members mm
           join membership_periods p on p.membership_id = mm.membership_id
           where mm.customer_id = c.id and mm.business_id = c.business_id and mm.removed_at is null
             and p.status = 'active' and business_day_bogota(now()) between p.starts_on and p.ends_on)
  from customers c, me
  where c.business_id = me.business_id
    and c.anonymized_at is null
    and (c.id in (select customer_id from queue_today) or c.id in (select customer_id from served))
    and (
      p_q is null or p_q = ''
      or c.name ilike '%' || p_q || '%'
      or word_similarity(p_q, c.name) > 0.5
      or (p_q ~ '^\d{3,10}$' and c.phone_e164 like '%' || p_q)
    )
  order by c.id in (select customer_id from queue_today) desc, c.last_visit_at desc nulls last, c.name
  limit p_limit
$$;
revoke all on function barber_customers(text, int) from public;
grant execute on function barber_customers(text, int) to authenticated, service_role;

-- ---------------------------------------------------------- my_staff_purchases ----
-- REQ-068 compras del barbero con descuento desde p_from: total pagado y descuento por día.
-- Solo las suyas y solo las vigentes.
create or replace function my_staff_purchases(p_from date)
returns table (business_day date, total int, staff_discount_total int)
language sql stable security definer set search_path = public as $$
  select s.business_day, s.total, s.staff_discount_total
  from sales s
  join barbers b on b.id = s.staff_buyer_id
  join memberships ms on ms.barber_id = b.id and ms.user_id = auth.uid()
  where s.status = 'active' and s.business_day >= p_from
  order by s.business_day
$$;
revoke all on function my_staff_purchases(date) from public;
grant execute on function my_staff_purchases(date) to authenticated, service_role;
