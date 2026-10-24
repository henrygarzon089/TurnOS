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

-- ============================================================================
-- T-031 · Clientes con historial (REQ-034.1): 30 clientes, visitas pasadas, fidelidad activa
-- ============================================================================
do $$
declare
  v_biz uuid := (select id from businesses where slug = 'la-33');
  v_corte uuid := (select id from services where business_id = (select id from businesses where slug = 'la-33') and name = 'Corte');
  v_barbers uuid[] := array(select id from barbers where business_id = (select id from businesses where slug = 'la-33') order by sort_order);
  names text[] := array['Camilo Restrepo','Sara Mejía','Andrés Pulgarín','Valentina Ríos','Mateo Londoño','Isabella Gómez',
    'Samuel Zapata','Mariana Ortiz','Daniel Cardona','Luciana Vélez','Tomás Henao','Emma Salazar','Nicolás Arango','Sofía Betancur',
    'Juan José Mesa','Antonella Díaz','Santiago Vargas','Gabriela Montoya','Emiliano Correa','Salomé Rendón','David Ospina',
    'Victoria Palacio','Martín Escobar','Julieta Castaño','Jerónimo Botero','Paula Álvarez','Felipe Moreno','Catalina Giraldo',
    'Alejandro Toro','Manuela Jaramillo'];
  i int; v_cust uuid; v_visits int; v_last timestamptz; v_barber uuid; k int; v_day date;
begin
  insert into loyalty_programs (business_id, enabled, visits_required, reward_type, reward_service_id)
  values (v_biz, true, 10, 'free_service', v_corte)
  on conflict (business_id) do update set enabled = true, visits_required = 10, reward_service_id = v_corte;

  for i in 1..30 loop
    v_visits := (i % 12) + 1;                        -- 1..12 visitas
    v_last := now() - make_interval(days => (i * 7) % 60); -- última visita hace 0..59 días
    v_barber := v_barbers[(i % 5) + 1];
    insert into customers (business_id, phone_e164, name, preferred_barber_id, first_visit_at, last_visit_at, visits_count,
                           privacy_accepted_at, privacy_version)
    values (v_biz, '+5730020000' || lpad(i::text, 2, '0'), names[i], v_barber,
            v_last - make_interval(days => v_visits * 14), v_last, v_visits, v_last - make_interval(days => v_visits * 14), 1)
    returning id into v_cust;

    -- Historial: un turno terminado por visita, en días distintos
    for k in 1..v_visits loop
      v_day := (v_last - make_interval(days => (v_visits - k) * 14))::date;
      insert into tickets (business_id, business_day, customer_id, customer_name, customer_phone_e164, service_id,
                           assigned_barber_id, status, created_at, called_at, started_at, finished_at, payment_status, source)
      values (v_biz, v_day, v_cust, names[i], '+5730020000' || lpad(i::text, 2, '0'), v_corte, v_barber, 'done',
              v_day + time '10:00', v_day + time '10:20', v_day + time '10:22', v_day + time '10:42', 'paid', 'qr');
    end loop;

    -- Tarjeta de fidelidad con sellos = visitas mod 10 (algunas completas)
    insert into loyalty_cards (business_id, customer_id, stamps, status, completed_at)
    values (v_biz, v_cust, case when v_visits >= 10 then 10 else v_visits end,
            (case when v_visits >= 10 then 'completed' else 'active' end)::loyalty_card_status,
            case when v_visits >= 10 then v_last end);
  end loop;
end $$;

-- ============================================================================
-- T-033 · Historial variado para la ficha (REQ-018.2, REQ-018.4): Mateo Londoño (atendido por
-- Juan) también tuvo una barba con Pedro, un "no llegó" y un turno cancelado.
-- ============================================================================
do $$
declare
  v_biz uuid := (select id from businesses where slug = 'la-33');
  v_cust uuid;
  v_last timestamptz;
  v_barba uuid;
  v_corte uuid;
  v_pedro uuid;
  v_juan uuid;
  v_day date;
begin
  select id, last_visit_at into v_cust, v_last from customers where business_id = v_biz and phone_e164 = '+573002000005';
  select id into v_barba from services where business_id = v_biz and name = 'Barba';
  select id into v_corte from services where business_id = v_biz and name = 'Corte';
  select id into v_pedro from barbers where business_id = v_biz and display_name = 'Pedro';
  select id into v_juan from barbers where business_id = v_biz and display_name = 'Juan';

  v_day := (v_last - interval '7 days')::date;
  insert into tickets (business_id, business_day, customer_id, customer_name, customer_phone_e164, service_id,
                       assigned_barber_id, status, created_at, called_at, started_at, finished_at, payment_status, source)
  values (v_biz, v_day, v_cust, 'Mateo Londoño', '+573002000005', v_barba, v_pedro, 'done',
          v_day + time '16:00', v_day + time '16:10', v_day + time '16:12', v_day + time '16:27', 'paid', 'qr');

  v_day := (v_last - interval '10 days')::date;
  insert into tickets (business_id, business_day, customer_id, customer_name, customer_phone_e164, service_id,
                       assigned_barber_id, status, created_at, called_at, finished_at, source)
  values (v_biz, v_day, v_cust, 'Mateo Londoño', '+573002000005', v_corte, v_juan, 'no_show',
          v_day + time '11:00', v_day + time '11:30', v_day + time '11:36', 'qr');

  v_day := (v_last - interval '12 days')::date;
  insert into tickets (business_id, business_day, customer_id, customer_name, customer_phone_e164, service_id,
                       status, created_at, cancel_reason, source)
  values (v_biz, v_day, v_cust, 'Mateo Londoño', '+573002000005', v_corte, 'cancelled',
          v_day + time '09:00', 'customer', 'qr');

  update customers set visits_count = visits_count + 1 where id = v_cust;
end $$;
