-- T-190 · Borrar un negocio completo (REQ-080.3, REQ-080.4, design.md §23.6).
-- Prueba las funciones de scripts/delete-business.sql: el archivo se incluye con `define_only`,
-- que solo define las funciones (pg_temp) sin correr la simulación ni el borrado. Así se prueba
-- exactamente el mismo código que corre Henry con psql.
begin;
\set define_only 1
\ir ../../scripts/delete-business.sql
\unset define_only
select plan(19);

-- ------------------------------------------------------------------- datos ----
-- Dos negocios nuevos con una fila (o más) en cada tabla con business_id, incluidas las
-- inmutables (ventas, pagos, cierre de caja, movimientos de inventario) y los ciclos de llaves
-- (turno ↔ cita, venta ↔ tarjeta de fidelidad, venta ↔ periodo de membresía).
create function pg_temp.t190_fill(p_biz uuid, p_owner uuid, p_bu uuid, p_n int) returns void
language plpgsql as $$
declare
  v_day date := business_day_bogota(now());
  v_barber uuid; v_service uuid; v_product uuid; v_c1 uuid; v_c2 uuid; v_t1 uuid; v_t2 uuid;
  v_card uuid; v_appt uuid; v_sale uuid; v_sale_gc uuid; v_sale_m uuid; v_gift uuid; v_fam uuid;
  v_period uuid; v_si bigint; v_task uuid; v_inv uuid; v_wh uuid; v_count uuid;
begin
  insert into memberships (user_id, business_id, role) values (p_owner, p_biz, 'owner');
  insert into barbers (business_id, display_name, commission_pct, user_id)
  values (p_biz, 'Barbero ' || p_n, 50, p_bu) returning id into v_barber;
  insert into memberships (user_id, business_id, role, barber_id) values (p_bu, p_biz, 'barber', v_barber);
  insert into services (business_id, name, duration_min, price) values (p_biz, 'Corte', 30, 30000)
  returning id into v_service;
  insert into products (business_id, name, price) values (p_biz, 'Gaseosa', 5000) returning id into v_product;
  insert into business_hours (business_id, weekday, is_closed) values (p_biz, 1, true);
  insert into business_pct_changes (business_id, kind, new_pct) values (p_biz, 'staff_discount', 10);
  insert into commission_changes (business_id, barber_id, new_pct) values (p_biz, v_barber, 55);
  insert into invitations (business_id, barber_id) values (p_biz, v_barber);
  insert into privacy_policy_versions (business_id, version, body) values (p_biz, 1, 'Política');
  insert into loyalty_programs (business_id) values (p_biz) on conflict do nothing;
  insert into membership_plans (business_id) values (p_biz) on conflict do nothing;
  insert into barber_photos (business_id, barber_id, path)
  values (p_biz, v_barber, p_biz || '/barbers/' || v_barber || '/' || gen_random_uuid() || '.webp');

  insert into customers (business_id, phone_e164, name, preferred_barber_id)
  values (p_biz, format('+5731%s0000001', p_n), 'Cliente uno', v_barber) returning id into v_c1;
  insert into customers (business_id, phone_e164, name, referred_by)
  values (p_biz, format('+5731%s0000002', p_n), 'Cliente dos', v_c1) returning id into v_c2;
  insert into reminders (business_id, customer_id) values (p_biz, v_c2);
  insert into loyalty_cards (business_id, customer_id) values (p_biz, v_c1) returning id into v_card;

  insert into tickets (business_id, customer_name, service_id, customer_id, assigned_barber_id,
                       courtesy_product_id, status)
  values (p_biz, 'Cliente uno', v_service, v_c1, v_barber, v_product, 'done') returning id into v_t1;
  insert into ticket_notifications (business_id, ticket_id, kind, status) values (p_biz, v_t1, 'called', 'sent');
  insert into loyalty_stamps (business_id, card_id, ticket_id) values (p_biz, v_card, v_t1);

  -- cita llegada: turno ↔ cita
  insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name,
                            service_duration_min, service_price, barber_id, starts_at, ends_at,
                            business_day, source, customer_id, status)
  values (p_biz, 'Cliente dos', format('+5731%s0000002', p_n), v_service, 'Corte', 30, 30000, v_barber,
          now(), now() + interval '30 minutes', v_day, 'owner', v_c2, 'arrived') returning id into v_appt;
  insert into tickets (business_id, customer_name, service_id, customer_id, assigned_barber_id, appointment_id)
  values (p_biz, 'Cliente dos', v_service, v_c2, v_barber, v_appt) returning id into v_t2;
  update appointments set ticket_id = v_t2 where id = v_appt;

  -- venta de una tarjeta de regalo
  insert into sales (business_id, business_day, services_total, products_total, gift_card_total, total, customer_id)
  values (p_biz, v_day, 0, 0, 50000, 50000, v_c1) returning id into v_sale_gc;
  insert into sale_items (business_id, sale_id, kind, name, qty, unit_price, line_total)
  values (p_biz, v_sale_gc, 'gift_card', 'Tarjeta de regalo', 1, 50000, 50000);
  insert into sale_payments (business_id, sale_id, method, amount) values (p_biz, v_sale_gc, 'cash', 50000);
  insert into gift_cards (business_id, code, sale_id, buyer_customer_id, amount, sold_on, expires_on)
  values (p_biz, 'ABCDEFG' || p_n, v_sale_gc, v_c1, 50000, v_day, (v_day + interval '1 year')::date)
  returning id into v_gift;

  -- corte con premio de fidelidad y pago parcial con la tarjeta de regalo: venta ↔ tarjeta
  insert into sales (business_id, business_day, ticket_id, barber_id, customer_id, services_total,
                     products_total, total, commission_pct, commission_base, commission_amount,
                     business_amount, loyalty_card_id)
  values (p_biz, v_day, v_t1, v_barber, v_c1, 30000, 5000, 35000, 50, 30000, 15000, 15000, v_card)
  returning id into v_sale;
  update loyalty_cards set redeemed_sale_id = v_sale, status = 'redeemed', redeemed_at = now() where id = v_card;
  insert into sale_items (business_id, sale_id, kind, name, qty, unit_price, line_total)
  values (p_biz, v_sale, 'service', 'Corte', 1, 30000, 30000);
  insert into sale_items (business_id, sale_id, kind, name, qty, unit_price, line_total)
  values (p_biz, v_sale, 'product', 'Gaseosa', 1, 5000, 5000) returning id into v_si;
  insert into sale_payments (business_id, sale_id, method, amount) values (p_biz, v_sale, 'cash', 25000);
  insert into sale_payments (business_id, sale_id, method, amount, gift_card_id)
  values (p_biz, v_sale, 'gift_card', 10000, v_gift);

  -- membresía familiar con su cuota: venta ↔ periodo
  insert into family_memberships (business_id, holder_customer_id) values (p_biz, v_c1) returning id into v_fam;
  insert into membership_members (business_id, membership_id, customer_id) values (p_biz, v_fam, v_c2);
  insert into sales (business_id, business_day, services_total, products_total, membership_total, total, customer_id)
  values (p_biz, v_day, 0, 0, 60000, 60000, v_c1) returning id into v_sale_m;
  insert into membership_periods (business_id, membership_id, sale_id, starts_on, ends_on, cuts_total, price, discount_pct)
  values (p_biz, v_fam, v_sale_m, v_day, v_day + 29, 4, 60000, 10) returning id into v_period;
  insert into sale_items (business_id, sale_id, kind, name, qty, unit_price, line_total, membership_period_id)
  values (p_biz, v_sale_m, 'membership', 'Membresía', 1, 60000, 60000, v_period);
  insert into sale_payments (business_id, sale_id, method, amount) values (p_biz, v_sale_m, 'nequi', 60000);

  -- limpieza
  insert into cleaning_checklist_items (business_id, kind, label, sort_order) values (p_biz, 'opening', 'Barrer', 1);
  insert into cleaning_records (business_id, kind, business_day, week_start, done_by, is_complete, items)
  values (p_biz, 'opening', v_day, date_trunc('week', v_day)::date, p_owner, true, '[]');
  insert into cleaning_inspections (business_id, done_by, items) values (p_biz, p_owner, '[]');
  insert into cleaning_missed_acks (business_id, business_day, acked_by) values (p_biz, v_day, p_owner);
  insert into cleaning_tasks (business_id, name, every_days) values (p_biz, 'Fumigar', 30) returning id into v_task;
  insert into cleaning_task_runs (business_id, task_id, done_on, created_by) values (p_biz, v_task, v_day - 1, p_owner);

  -- inventario (sus llaves son `no action`: no les llega la cascada desde businesses)
  select id into v_wh from inventory_locations where business_id = p_biz and kind = 'warehouse';
  insert into inventory_items (business_id, name, "group", use, presentation, unit_label)
  values (p_biz, 'Cera', 'finishing', 'internal', 'Frasco', 'frasco') returning id into v_inv;
  insert into inventory_usage (business_id, item_id, service_id) values (p_biz, v_inv, v_service);
  insert into stock_counts (business_id, location_id, kind) values (p_biz, v_wh, 'initial') returning id into v_count;
  insert into stock_count_lines (business_id, count_id, item_id, system_qty, counted_qty, difference)
  values (p_biz, v_count, v_inv, 0, 5, 5);
  insert into stock_movements (business_id, item_id, kind, qty, to_location_id) values (p_biz, v_inv, 'purchase', 10, v_wh);
  insert into stock_movements (business_id, item_id, kind, qty, to_location_id, count_id)
  values (p_biz, v_inv, 'adjustment', 1, v_wh, v_count);
  insert into stock_movements (business_id, item_id, kind, qty, from_location_id, sale_id, sale_item_id, ticket_id)
  values (p_biz, v_inv, 'sale', 1, v_wh, v_sale, v_si, v_t1);

  -- el día queda cerrado (cierre inmutable)
  insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
  values (p_biz, v_day, '{}', 75000, 75000, 0, p_owner);

  -- archivos del negocio en Storage
  insert into storage.objects (bucket_id, name) values
    ('media', p_biz || '/products/' || gen_random_uuid() || '.webp'),
    ('cleaning', p_biz || '/records/' || v_day || '/' || gen_random_uuid() || '.webp');
end $$;

insert into auth.users (id, email) values
  ('d1900000-0000-4000-8000-000000000001', 'dueno-a@t190.test'),
  ('d1900000-0000-4000-8000-000000000002', 'barbero-a@t190.test'),
  ('d1900000-0000-4000-8000-000000000003', 'barbero-ambos@t190.test'),
  ('d1900000-0000-4000-8000-000000000004', 'dueno-b@t190.test');
insert into businesses (name, slug) values ('Negocio a borrar', 'borrar-t190'), ('Negocio que queda', 'queda-t190');

create temp table ctx as
select (select id from businesses where slug = 'borrar-t190') as a,
       (select id from businesses where slug = 'queda-t190') as b;

-- A: dueño solo de A y el barbero que también trabaja en B; más un barbero solo de A
select pg_temp.t190_fill((select a from ctx), 'd1900000-0000-4000-8000-000000000001',
                         'd1900000-0000-4000-8000-000000000003', 2);
select pg_temp.t190_fill((select b from ctx), 'd1900000-0000-4000-8000-000000000004',
                         'd1900000-0000-4000-8000-000000000003', 3);
with b as (
  insert into barbers (business_id, display_name, commission_pct, user_id)
  select a, 'Barbero solo A', 50, 'd1900000-0000-4000-8000-000000000002' from ctx returning business_id, id
)
insert into memberships (user_id, business_id, role, barber_id)
select 'd1900000-0000-4000-8000-000000000002', business_id, 'barber', id from b;

-- Las revisiones diferidas (pagos = total de la venta) corren ya, como al confirmar la
-- transacción en la app; así el borrado empieza sin eventos pendientes, igual que en producción.
set constraints all immediate;

-- Foto de lo que no se debe tocar: el negocio B y La 33 (seed), tabla por tabla. La línea de
-- cuentas se deja fuera: la cuenta compartida pasa a "se borraría con B" cuando A ya no existe.
create temp table antes as
select z.slug, c.tabla, c.filas
from businesses z, pg_temp.tb_business_counts(z.id) c
where z.slug <> 'borrar-t190' and c.tabla not like 'auth.users%';
create temp table cuentas_antes as select count(*) as n from auth.users;
create temp table disparadores_antes as
select tgrelid::regclass::text as tabla, tgname, tgenabled from pg_trigger where not tgisinternal;

-- ------------------------------------------------------- conteos (REQ-080.4) ----
select is(
  (select count(*)::int from pg_temp.tb_business_counts((select a from ctx))),
  (select count(*)::int + 2 from information_schema.columns c
   join information_schema.tables t using (table_schema, table_name)
   where c.column_name = 'business_id' and t.table_type = 'BASE TABLE'
     and c.table_schema not in ('pg_catalog', 'information_schema')),
  'REQ-080.4 el conteo cubre todas las tablas con business_id (del catálogo), el negocio y las cuentas');
select is(
  (select array_agg(tabla order by tabla) from pg_temp.tb_business_counts((select a from ctx)) where filas = 0),
  null,
  'REQ-080.4 el negocio de prueba tiene filas en cada tabla (la prueba no deja tablas sin cubrir)');
select is(
  (select filas from pg_temp.tb_business_counts((select a from ctx)) where tabla = 'tickets'),
  (select count(*) from tickets where business_id = (select a from ctx)),
  'REQ-080.4 el conteo por tabla es el número real de filas del negocio');
select is(
  (select filas from pg_temp.tb_business_counts((select a from ctx)) where tabla like 'auth.users%'),
  2::bigint,
  'REQ-080.4 el conteo dice cuántas cuentas del personal se borrarían (sin las que tienen otro negocio)');
select is(
  (select array_agg(email order by email) from pg_temp.tb_staff_accounts((select a from ctx)) where not se_borra),
  array['barbero-ambos@t190.test'],
  'REQ-080.4 la cuenta con membresía en otro negocio aparece como que se conserva');
select is(
  (select array_agg(tabla::text order by tabla::text) from pg_temp.tb_business_tables() where not en_cascada),
  array['inventory_usage', 'stock_count_lines', 'stock_counts', 'stock_movements'],
  'REQ-080.3 las tablas a las que no llega ningún on delete cascade desde businesses se detectan del catálogo');

-- --------------------------------------------- sin confirmación no se borra (REQ-080.4) ----
select throws_ok($$ select * from pg_temp.tb_delete_business('borrar-t190', '') $$,
  'P0001', 'Sin confirmación: confirm debe ser exactamente "borrar-t190". No se borró nada.',
  'REQ-080.4 sin confirmación no se borra nada');
select throws_ok($$ select * from pg_temp.tb_delete_business('borrar-t190', 'Borrar-T190') $$,
  'P0001', 'Sin confirmación: confirm debe ser exactamente "borrar-t190". No se borró nada.',
  'REQ-080.4 la confirmación debe ser el slug exacto (mayúsculas no sirven)');
select throws_ok($$ select * from pg_temp.tb_delete_business('borrar-t190', null) $$,
  'P0001', 'Sin confirmación: confirm debe ser exactamente "borrar-t190". No se borró nada.',
  'REQ-080.4 sin la variable confirm tampoco');
select throws_ok($$ select * from pg_temp.tb_delete_business('no-existe-t190', 'no-existe-t190') $$,
  'P0001', 'No existe un negocio con el enlace "no-existe-t190". No se borró nada.',
  'REQ-080.3 con un slug que no existe, error claro');
select is(
  (select count(*)::int from pg_temp.tb_business_counts((select a from ctx)) where filas = 0),
  0,
  'REQ-080.4 después de los intentos sin confirmación el negocio sigue completo');

-- ---------------------------------------------------------- borrado (REQ-080.3) ----
select lives_ok($$ select * from pg_temp.tb_delete_business('borrar-t190', 'borrar-t190') $$,
  'REQ-080.3 con la confirmación exacta borra el negocio, aunque tenga ventas, cierre de caja e inventario');
select is(
  (select array_agg(tabla order by tabla) from pg_temp.tb_business_counts((select a from ctx)) where filas > 0),
  null,
  'REQ-080.3 no queda ni una fila del negocio borrado en ninguna tabla');
select is(
  (select count(*)::int from antes x
   full join (select z.slug, c.tabla, c.filas from businesses z, pg_temp.tb_business_counts(z.id) c
              where z.slug <> 'borrar-t190' and c.tabla not like 'auth.users%') y using (slug, tabla)
   where x.filas is distinct from y.filas),
  0,
  'REQ-080.3 el otro negocio y La 33 quedan intactos, tabla por tabla');
select is(
  (select array_agg(email order by email) from auth.users where email like '%@t190.test'),
  array['barbero-ambos@t190.test', 'dueno-b@t190.test'],
  'REQ-080.3 se borran las cuentas del personal que no tienen otro negocio y se conservan las demás');
select is((select count(*) from auth.users), (select n - 2 from cuentas_antes),
  'REQ-080.3 no se borra ninguna otra cuenta');
select is(
  (select count(*)::int from memberships
   where user_id = 'd1900000-0000-4000-8000-000000000003' and business_id = (select b from ctx)),
  1,
  'REQ-080.3 la cuenta que se conserva sigue con su membresía en el otro negocio');
select is(
  (select count(*)::int from disparadores_antes x
   left join pg_trigger t on t.tgname = x.tgname and t.tgrelid::regclass::text = x.tabla
   where t.tgenabled is distinct from x.tgenabled),
  0,
  'REQ-080.3 los disparadores (guardas de inmutabilidad incluidas) quedan encendidos como estaban');
select is(
  (select array_agg(bucket order by bucket) from pg_temp.tb_storage_objects((select a from ctx))),
  array['cleaning', 'media'],
  'REQ-080.3 se listan los archivos del negocio en media y cleaning para borrarlos desde el panel');

select * from finish();
rollback;
