-- Filo (Sabaneta) · datos iniciales del negocio real
--
-- Cómo usarlo (lo ejecuta Henry, ver CLAUDE.md · Seguridad):
--   1. Crear la cuenta del dueño y el negocio en https://turnos-smoky-nine.vercel.app/crear-negocio
--      con el nombre "Filo" y el enlace "filo".
--   2. Pegar este archivo en Supabase → SQL Editor del proyecto de producción y ejecutarlo.
-- Es idempotente: se puede correr de nuevo para corregir precios o duraciones. No crea barberos
-- (eso va por /admin/barberos con invitación, cuando estén sus celulares) ni toca otros negocios.
-- Decisiones de Henry (2026-10-27): servicios de mujer activos desde ya; manicure/pedicure de hombre
-- creados pero apagados hasta tener la persona que los hace; La 33 se mantiene.

do $$
declare
  v_biz uuid := (select id from businesses where slug = 'filo');
begin
  if v_biz is null then
    raise exception 'Primero crea el negocio "Filo" con el enlace "filo" en /crear-negocio';
  end if;

  -- Negocio
  update businesses
     set chairs_count = 5,              -- 4 de hombres + 1 de mujeres
         default_commission_pct = 50,
         inactive_days = 21,
         grace_minutes = 5,
         pwa_name = 'Filo'
   where id = v_biz;

  -- Horario: lunes a sábado 9:00–20:00, domingo 10:00–16:00 (0 = domingo)
  insert into business_hours (business_id, weekday, opens_at, closes_at, is_closed)
  select v_biz, d, case when d = 0 then time '10:00' else time '09:00' end,
                   case when d = 0 then time '16:00' else time '20:00' end, false
  from generate_series(0, 6) d
  on conflict (business_id, weekday) do update
    set opens_at = excluded.opens_at, closes_at = excluded.closes_at, is_closed = false;

  -- Servicios (se actualizan por nombre si el asistente ya creó alguno)
  drop table if exists _svc;
  create temp table _svc (name text, duration_min int, price int, counts boolean, active boolean, sort int) on commit drop;
  insert into _svc values
    ('Corte',                           30, 45000, true,  true,  1),
    ('Corte + barba',                   45, 60000, true,  true,  2),
    ('Barba',                           15, 20000, true,  true,  3),
    ('Corte niño',                      25, 35000, true,  true,  4),
    ('Cejas',                           10,  8000, false, true,  5),
    ('Diseño o línea',                  10, 10000, false, true,  6),
    ('Limpieza facial express',         20, 30000, false, true,  7),
    ('Manicure para hombre',            30, 25000, false, false, 8),
    ('Pedicure para hombre',            45, 35000, false, false, 9),
    ('Manicure + pedicure para hombre', 75, 55000, false, false, 10),
    ('Corte dama',                      40, 45000, true,  true,  11),
    ('Cepillado (blower)',              30, 30000, false, true,  12),
    ('Peinado',                         30, 35000, false, true,  13),
    ('Corte + cepillado',               60, 65000, true,  true,  14);

  update services s
     set name = v.name, duration_min = v.duration_min, price = v.price, counts_for_loyalty = v.counts,
         is_active = v.active, sort_order = v.sort
    from _svc v
   where s.business_id = v_biz and lower(trim(s.name)) = lower(v.name);
  insert into services (business_id, name, duration_min, price, counts_for_loyalty, is_active, sort_order)
  select v_biz, v.name, v.duration_min, v.price, v.counts, v.active, v.sort
  from _svc v
  where not exists (select 1 from services s where s.business_id = v_biz and lower(trim(s.name)) = lower(v.name));

  -- Productos
  drop table if exists _prod;
  create temp table _prod (name text, price int, sort int) on commit drop;
  insert into _prod values ('Helado', 3000, 1), ('Gaseosa', 4000, 2), ('Agua', 2500, 3), ('Jugo', 5000, 4);
  update products p set name = v.name, price = v.price, is_active = true, sort_order = v.sort
    from _prod v where p.business_id = v_biz and lower(trim(p.name)) = lower(v.name);
  insert into products (business_id, name, price, sort_order)
  select v_biz, v.name, v.price, v.sort from _prod v
  where not exists (select 1 from products p where p.business_id = v_biz and lower(trim(p.name)) = lower(v.name));

  -- Fidelidad: el 10.º corte gratis (premio = el servicio "Corte")
  insert into loyalty_programs (business_id, enabled, visits_required, reward_type, reward_service_id)
  values (v_biz, true, 10, 'free_service',
          (select id from services where business_id = v_biz and lower(trim(name)) = 'corte'))
  on conflict (business_id) do update
    set enabled = true, visits_required = 10, reward_type = 'free_service',
        reward_service_id = excluded.reward_service_id, reward_amount = null, updated_at = now();
end $$;

-- Verificación: debe mostrar 14 servicios (11 activos), 4 productos, 7 días, fidelidad activa y premio "Corte"
select
  (select count(*) from services s join businesses z on z.id = s.business_id where z.slug = 'filo') as servicios,
  (select count(*) from services s join businesses z on z.id = s.business_id where z.slug = 'filo' and s.is_active) as activos,
  (select count(*) from products p join businesses z on z.id = p.business_id where z.slug = 'filo') as productos,
  (select count(*) from business_hours h join businesses z on z.id = h.business_id where z.slug = 'filo') as dias,
  (select enabled from loyalty_programs l join businesses z on z.id = l.business_id where z.slug = 'filo') as fidelidad,
  (select s.name from loyalty_programs l join services s on s.id = l.reward_service_id
     join businesses z on z.id = l.business_id where z.slug = 'filo') as premio;
