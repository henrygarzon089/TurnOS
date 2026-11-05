-- T-102 · Limpieza: revisión del dueño, historial, tareas periódicas y purga de fotos (REQ-063,
-- REQ-064.1/064.2/064.4/064.6, ADR-037, design.md §16.3–§16.4). La hora se fija con `turnos.test_now`.
begin;
select plan(65);

create temp table ctx as
select z.id as biz,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
create temp table res (k text primary key, v jsonb);
grant all on res to public;

update business_hours set opens_at = '09:00', closes_at = '20:00', is_closed = (weekday = 0)
 where business_id = (select biz from ctx);
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);

create function pg_temp.at(p_ts text) returns void language sql as $$
  select set_config('turnos.test_now', p_ts, true)
$$;
create function pg_temp.items(p_kind cleaning_kind, p_undone text default null) returns jsonb
language sql security definer as $$
  select jsonb_agg(jsonb_build_object('id', id, 'done', label is distinct from p_undone,
                   'note', case when label = p_undone then 'No alcanzó' end) order by sort_order)
  from cleaning_checklist_items where business_id = (select biz from ctx) and kind = p_kind
$$;
create function pg_temp.photo(p_folder text) returns text language sql as $$
  select (select biz::text from ctx) || '/' || p_folder || '/' || gen_random_uuid() || '.webp'
$$;
-- Revisión: todo "Bien" salvo los puntos de p_fail, que van como falla con su barbero (o general)
create function pg_temp.review(p_fail jsonb default '{}'::jsonb) returns jsonb
language sql security definer as $$
  select jsonb_agg(jsonb_build_object('id', id, 'ok', not (p_fail ? label),
                   'note', case when p_fail ? label then 'Mal' end,
                   'photoPath', case when p_fail ? label then pg_temp.photo('inspections') end,
                   'barberId', nullif(p_fail ->> label, '')) order by kind, sort_order)
  from cleaning_checklist_items where business_id = (select biz from ctx) and kind in ('closing', 'between_clients')
$$;
create function pg_temp.inspect(p_items jsonb) returns jsonb language sql as $$
  select submit_cleaning_inspection((select biz from ctx), p_items)
$$;

select auth.test_login((select owner_u from ctx));
select cleaning_set_enabled((select biz from ctx), true);
select auth.test_logout();
update businesses set cleaning_enabled_on = '2026-11-02' where id = (select biz from ctx); -- lunes

-- Martes 10: Juan abre a tiempo y cierra incompleto; Pedro hace la profunda
select auth.test_login((select juan_u from ctx));
select pg_temp.at('2026-11-10 09:20-05');
insert into res values ('open10', submit_cleaning_record((select biz from ctx), 'opening', pg_temp.items('opening'), '{}'));
select pg_temp.at('2026-11-10 19:05-05');
insert into res values ('close10', submit_cleaning_record((select biz from ctx), 'closing',
  pg_temp.items('closing', 'Baño completo'), array[pg_temp.photo('records/2026-11-10')]));
select auth.test_logout();
select auth.test_login((select pedro_u from ctx));
select submit_cleaning_record((select biz from ctx), 'deep', pg_temp.items('deep'), '{}');
select auth.test_logout();

-- --------------------------------------------------------- revisión ----
select pg_temp.at('2026-11-11 15:00-05');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select pg_temp.inspect(pg_temp.review()) $$, '42501', 'FORBIDDEN', 'REQ-063.4 el barbero no hace revisiones');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select throws_ok($$ select pg_temp.inspect(pg_temp.review() - 0) $$, 'P0004', 'LIST_CHANGED',
  'REQ-063.1 la revisión lleva todo el cierre y entre clientes');
select throws_ok($$ select pg_temp.inspect(jsonb_set(pg_temp.review(), '{0,ok}', 'null')) $$, 'P0004', 'INSPECTION_INCOMPLETE',
  'REQ-063.2 sin calificar todos los puntos no se envía');
select throws_ok($$ select pg_temp.inspect(pg_temp.review(jsonb_build_object('Barrer y trapear', gen_random_uuid()))) $$,
  'P0004', 'INVALID_BARBER', 'REQ-063.3 la falla se asigna a un barbero del negocio');
select throws_ok($$ select pg_temp.inspect(jsonb_set(pg_temp.review(), '{0,barberId}', to_jsonb((select juan from ctx)))) $$,
  'P0004', 'INVALID_BARBER', 'REQ-063.3 solo una falla se asigna a un barbero');
select throws_ok($$ select pg_temp.inspect(jsonb_set(pg_temp.review(jsonb_build_object('Barrer y trapear', '')), '{0,photoPath}',
                    to_jsonb(pg_temp.photo('records/2026-11-11')))) $$, 'P0004', 'INVALID_PATH',
  'REQ-063.2 la foto de la revisión va en su carpeta privada');
select throws_ok($$ select pg_temp.inspect(jsonb_set(pg_temp.review(), '{0,note}', to_jsonb(repeat('x', 201)))) $$,
  'P0004', 'INVALID_NOTE', 'REQ-063.2 la nota tiene hasta 200 caracteres');

insert into res values ('insp', pg_temp.inspect(pg_temp.review(jsonb_build_object(
  'Barrer y trapear', (select pedro from ctx), 'Cuchilla nueva', ''))));
select is(((select v from res where k = 'insp') ->> 'failures')::int, 2, 'REQ-063.2 cada punto queda Bien o Falla');
select lives_ok($$ select pg_temp.inspect(pg_temp.review()) $$, 'REQ-063.1 el dueño revisa varias veces el mismo día');
select is((select count(*)::int from cleaning_inspections), 2, 'REQ-063.1 quedan las dos revisiones');

create temp table insp as select * from cleaning_inspections where id = ((select v from res where k = 'insp') ->> 'id')::uuid;
select is((select count(*)::int from insp, jsonb_array_elements(items) i where i ->> 'group' = 'between_clients'), 7,
  'REQ-063.1 incluye "Estaciones entre clientes" con sus 7 puntos');
select is((select i ->> 'barberId' from insp, jsonb_array_elements(items) i where i ->> 'label' = 'Barrer y trapear'),
  (select pedro::text from ctx), 'REQ-063.3 la falla queda asignada a Pedro');
select ok((select i -> 'barberId' = 'null'::jsonb and not (i ->> 'ok')::boolean from insp, jsonb_array_elements(items) i
           where i ->> 'label' = 'Cuchilla nueva'), 'REQ-063.3 una falla sin barbero es general');
select ok((select i ->> 'photoPath' is not null and i ->> 'note' = 'Mal' from insp, jsonb_array_elements(items) i
           where i ->> 'label' = 'Barrer y trapear'), 'REQ-063.2 la falla guarda nota y foto');
select is((select created_at from insp), '2026-11-11 15:00-05'::timestamptz, 'REQ-063.6 se guarda a qué hora');
select auth.test_logout();

-- --------------------------------------------------------- historial ----
select pg_temp.at('2026-11-13 10:00-05');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select cleaning_history((select biz from ctx)) $$, '42501', 'FORBIDDEN', 'REQ-063.4 el barbero no ve el historial');
select throws_ok($$ select cleaning_inspection_detail(((select v from res where k = 'insp') ->> 'id')::uuid) $$,
  '42501', 'FORBIDDEN', 'REQ-063.4 ni las revisiones');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
insert into res values ('hist', cleaning_history((select biz from ctx)));
create temp table wk as
select w ->> 'weekStart' as week, w from jsonb_array_elements((select v from res where k = 'hist')) w;
create temp table bw as
select week, b ->> 'name' as name, b from wk, jsonb_array_elements(w -> 'barbers') b;
select is((select count(*)::int from wk), 8, 'REQ-063.5 por defecto, las últimas 8 semanas');
select is((select week from wk limit 1), '2026-11-09', 'REQ-063.5 de la más nueva a la más vieja, de lunes a domingo');
select ok((select (w ->> 'deepDone')::boolean from wk where week = '2026-11-09'), 'REQ-063.5 la semana dice si hubo profunda');
select ok(not (select (w ->> 'deepDone')::boolean from wk where week = '2026-11-02'), 'REQ-063.5 y si no hubo');
select is((select (w ->> 'missedClosings')::int from wk where week = '2026-11-09'), 3,
  'REQ-063.5 cierres sin registrar de la semana (lunes, miércoles y jueves)');
select is((select (w ->> 'missedClosings')::int from wk where week = '2026-11-02'), 6, 'REQ-063.5 la semana pasada, lunes a sábado');
select is((select (w ->> 'missedClosings')::int from wk where week = '2026-10-26'), 0, 'REQ-062.8 antes de encender no cuenta');
select is((select (w ->> 'inspections')::int from wk where week = '2026-11-09'), 2, 'REQ-063.5 revisiones de la semana');
select is((select b - 'barberId' - 'name' from bw where week = '2026-11-09' and name = 'Juan'),
  '{"complete": 1, "incomplete": 1, "late": 0, "failures": 0}'::jsonb, 'REQ-063.5 por barbero: completos, incompletos, tarde y fallas');
select is((select (b ->> 'failures')::int from bw where week = '2026-11-09' and name = 'Pedro'), 1,
  'REQ-063.5 la falla asignada sale en el historial de Pedro');
select is((select (w ->> 'generalFailures')::int from wk where week = '2026-11-09'), 1, 'REQ-063.5 las fallas generales aparte');
select ok((select bool_and(array(select jsonb_object_keys(b) order by 1) = array['barberId', 'complete', 'failures', 'incomplete', 'late', 'name'])
           from bw), 'REQ-063.7 sin niveles ni puntajes: solo los conteos');
select is(jsonb_array_length((select w -> 'entries' from wk where week = '2026-11-09')), 5,
  'REQ-063.6 la semana lista sus registros y revisiones para abrirlos');
select is(jsonb_array_length(cleaning_history((select biz from ctx), 2)), 2, 'REQ-063.5 se pueden pedir otras semanas');
select throws_ok($$ select cleaning_history((select biz from ctx), 0) $$, 'P0004', 'INVALID_WEEKS', 'REQ-063.5 al menos una semana');

-- --------------------------------------------------------- detalles ----
insert into res values ('d_close', cleaning_record_detail(((select v from res where k = 'close10') ->> 'id')::uuid));
select is((select v from res where k = 'd_close') ->> 'doneBy', 'Juan', 'REQ-063.6 el registro dice quién');
select is((select v from res where k = 'd_close') ->> 'at', '2026-11-10T19:05:00-05:00', 'REQ-063.6 y a qué hora');
select ok((select v from res where k = 'd_close') -> 'items' @> '[{"label": "Baño completo", "done": false, "note": "No alcanzó"}]',
  'REQ-063.6 con sus puntos y notas');
select is(jsonb_array_length((select v from res where k = 'd_close') -> 'photos'), 1, 'REQ-063.6 y su foto');
select ok(not ((select v from res where k = 'd_close') ->> 'photosPurged')::boolean, 'REQ-064.6 antes de 90 días la foto sigue');

-- --------------------------------------------------- tareas periódicas ----
select auth.test_logout();
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select save_cleaning_task((select biz from ctx), null, 'Botiquín', 30, true) $$, '42501', 'FORBIDDEN',
  'REQ-064.1 el barbero no maneja tareas periódicas');
select auth.test_logout();
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select save_cleaning_task((select biz from ctx), null, '  ', 30, true) $$, 'P0004', 'INVALID_NAME',
  'REQ-064.1 la tarea lleva nombre');
select throws_ok($$ select save_cleaning_task((select biz from ctx), null, 'Botiquín', 0, true) $$, 'P0004', 'INVALID_FREQUENCY',
  'REQ-064.1 la frecuencia es de al menos un día');
select throws_ok($$ select save_cleaning_task((select biz from ctx), null, 'Botiquín', 731, true) $$, 'P0004', 'INVALID_FREQUENCY',
  'REQ-064.1 y de hasta 730');
create temp table tk (k text primary key, id uuid);
grant all on tk to public;
insert into tk values ('botiquin', save_cleaning_task((select biz from ctx), null, 'Botiquín', 30, true)),
                      ('aire', save_cleaning_task((select biz from ctx), null, 'Aire acondicionado', 10, true)),
                      ('plagas', save_cleaning_task((select biz from ctx), null, 'Control de plagas', 180, true)),
                      ('vieja', save_cleaning_task((select biz from ctx), null, 'Vieja', 5, true));
select lives_ok($$ select save_cleaning_task((select biz from ctx), (select id from tk where k = 'vieja'), 'Vieja', 5, false) $$,
  'REQ-064.1 el dueño desactiva una tarea');

select throws_ok($$ select record_cleaning_task_run((select biz from ctx), (select id from tk where k = 'botiquin'), '2026-11-14', null, null) $$,
  'P0004', 'INVALID_DATE', 'REQ-064.2 la fecha es hoy o anterior');
select throws_ok($$ select record_cleaning_task_run((select biz from ctx), (select id from tk where k = 'botiquin'), '2026-11-12', null,
                    (select biz::text from ctx) || '/tasks/' || (select id from tk where k = 'aire') || '/11111111-1111-4111-8111-111111111111.pdf') $$,
  'P0004', 'INVALID_PATH', 'REQ-064.3 el adjunto va en la carpeta de su tarea');
select lives_ok($$ select record_cleaning_task_run((select biz from ctx), (select id from tk where k = 'botiquin'), '2026-10-01', 'Primera', null) $$,
  'REQ-064.2 se registra con una fecha anterior');
select lives_ok($$ select record_cleaning_task_run((select biz from ctx), (select id from tk where k = 'botiquin'), '2026-11-12', 'Repuesto',
                   (select biz::text from ctx) || '/tasks/' || (select id from tk where k = 'botiquin') || '/11111111-1111-4111-8111-111111111111.pdf') $$,
  'REQ-064.3 con un PDF adjunto');
select record_cleaning_task_run((select biz from ctx), (select id from tk where k = 'aire'), '2026-11-05', null, null);

create temp table tl as select t ->> 'name' as name, t from jsonb_array_elements(cleaning_tasks_list((select biz from ctx))) t;
select is((select jsonb_array_length(t -> 'runs') from tl where name = 'Botiquín'), 2, 'REQ-064.2 cada vez queda en el historial');
select is((select t ->> 'lastDone' from tl where name = 'Botiquín'), '2026-11-12', 'REQ-064.4 la última vez es la más reciente');
select is((select t ->> 'nextDue' from tl where name = 'Botiquín'), '2026-12-12', 'REQ-064.4 vence la última vez + la frecuencia');
select is((select t ->> 'status' from tl where name = 'Botiquín'), 'ok', 'REQ-064.4 al día');
select is((select t ->> 'status' from tl where name = 'Aire acondicionado'), 'soon', 'REQ-064.4 vence en los próximos 7 días');
select is((select t ->> 'status' from tl where name = 'Control de plagas'), 'overdue', 'REQ-064.4 sin registros está vencida');

select is((select array_agg(d ->> 'name' order by d ->> 'name') from jsonb_array_elements(cleaning_owner_summary((select biz from ctx)) -> 'tasksDue') d),
  array['Aire acondicionado', 'Control de plagas'], 'REQ-064.4 el panel muestra las vencidas y por vencer (no las inactivas)');

-- --------------------------------------------------- 90 días después ----
select pg_temp.at('2027-02-10 10:00-05');
insert into res values ('d_old', cleaning_record_detail(((select v from res where k = 'close10') ->> 'id')::uuid));
select ok(((select v from res where k = 'd_old') ->> 'photosPurged')::boolean
          and (select v from res where k = 'd_old') -> 'photos' = '[]'::jsonb,
  'REQ-064.6 a los 90 días la foto ya no se muestra');
select is(jsonb_array_length((select v from res where k = 'd_old') -> 'items'), 8, 'REQ-064.6 el registro y sus notas se conservan');
select ok(not exists (select 1 from jsonb_array_elements(cleaning_inspection_detail(((select v from res where k = 'insp') ->> 'id')::uuid) -> 'items') i
                      where i ->> 'photoPath' is not null), 'REQ-064.6 las fotos de la revisión tampoco');
select auth.test_logout();

select ok(not has_function_privilege('authenticated', 'cleaning_photos_to_purge(uuid, integer)', 'execute')
          and has_function_privilege('service_role', 'cleaning_photos_to_purge(uuid, integer)', 'execute'),
  'REQ-064.6 la purga corre solo desde el servidor');
set local role service_role;
select ok(cleaning_purge_claim((select biz from ctx)), 'REQ-064.6 la purga corre una vez al día');
select ok(not cleaning_purge_claim((select biz from ctx)), 'REQ-064.6 y no dos veces el mismo día');
insert into res values ('purge', cleaning_photos_to_purge((select biz from ctx), 200));
select is(jsonb_array_length((select v from res where k = 'purge') -> 'records'), 1, 'REQ-064.6 el cierre de hace más de 90 días se purga');
select is(jsonb_array_length((select v from res where k = 'purge') -> 'inspections'), 1, 'REQ-064.6 y la revisión con foto');
select mark_cleaning_photos_purged((select biz from ctx),
  array(select (r ->> 'id')::uuid from jsonb_array_elements((select v from res where k = 'purge') -> 'records') r),
  array(select (r ->> 'id')::uuid from jsonb_array_elements((select v from res where k = 'purge') -> 'inspections') r));
select is(cleaning_photos_to_purge((select biz from ctx), 200), '{"records": [], "inspections": []}'::jsonb,
  'REQ-064.6 lo purgado no vuelve a salir');
reset role;
select ok((select photos_purged_at is not null and photo_paths = '{}' from cleaning_records
           where id = ((select v from res where k = 'close10') ->> 'id')::uuid), 'REQ-064.6 el registro queda sin rutas');
select is((select count(*)::int from cleaning_task_runs where attachment_path is not null), 1,
  'REQ-064.6 los adjuntos de las tareas no se borran');
select pg_temp.at('2027-02-11 10:00-05');
set local role service_role;
select ok(cleaning_purge_claim((select biz from ctx)), 'REQ-064.6 al día siguiente vuelve a correr');
reset role;

select * from finish();
rollback;
