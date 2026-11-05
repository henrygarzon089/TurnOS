-- T-100 · Limpieza: datos, activación, listas, RLS y bucket privado (REQ-060.1–060.3, REQ-063.4,
-- REQ-064.5, ADR-037, design.md §16.1–§16.4). Los registros son T-101.
begin;
select plan(46);

create temp table ctx as
select z.id as biz,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       '0000000e-0000-0000-0000-0000000000e1'::uuid as other_u,
       business_day_bogota(now()) as today
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table res (k text primary key, v jsonb);
grant all on res to public;

create function pg_temp.labels(p_kind cleaning_kind) returns text[]
language sql security definer as $$
  select coalesce(array_agg(label order by sort_order), '{}') from cleaning_checklist_items
  where business_id = (select biz from ctx) and kind = p_kind
$$;
create function pg_temp.item_id(p_kind cleaning_kind, p_label text) returns uuid
language sql security definer as $$
  select id from cleaning_checklist_items
  where business_id = (select biz from ctx) and kind = p_kind and label = p_label
$$;
create function pg_temp.obj(p_path text) returns text language sql as $$
  select (select biz::text from ctx) || '/' || p_path
$$;

-- ------------------------------------------------------------------ datos ----
select has_table('cleaning_checklist_items', 'REQ-060.3 cada lista guarda sus puntos');
select has_table('cleaning_records', 'REQ-060.4 los registros guardan su propia copia de los puntos');
select has_table('cleaning_inspections', 'REQ-063.1 las revisiones del dueño se guardan');
select has_table('cleaning_tasks', 'REQ-064.1 hay tareas periódicas');
select enum_has_labels('cleaning_kind', array['opening', 'closing', 'deep', 'between_clients'],
  'REQ-060.2 cuatro listas: apertura, cierre, profunda y entre clientes');
select col_default_is('businesses', 'cleaning_enabled', 'false', 'REQ-060.1 la limpieza nace apagada');
select is((select count(*)::int from cleaning_checklist_items where business_id = (select biz from ctx)), 0,
  'REQ-060.1 apagada no tiene listas');

-- ------------------------------------------------------------ encender ----
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select cleaning_set_enabled((select biz from ctx), true) $$, '42501', 'FORBIDDEN',
  'REQ-060.1 el barbero no enciende la limpieza');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select lives_ok($$ select cleaning_set_enabled((select biz from ctx), true) $$, 'REQ-060.1 el dueño la enciende');
select ok((select cleaning_enabled and cleaning_enabled_on = (select today from ctx) from businesses
           where id = (select biz from ctx)), 'REQ-060.1 queda encendida desde hoy');
select is(cardinality(pg_temp.labels('opening')), 6, 'REQ-060.2 apertura con 6 puntos');
select is(cardinality(pg_temp.labels('closing')), 8, 'REQ-060.2 cierre con 8 puntos (la foto no es casilla)');
select is(cardinality(pg_temp.labels('deep')), 4, 'REQ-060.2 profunda con 4 puntos');
select is(cardinality(pg_temp.labels('between_clients')), 7, 'REQ-060.2 entre clientes con 7 puntos');
select is(pg_temp.labels('opening'), array['Ventilar',
  'Preparar la solución desinfectante del día, marcada con la fecha',
  'Dotación y toallas limpias en cada estación', 'Baño limpio con jabón y toallas',
  'Calentador de toallas encendido', 'Revisar la nevera de bebidas'],
  'REQ-060.2 apertura con los puntos del documento, en orden');
select is((pg_temp.labels('closing'))[1:2], array['Barrer y trapear',
  'Desinfectar todas las herramientas y desechar la solución'], 'REQ-060.2 cierre empieza por barrer');
select is((pg_temp.labels('between_clients'))[3], 'Máquinas con Cool Care', 'REQ-060.2 entre clientes con Cool Care');
select ok(not ('Foto del local limpio' = any(pg_temp.labels('closing'))),
  'REQ-060.2 "Foto del local limpio" es la foto obligatoria, no una casilla');

select lives_ok($$ select cleaning_set_enabled((select biz from ctx), false) $$, 'REQ-060.1 el dueño la apaga');
select ok(not (select cleaning_enabled from businesses where id = (select biz from ctx)), 'REQ-060.1 queda apagada');
update businesses set cleaning_enabled_on = (select today from ctx) - 3 where id = (select biz from ctx);
select lives_ok($$ select cleaning_set_enabled((select biz from ctx), true) $$, 'REQ-060.1 se vuelve a encender');
select is(cardinality(pg_temp.labels('opening')), 6, 'REQ-060.2 volver a encender no duplica las listas');
select is((select cleaning_enabled_on from businesses where id = (select biz from ctx)), (select today from ctx) - 3,
  'REQ-060.1 el primer día encendida no cambia al volver a encender');

-- -------------------------------------------------------- editar listas ----
insert into res values ('save', cleaning_save_list((select biz from ctx), 'deep', jsonb_build_array(
  jsonb_build_object('id', pg_temp.item_id('deep', 'Nevera, plantas y fechas de vencimiento'), 'label', 'Nevera y plantas'),
  jsonb_build_object('id', null, 'label', '  Techo y ventiladores  '),
  jsonb_build_object('id', pg_temp.item_id('deep', 'Sillas a fondo, con mecanismos'), 'label', 'Sillas a fondo, con mecanismos'))));
select is(pg_temp.labels('deep'), array['Nevera y plantas', 'Techo y ventiladores', 'Sillas a fondo, con mecanismos'],
  'REQ-060.3 el dueño renombra, agrega, quita y ordena');
select ok(pg_temp.item_id('deep', 'Nevera y plantas') = ((select v from res where k = 'save') -> 0 ->> 'id')::uuid,
  'REQ-060.3 renombrar conserva el punto');
select is(jsonb_array_length((select v from res where k = 'save')), 3, 'REQ-060.3 devuelve la lista nueva');
select throws_ok($$ select cleaning_save_list((select biz from ctx), 'deep', '[]'::jsonb) $$, 'P0004', 'LIST_EMPTY',
  'REQ-060.3 una lista no puede quedar vacía');
select throws_ok($$ select cleaning_save_list((select biz from ctx), 'deep', jsonb_build_array(
                    jsonb_build_object('id', null, 'label', repeat('a', 81)))) $$, 'P0004', 'INVALID_LABEL',
  'REQ-060.3 un punto tiene hasta 80 caracteres');
select throws_ok($$ select cleaning_save_list((select biz from ctx), 'deep', jsonb_build_array(
                    jsonb_build_object('id', null, 'label', '   '))) $$, 'P0004', 'INVALID_LABEL',
  'REQ-060.3 un punto no puede ir en blanco');
select throws_ok($$ select cleaning_save_list((select biz from ctx), 'deep', jsonb_build_array(
                    jsonb_build_object('id', pg_temp.item_id('opening', 'Ventilar'), 'label', 'Ventilar'))) $$,
  'P0004', 'INVALID_ITEM', 'REQ-060.3 no se mueven puntos de otra lista');
select is(cardinality(pg_temp.labels('deep')), 3, 'REQ-060.3 un error no cambia la lista');
select throws_ok($$ insert into cleaning_checklist_items (business_id, kind, label, sort_order)
                    values ((select biz from ctx), 'deep', 'Directo', 9) $$, '42501', null,
  'REQ-060.3 las listas solo cambian con la función');
select is((select count(*)::int from cleaning_checklist_items), 24, 'REQ-060.3 el dueño ve sus listas');
select auth.test_logout();

-- ---------------------------------------------- RLS: el barbero no ve ----
insert into cleaning_tasks (id, business_id, name, every_days)
values ('77777777-7777-4777-8777-777777777777', (select biz from ctx), 'Botiquín', 30);
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select cleaning_save_list((select biz from ctx), 'deep', jsonb_build_array(
                    jsonb_build_object('id', null, 'label', 'Algo'))) $$, '42501', 'FORBIDDEN',
  'REQ-060.3 el barbero no edita las listas');
select is((select count(*)::int from cleaning_checklist_items) + (select count(*)::int from cleaning_tasks)
          + (select count(*)::int from cleaning_inspections) + (select count(*)::int from cleaning_records), 0,
  'REQ-063.4 el barbero no lee las tablas de limpieza (los puntos le llegan por función)');
select auth.test_logout();
select auth.test_login((select other_u from ctx));
select is((select count(*)::int from cleaning_checklist_items), 0, 'REQ-063.4 otro negocio no ve las listas');
select auth.test_logout();

-- ------------------------------------------------- bucket privado §16.3 ----
select ok((select not public and file_size_limit = 5242880
             and allowed_mime_types @> array['image/webp', 'image/jpeg', 'application/pdf']
           from storage.buckets where id = 'cleaning'),
  'REQ-064.5 bucket cleaning privado, 5 MB, fotos y PDF');
select auth.test_login((select juan_u from ctx));
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('cleaning', %L) $$,
                  pg_temp.obj('records/' || (select today from ctx) || '/11111111-1111-4111-8111-111111111111.webp')),
  'REQ-064.5 el barbero sube la foto de un registro');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('cleaning', %L) $$,
                  pg_temp.obj('inspections/22222222-2222-4222-8222-222222222222.webp')), '42501', null,
  'REQ-063.4 el barbero no sube fotos de revisiones');
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('cleaning', %L) $$,
                  pg_temp.obj('tasks/77777777-7777-4777-8777-777777777777/33333333-3333-4333-8333-333333333333.pdf')),
  '42501', null, 'REQ-064.5 el barbero no sube adjuntos de tareas');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('cleaning', %L) $$,
                  pg_temp.obj('inspections/22222222-2222-4222-8222-222222222222.webp')),
  'REQ-063.2 el dueño sube la foto de una revisión');
select lives_ok(format($$ insert into storage.objects (bucket_id, name) values ('cleaning', %L) $$,
                  pg_temp.obj('tasks/77777777-7777-4777-8777-777777777777/33333333-3333-4333-8333-333333333333.pdf')),
  'REQ-064.3 el dueño sube el PDF de una tarea');
select auth.test_logout();

select auth.test_login((select juan_u from ctx));
select is((select count(*)::int from storage.objects where bucket_id = 'cleaning'), 1,
  'REQ-064.5 el barbero solo abre las fotos de los registros, no las del dueño');
select auth.test_logout();

update barbers set is_active = false where id = (select pedro from ctx);
select auth.test_login((select pedro_u from ctx));
select throws_ok(format($$ insert into storage.objects (bucket_id, name) values ('cleaning', %L) $$,
                  pg_temp.obj('records/' || (select today from ctx) || '/44444444-4444-4444-8444-444444444444.webp')),
  '42501', null, 'REQ-064.5 un barbero inactivo no sube fotos');
select auth.test_logout();

select auth.test_login((select other_u from ctx));
select is((select count(*)::int from storage.objects where bucket_id = 'cleaning'), 0,
  'REQ-064.5 otro negocio no abre las fotos');
select auth.test_logout();

-- ------------------------------------------------------------- permisos ----
select ok(not has_function_privilege('anon', 'cleaning_set_enabled(uuid, boolean)', 'execute')
          and not has_function_privilege('anon', 'cleaning_save_list(uuid, cleaning_kind, jsonb)', 'execute')
          and not has_function_privilege('authenticated', 'cleaning_seed_lists(uuid)', 'execute'),
  'REQ-060.1 sin sesión no se toca la limpieza, y la siembra solo corre por dentro');

select * from finish();
rollback;
