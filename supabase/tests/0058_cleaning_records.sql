-- T-101 · Limpieza: registrar apertura, cierre y profunda, y los avisos (REQ-060.4, REQ-060.5,
-- REQ-061, REQ-062, ADR-037, design.md §16.4–§16.5). La hora se fija con `turnos.test_now`, que solo
-- se respeta con la sesión de postgres (las pruebas), nunca desde la app.
begin;
select plan(70);

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

-- Lunes a sábado de 9:00 a. m. a 8:00 p. m.; domingo cerrado
update business_hours set opens_at = '09:00', closes_at = '20:00', is_closed = (weekday = 0)
 where business_id = (select biz from ctx);
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);

create function pg_temp.at(p_ts text) returns void language sql as $$
  select set_config('turnos.test_now', p_ts, true)::text where true
$$;
-- Los puntos actuales de una lista, todos marcados salvo p_undone (con p_note)
create function pg_temp.items(p_kind cleaning_kind, p_undone text default null, p_note text default null)
returns jsonb language sql security definer as $$
  select jsonb_agg(jsonb_build_object('id', id, 'done', label is distinct from p_undone,
                   'note', case when label = p_undone then p_note end) order by sort_order)
  from cleaning_checklist_items where business_id = (select biz from ctx) and kind = p_kind
$$;
create function pg_temp.photos(p_n int) returns text[] language sql as $$
  select coalesce(array_agg((select biz::text from ctx) || '/records/2026-11-10/' || gen_random_uuid() || '.webp'), '{}')
  from generate_series(1, p_n)
$$;
create function pg_temp.submit(p_kind cleaning_kind, p_items jsonb, p_photos text[] default '{}') returns jsonb
language sql as $$
  select submit_cleaning_record((select biz from ctx), p_kind, p_items, p_photos)
$$;
-- detail de la excepción (para "ya la registró <nombre>")
create function _cleaning_err_detail(p_sql text) returns jsonb language plpgsql as $$
declare d text;
begin
  begin
    execute p_sql;
  exception when others or assert_failure then   -- P0004 es assert_failure: others no lo atrapa
    get stacked diagnostics d = pg_exception_detail;
  end;
  return d::jsonb;
end $$;
create function pg_temp.rec(p_kind cleaning_kind, p_day date) returns cleaning_records
language sql security definer as $$
  select * from cleaning_records where business_id = (select biz from ctx) and kind = p_kind and business_day = p_day
$$;

-- --------------------------------------------------------- apagada ----
select pg_temp.at('2026-11-10 09:40-05');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select pg_temp.submit('opening', '[]'::jsonb) $$, 'P0004', 'CLEANING_DISABLED',
  'REQ-060.1 apagada no se registra nada');
select is(cleaning_today((select biz from ctx)), '{"enabled": false}'::jsonb, 'REQ-060.1 apagada no hay avisos');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select cleaning_set_enabled((select biz from ctx), true);
select auth.test_logout();
update businesses set cleaning_enabled_on = '2026-11-02' where id = (select biz from ctx); -- lunes

-- ------------------------------------------------- apertura (martes 10) ----
select auth.test_login((select juan_u from ctx));
select pg_temp.at('2026-11-10 08:50-05');
select ok(not (cleaning_today((select biz from ctx)) ->> 'openingPending')::boolean,
  'REQ-062.1 antes de la hora de apertura no hay aviso');
select pg_temp.at('2026-11-10 09:40-05');
select ok((cleaning_today((select biz from ctx)) ->> 'openingPending')::boolean,
  'REQ-062.1 pasada la hora de apertura sin registrar sale "Apertura pendiente"');
select is(cleaning_today((select biz from ctx)) ->> 'businessDay', '2026-11-10', 'REQ-061.2 el día es el de Bogotá');
select is(jsonb_array_length(cleaning_today((select biz from ctx)) -> 'lists' -> 'opening'), 6,
  'REQ-061.11 el barbero recibe los puntos de la apertura');
select ok(not (cleaning_today((select biz from ctx)) -> 'lists' ? 'betweenClients'),
  'REQ-063.4 el barbero no recibe la lista de la revisión');

select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening', 'Ventilar')) $$, 'P0004', 'NOTE_REQUIRED',
  'REQ-061.3 un punto sin marcar pide nota');
select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening', 'Ventilar', '   ')) $$, 'P0004', 'NOTE_REQUIRED',
  'REQ-061.3 una nota en blanco no vale');
select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening', 'Ventilar', repeat('x', 201))) $$, 'P0004',
  'NOTE_REQUIRED', 'REQ-061.3 la nota tiene hasta 200 caracteres');
select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening') - 0) $$, 'P0004', 'LIST_CHANGED',
  'REQ-060.5 si falta un punto (la lista cambió) no se guarda');
select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening') || pg_temp.items('deep')) $$, 'P0004',
  'LIST_CHANGED', 'REQ-060.5 puntos de otra lista no se aceptan');
select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening'), pg_temp.photos(4)) $$, 'P0004',
  'TOO_MANY_PHOTOS', 'REQ-061.4 la apertura lleva hasta 3 fotos');
select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening'),
                    array[(select biz::text from ctx) || '/inspections/11111111-1111-4111-8111-111111111111.webp']) $$,
  'P0004', 'INVALID_PATH', 'REQ-064.5 las fotos del registro van en su carpeta privada');
select throws_ok($$ select pg_temp.submit('between_clients', pg_temp.items('between_clients')) $$, 'P0004', 'INVALID_KIND',
  'REQ-061.1 entre clientes no se registra');
select is((select count(*)::int from cleaning_records), 0, 'REQ-061.3 los errores no guardan nada');

insert into res values ('open', pg_temp.submit('opening', pg_temp.items('opening', 'Ventilar', 'Llovía'), pg_temp.photos(2)));
select ok(not ((select v from res where k = 'open') ->> 'isComplete')::boolean,
  'REQ-061.3 con un punto sin marcar queda "Incompleto"');
select ok(((select v from res where k = 'open') ->> 'isLate')::boolean,
  'REQ-061.8 registrada 40 minutos después de abrir queda "Tarde"');
select auth.test_logout();

select ok((select barber_id = (select juan from ctx) and done_by = (select juan_u from ctx)
                  and created_at = '2026-11-10 09:40-05' from pg_temp.rec('opening', '2026-11-10')),
  'REQ-061.1 se guarda quién y a qué hora');
select is((select items -> 0 from pg_temp.rec('opening', '2026-11-10')),
  '{"done": false, "label": "Ventilar", "note": "Llovía"}'::jsonb, 'REQ-061.3 el punto sin marcar guarda su nota');
select is((select cardinality(photo_paths) from pg_temp.rec('opening', '2026-11-10')), 2, 'REQ-061.4 guarda las fotos');

select auth.test_login((select owner_u from ctx));
select cleaning_save_list((select biz from ctx), 'opening', (select jsonb_agg(jsonb_build_object('id', id,
  'label', case when label = 'Ventilar' then 'Abrir ventanas' else label end) order by sort_order)
  from cleaning_checklist_items where business_id = (select biz from ctx) and kind = 'opening'));
select auth.test_logout();
select is((select items -> 0 ->> 'label' from pg_temp.rec('opening', '2026-11-10')), 'Ventilar',
  'REQ-060.4 cambiar la lista no cambia los registros anteriores');

select auth.test_login((select pedro_u from ctx));
select throws_ok($$ select pg_temp.submit('opening', pg_temp.items('opening')) $$, 'P0004', 'ALREADY_RECORDED',
  'REQ-061.2 una sola apertura por día');
select is(_cleaning_err_detail($$ select pg_temp.submit('opening', pg_temp.items('opening')) $$) ->> 'doneBy', 'Juan',
  'REQ-061.2 el aviso dice quién la registró');
select is(_cleaning_err_detail($$ select pg_temp.submit('opening', pg_temp.items('opening')) $$) ->> 'at',
  '2026-11-10T09:40:00-05:00', 'REQ-061.2 y a qué hora');
insert into res values ('today_pedro', cleaning_today((select biz from ctx)));
select ok(not ((select v from res where k = 'today_pedro') ->> 'openingPending')::boolean,
  'REQ-062.1 registrada la apertura, el aviso desaparece');
select is((select v from res where k = 'today_pedro') -> 'opening' ->> 'doneBy', 'Juan',
  'REQ-061.11 el barbero ve quién hizo la apertura de hoy');
select ok(((select v from res where k = 'today_pedro') -> 'opening' ->> 'isLate')::boolean
          and not ((select v from res where k = 'today_pedro') -> 'opening' ->> 'isComplete')::boolean,
  'REQ-061.11 y si quedó tarde o incompleta');
select auth.test_logout();

select throws_ok($$ insert into cleaning_records (business_id, kind, business_day, week_start, done_by, is_complete, items)
                    values ((select biz from ctx), 'opening', '2026-11-10', '2026-11-09', (select pedro_u from ctx), true, '[]') $$,
  '23505', null, 'REQ-061.2 dos celulares a la vez: la base no deja dos aperturas');

select auth.test_login((select owner_u from ctx));
select throws_ok($$ update cleaning_records set is_complete = true $$, '42501', null,
  'REQ-061.9 un registro enviado no se edita, ni por el dueño');
select throws_ok($$ delete from cleaning_records $$, '42501', null, 'REQ-061.9 ni se borra');
select auth.test_logout();

-- --------------------------------------------------- cierre (martes 10) ----
select auth.test_login((select juan_u from ctx));
select pg_temp.at('2026-11-10 18:30-05');
select is(cleaning_today((select biz from ctx)) ->> 'closingFrom', '19:00', 'REQ-061.7 el cierre se habilita a las 7:00 p. m.');
select throws_ok($$ select pg_temp.submit('closing', pg_temp.items('closing'), pg_temp.photos(1)) $$, 'P0004',
  'CLOSING_TOO_EARLY', 'REQ-061.7 el barbero no registra el cierre antes de 1 hora antes de cerrar');
select is(_cleaning_err_detail($$ select pg_temp.submit('closing', pg_temp.items('closing'), pg_temp.photos(1)) $$) ->> 'from',
  '19:00', 'REQ-061.7 el error dice desde qué hora');
select pg_temp.at('2026-11-10 19:05-05');
select throws_ok($$ select pg_temp.submit('closing', pg_temp.items('closing')) $$, 'P0004', 'PHOTO_REQUIRED',
  'REQ-061.4 el cierre sin foto no se envía');
select throws_ok($$ select pg_temp.submit('closing', pg_temp.items('closing'), pg_temp.photos(2)) $$, 'P0004', 'PHOTO_REQUIRED',
  'REQ-061.4 el cierre lleva exactamente una foto');
select ok((pg_temp.submit('closing', pg_temp.items('closing'), pg_temp.photos(1)) ->> 'isComplete')::boolean,
  'REQ-061.4 con su foto y todo marcado queda completo');
select ok((pg_temp.submit('deep', pg_temp.items('deep')) ->> 'isComplete')::boolean,
  'REQ-061.4 la profunda puede ir sin fotos');
select auth.test_logout();

-- ----------------------------------------------------- miércoles 11 ----
select auth.test_login((select owner_u from ctx));
select pg_temp.at('2026-11-11 09:10-05');
select ok(not (pg_temp.submit('opening', pg_temp.items('opening')) ->> 'isLate')::boolean,
  'REQ-061.8 diez minutos después de abrir no es tarde');
select pg_temp.at('2026-11-11 10:00-05');
select lives_ok($$ select pg_temp.submit('closing', pg_temp.items('closing'), pg_temp.photos(1)) $$,
  'REQ-061.7 el dueño registra el cierre a cualquier hora');
select is(cleaning_today((select biz from ctx)) -> 'closing' ->> 'doneBy', 'Dueño', 'REQ-061.1 el dueño también registra');
select auth.test_logout();
select ok((select barber_id is null and done_by = (select owner_u from ctx) from pg_temp.rec('closing', '2026-11-11')),
  'REQ-061.1 el registro del dueño queda a su nombre');

select auth.test_login((select pedro_u from ctx));
select throws_ok($$ select pg_temp.submit('deep', pg_temp.items('deep')) $$, 'P0004', 'ALREADY_RECORDED',
  'REQ-061.2 una sola profunda por semana (lunes a domingo)');
select auth.test_logout();

-- ----------------------------------------- medianoche (viernes 13) ----
select auth.test_login((select juan_u from ctx));
select pg_temp.at('2026-11-13 00:10-05');
select is(cleaning_today((select biz from ctx)) ->> 'businessDay', '2026-11-13', 'REQ-061.10 pasada la medianoche el día es otro');
select throws_ok($$ select pg_temp.submit('closing', pg_temp.items('closing'), pg_temp.photos(1)) $$, 'P0004',
  'CLOSING_TOO_EARLY', 'REQ-061.10 el cierre del jueves ya no se registra después de la medianoche');
select auth.test_logout();

-- ------------------------------------------- panel del dueño (viernes 13) ----
select pg_temp.at('2026-11-13 10:00-05');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select cleaning_owner_summary((select biz from ctx)) $$, '42501', 'FORBIDDEN',
  'REQ-062.3 el barbero no ve el panel ni los cierres sin registrar');
select throws_ok($$ select ack_missed_closing((select biz from ctx), '2026-11-12', null) $$, '42501', 'FORBIDDEN',
  'REQ-062.3 el barbero no marca avisos como vistos');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
insert into res values ('sum', cleaning_owner_summary((select biz from ctx)));
select ok(((select v from res where k = 'sum') ->> 'openingPending')::boolean,
  'REQ-062.1 el panel del dueño también muestra la apertura pendiente');
select is((select array_agg(d ->> 'day' order by d ->> 'day') from jsonb_array_elements((select v from res where k = 'sum') -> 'missedClosings') d),
  array['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-09', '2026-11-12'],
  'REQ-062.3 cierres sin registrar de los días que abrió');
select ok(not ((select v from res where k = 'sum') -> 'missedClosings' @> '[{"day": "2026-11-08"}]'),
  'REQ-062.3 el domingo cerrado no cuenta');
select ok(not ((select v from res where k = 'sum') -> 'missedClosings' @> '[{"day": "2026-11-01"}]'),
  'REQ-062.8 antes de encender la limpieza no cuenta');
select is((select v from res where k = 'sum') -> 'flagged' -> 0 ->> 'day', '2026-11-10',
  'REQ-062.5 el panel resalta la apertura incompleta y tarde');
select is((select v from res where k = 'sum') -> 'flagged' -> 0 -> 'notes',
  '[{"label": "Ventilar", "note": "Llovía"}]'::jsonb, 'REQ-062.5 con sus notas');
select is(jsonb_array_length((select v from res where k = 'sum') -> 'flagged'), 1, 'REQ-062.5 lo completo no se resalta');
select ok(not ((select v from res where k = 'sum') ->> 'deepPending')::boolean, 'REQ-062.4 esta semana ya tiene profunda');
select is((select v from res where k = 'sum') -> 'deepMissedWeeks', '["2026-11-02"]'::jsonb,
  'REQ-062.4 la semana pasada quedó "Sin profunda"');

update businesses set queue_override = 'closed', queue_override_day = '2026-11-12' where id = (select biz from ctx);
select ok(not (cleaning_owner_summary((select biz from ctx)) -> 'missedClosings' @> '[{"day": "2026-11-12"}]'),
  'REQ-062.3 un día que el dueño cerró a mano no cuenta');
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);

select throws_ok($$ select ack_missed_closing((select biz from ctx), '2026-11-12', repeat('x', 201)) $$, 'P0004', 'INVALID_NOTE',
  'REQ-062.3 la nota del visto tiene hasta 200 caracteres');
select lives_ok($$ select ack_missed_closing((select biz from ctx), '2026-11-12', 'Se fue la luz') $$,
  'REQ-062.3 el dueño marca el cierre sin registrar como visto');
select ok(not (cleaning_owner_summary((select biz from ctx)) -> 'missedClosings' @> '[{"day": "2026-11-12"}]'),
  'REQ-062.3 visto, el aviso desaparece');
select throws_ok($$ select ack_missed_closing((select biz from ctx), '2026-11-11', null) $$, 'P0004', 'NOT_MISSED',
  'REQ-062.3 un día con cierre no se marca');
select throws_ok($$ select ack_missed_closing((select biz from ctx), '2026-11-08', null) $$, 'P0004', 'NOT_MISSED',
  'REQ-062.3 un día cerrado no se marca');

select pg_temp.at('2026-11-15 10:00-05');
select ok(not (cleaning_owner_summary((select biz from ctx)) ->> 'openingPending')::boolean,
  'REQ-062.1 el domingo cerrado no hay aviso de apertura');
update businesses set queue_override = 'closed', queue_override_day = '2026-11-14' where id = (select biz from ctx);
select pg_temp.at('2026-11-14 10:00-05');
select ok(not (cleaning_owner_summary((select biz from ctx)) ->> 'openingPending')::boolean,
  'REQ-062.1 un día que el dueño cerró a mano no hay aviso de apertura');
update businesses set queue_override = 'auto', queue_override_day = null where id = (select biz from ctx);
select pg_temp.at('2026-11-16 10:00-05');
select ok((cleaning_owner_summary((select biz from ctx)) ->> 'deepPending')::boolean,
  'REQ-062.4 una semana nueva empieza con "Profunda pendiente"');
select auth.test_logout();

-- ------------------------------------------------------ inactivo y apagada ----
update barbers set is_active = false where id = (select pedro from ctx);
select auth.test_login((select pedro_u from ctx));
select throws_ok($$ select cleaning_today((select biz from ctx)) $$, '42501', 'FORBIDDEN',
  'REQ-061.1 un barbero inactivo no registra');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select cleaning_set_enabled((select biz from ctx), false);
select is(cleaning_owner_summary((select biz from ctx)), '{"enabled": false}'::jsonb, 'REQ-060.1 apagada el panel no avisa nada');
select auth.test_logout();

-- ----------------------------------------------------- fuera de TurnOS ----
select ok(not exists (select 1 from pg_enum where enumtypid = 'message_template_key'::regtype and enumlabel like '%clean%'),
  'REQ-062.7 no hay plantillas de WhatsApp de limpieza');
select ok(not exists (select 1 from pg_proc where proname in ('call_next', 'transition_ticket') and prosrc like '%cleaning%'),
  'REQ-062.2 llamar y atender no dependen de la limpieza');
select ok(not has_function_privilege('anon', 'submit_cleaning_record(uuid, cleaning_kind, jsonb, text[])', 'execute')
          and has_function_privilege('authenticated', 'submit_cleaning_record(uuid, cleaning_kind, jsonb, text[])', 'execute')
          and not has_function_privilege('authenticated', 'cleaning_now()', 'execute'),
  'REQ-061.1 registrar pide sesión; la hora de prueba no se toca desde la app');

select * from finish();
rollback;
