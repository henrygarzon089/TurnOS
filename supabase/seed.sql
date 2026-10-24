-- ============================================================================
-- Seed de TurnOS (T-009, REQ-034): "Barbería La 33" en Sabaneta.
-- Idempotente: borra y recrea el negocio de ejemplo (cascada) cada vez.
--
-- Usuarios: las filas de auth.users con estos UUID fijos existen...
--   * en la base local, porque este seed las inserta en el shim;
--   * en un proyecto real de Supabase, porque scripts/seed-users.ts las crea con la Admin API
--     (mismo UUID, correo y contraseña/PIN) ANTES de correr este seed.
--
-- Credenciales de prueba (solo desarrollo):
--   dueño   dueno@la33.test          contraseña: turnos123
--   barberos (celular + PIN de 6 dígitos):
--     Juan   300 100 0001  PIN 111111
--     Pedro  300 100 0002  PIN 222222
--     Luis   300 100 0003  PIN 333333
--     Andrés 300 100 0004  PIN 444444
--     Mateo  300 100 0005  PIN 555555
-- ============================================================================

-- Las secciones que dependen de tablas creadas en tareas posteriores (clientes, turnos, ventas)
-- se agregan al final de este archivo en T-011 / T-031 / T-040.

do $$
declare
  v_owner   uuid := 'a0000000-0000-4000-8000-000000000001';
  v_users   uuid[] := array[
    'b0000000-0000-4000-8000-000000000001',
    'b0000000-0000-4000-8000-000000000002',
    'b0000000-0000-4000-8000-000000000003',
    'b0000000-0000-4000-8000-000000000004',
    'b0000000-0000-4000-8000-000000000005'];
  v_names   text[] := array['Juan', 'Pedro', 'Luis', 'Andrés', 'Mateo'];
  v_phones  text[] := array['+573001000001','+573001000002','+573001000003','+573001000004','+573001000005'];
  v_pcts    int[]  := array[50, 50, 60, 60, 70];
  v_biz     uuid;
  v_barber  uuid;
  i int;
begin
  -- Usuarios de Auth (solo tiene efecto en la base local; en Supabase ya existen).
  insert into auth.users (id, email) values (v_owner, 'dueno@la33.test') on conflict (id) do nothing;
  for i in 1..5 loop
    insert into auth.users (id, email)
    values (v_users[i], replace(v_phones[i], '+', '') || '@barberos.turnos.local')
    on conflict (id) do nothing;
  end loop;

  -- Negocio (recreado desde cero)
  delete from businesses where slug = 'la-33';
  perform set_config('request.jwt.claims', json_build_object('sub', v_owner, 'role', 'authenticated')::text, true);
  v_biz := create_business('Barbería La 33', 'la-33', 'Calle 77 Sur # 43A-20, Sabaneta');
  perform set_config('request.jwt.claims', '', true);

  update businesses set chairs_count = 5, default_commission_pct = 50 where id = v_biz;

  -- Horario: L–S 9:00–20:00, domingo 10:00–16:00 (PA-26) — ya lo deja create_business.

  -- Barberos con acceso
  for i in 1..5 loop
    insert into barbers (business_id, user_id, display_name, phone_e164, commission_pct, sort_order)
    values (v_biz, v_users[i], v_names[i], v_phones[i], v_pcts[i], i)
    returning id into v_barber;
    insert into memberships (user_id, business_id, role, barber_id)
    values (v_users[i], v_biz, 'barber', v_barber);
  end loop;

  -- Servicios (COP, duración en minutos)
  insert into services (business_id, name, duration_min, price, sort_order, counts_for_loyalty) values
    (v_biz, 'Corte',          20, 25000, 1, true),
    (v_biz, 'Barba',          15, 15000, 2, true),
    (v_biz, 'Corte + barba',  35, 40000, 3, true),
    (v_biz, 'Corte niño',     20, 20000, 4, true),
    (v_biz, 'Cejas',          10,  8000, 5, false),
    (v_biz, 'Diseño de línea',10, 10000, 6, false);

  -- Productos
  insert into products (business_id, name, price, sort_order) values
    (v_biz, 'Helado',   3000, 1),
    (v_biz, 'Gaseosa',  4000, 2),
    (v_biz, 'Agua',     2500, 3),
    (v_biz, 'Jugo',     5000, 4);
end $$;
