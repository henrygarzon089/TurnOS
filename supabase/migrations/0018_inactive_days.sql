-- 0018 · Clientes para recordar (T-037)
-- Cubre: REQ-020.2. Redefine inactive_customers de 0013: "más de N días" se mide en días del
-- negocio (America/Bogota), igual que `days_since`. Antes se comparaban marcas de tiempo y un
-- cliente de "hace 21 días y 2 horas" salía con N = 21 mostrando "21 días".
create or replace function inactive_customers(p_business_id uuid)
returns table (id uuid, name text, phone_e164 text, days_since int, visits_count int,
               preferred_barber_name text, last_reminder_at timestamptz)
language sql stable security definer set search_path = public as $$
  select c.id, c.name, c.phone_e164,
         (business_day_bogota(now()) - business_day_bogota(c.last_visit_at))::int as days_since,
         c.visits_count,
         b.display_name,
         (select max(r.sent_at) from reminders r where r.customer_id = c.id)
  from customers c
  join businesses z on z.id = c.business_id
  left join barbers b on b.id = c.preferred_barber_id
  where c.business_id = p_business_id
    and (auth.uid() is null or is_member_of(p_business_id))
    and c.anonymized_at is null
    and not c.do_not_contact
    and c.visits_count >= 1
    and (business_day_bogota(now()) - business_day_bogota(c.last_visit_at)) > z.inactive_days
    and coalesce((select max(r.sent_at) from reminders r where r.customer_id = c.id), 'epoch')
        < now() - make_interval(days => z.reminder_cooldown_days)
  order by c.last_visit_at asc
$$;
