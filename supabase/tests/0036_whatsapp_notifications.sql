-- T-064 · Datos del Hito 6, aviso automático por WhatsApp (REQ-040…REQ-043, ADR-027, design.md §12)
-- Permiso vigente, join_queue con casilla, baja, claim_notification en cada resultado, tope del mes,
-- estados del aviso, contadores, RLS y permisos (ADR-019).
-- Todo corre en una transacción: now() no cambia, por eso las fechas de "después" se escriben a mano.
begin;
select plan(91);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       '0000000e-0000-0000-0000-0000000000e6'::uuid as other_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update tickets set status = 'cancelled', cancel_reason = 'business' where business_id = (select biz from ctx)
  and status in ('waiting', 'called', 'in_service');
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);

create or replace function _t(p_phone text) returns uuid language sql as $$
  select id from tickets where customer_phone_e164 = p_phone order by created_at desc limit 1
$$;
create or replace function _as(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;
create or replace function _anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true)
$$;
create or replace function _c(p_phone text) returns customers language sql as $$
  select * from customers where phone_e164 = p_phone
$$;
create or replace function _join(p_phone text, p_opt_in boolean default null) returns jsonb language sql as $$
  select join_queue(p_slug => 'la-33', p_name => 'Cliente ' || right(p_phone, 4), p_phone => p_phone,
                    p_service_id => (select corte from ctx), p_whatsapp_opt_in => p_opt_in)
$$;
create or replace function _n(p_ticket uuid, p_kind notification_kind) returns ticket_notifications language sql as $$
  select * from ticket_notifications where ticket_id = p_ticket and kind = p_kind
$$;

-- Otro negocio para las pruebas de aislamiento
insert into auth.users (id, email) values ((select other_u from ctx), 'otro-h6@test.local');
select _as((select other_u from ctx));
select create_business('Otra Barbería H6', 'otra-h6');
select _anon();
alter table ctx add column other_biz uuid, add column other_corte uuid;
update ctx set other_biz = (select id from businesses where slug = 'otra-h6');
insert into services (business_id, name, duration_min, price)
values ((select other_biz from ctx), 'Corte H6', 30, 20000);
update ctx set other_corte = (select id from services where name = 'Corte H6');

-- ------------------------------------------- REQ-043.3 apagado por defecto ----
select is((select whatsapp_auto_enabled from businesses where id = (select biz from ctx)), false,
  'REQ-043.3 los negocios que ya existen quedan con el aviso apagado');
select is((select whatsapp_auto_enabled from businesses where id = (select other_biz from ctx)), false,
  'REQ-043.3 un negocio nuevo nace con el aviso apagado');
select throws_ok($$ update businesses set whatsapp_contact_phone = '300 123' where id = (select biz from ctx) $$,
  '23514', null, 'REQ-042.4 el número de contacto se guarda en E.164');
select lives_ok($$ update businesses set whatsapp_contact_phone = '+573001112233' where id = (select biz from ctx) $$,
  'REQ-042.4 el dueño guarda el número de contacto');

select _join('+573007770001', true);
select is((_c('+573007770001')).whatsapp_opt_in_at, null,
  'REQ-043.3 apagado, tomar turno no guarda ningún permiso');
select is(claim_notification(_t('+573007770001'), 'two_left'), 'disabled',
  'REQ-043.3 apagado, claim_notification devuelve disabled');
select is((select count(*)::int from ticket_notifications where ticket_id = _t('+573007770001')), 0,
  'REQ-043.3 apagado, no queda registro del aviso');
select is((select notified_at from tickets where id = _t('+573007770001')), null,
  'REQ-043.3 apagado, el turno sigue sin "Avisado ✓"');

update businesses set whatsapp_allowed = true, whatsapp_auto_enabled = true where id = (select biz from ctx);

-- --------------------------------------------- REQ-041.2 permiso en la ficha ----
select lives_ok($$ select _join('+573007770002') $$, 'REQ-041.1 no marcar la casilla no impide tomar turno');
select is((_c('+573007770002')).whatsapp_opt_in_at, null, 'REQ-041.1 sin casilla no hay permiso');
select _join('+573007770003', false);
select is((_c('+573007770003')).whatsapp_opt_in_at, null, 'REQ-041.1 casilla sin marcar, sin permiso');
select _join('+573007770004', true);
select is((_c('+573007770004')).whatsapp_opt_in_at, now(), 'REQ-041.2 marcar la casilla guarda fecha y hora en la ficha');
select is((_join('+573007770003', true))->>'existing', 'true',
  'REQ-041.2 con un turno activo, volver al formulario devuelve el mismo turno');
select is((_c('+573007770003')).whatsapp_opt_in_at, now(),
  'REQ-041.2 y aun así guarda el permiso que el cliente acaba de marcar');

-- -------------------------------------------------- permiso vigente: fechas ----
select is(whatsapp_consent_active(null, null), false, 'REQ-041.5 sin fechas no hay permiso vigente');
select is(whatsapp_consent_active(now(), null), true, 'REQ-041.2 con permiso y sin baja, vigente');
select is(whatsapp_consent_active(now(), now() - interval '1 day'), true, 'REQ-042.3 permiso posterior a la baja, vigente');
select is(whatsapp_consent_active(now(), now() + interval '1 day'), false, 'REQ-042.3 baja posterior al permiso, no vigente');
select is(whatsapp_consent_active(now(), now()), false, 'REQ-042.3 baja a la misma hora del permiso, no vigente');
select is(whatsapp_consent_active(null, now()), false, 'REQ-042.3 baja sin permiso, no vigente');

-- ---------------------------------------------------- claim_notification ----
select is(claim_notification(_t('+573007770002'), 'two_left'), 'no_consent', 'REQ-041.5 sin permiso vigente no se avisa');
select is((select count(*)::int from ticket_notifications where ticket_id = _t('+573007770002')), 0,
  'REQ-041.5 no_consent no deja registro');
insert into tickets (business_id, customer_name, service_id, source)
values ((select biz from ctx), 'Sin Celular H6', (select corte from ctx), 'manual');
select is(claim_notification((select id from tickets where customer_name = 'Sin Celular H6'), 'two_left'), 'no_consent',
  'REQ-041.5 un turno sin celular no recibe avisos');
select throws_ok($$ select claim_notification('00000000-0000-4000-8000-000000000000', 'two_left') $$,
  'P0002', 'TICKET_NOT_FOUND', 'claim_notification de un turno que no existe falla');

select is(claim_notification(_t('+573007770004'), 'two_left'), 'claimed', 'REQ-040.6 con permiso el aviso se acepta para envío');
select is((_n(_t('+573007770004'), 'two_left')).status, 'claimed'::notification_status, 'REQ-040.3 queda registrado como claimed');
select is((select notified_at from tickets where id = _t('+573007770004')), now(), 'REQ-040.6 el turno queda "Avisado ✓"');
select is((select notified_by from tickets where id = _t('+573007770004')), null, 'REQ-040.6 sin barbero asociado: lo avisó el sistema');
select is(claim_notification(_t('+573007770004'), 'two_left'), 'duplicate', 'REQ-040.3 "faltan 2" solo una vez');
select is((select count(*)::int from ticket_notifications where ticket_id = _t('+573007770004')), 1,
  'REQ-040.3 el duplicado no agrega otra fila');
select is(claim_notification(_t('+573007770004'), 'called'), 'claimed', 'REQ-040.5 "te están llamando" es un aviso aparte');
select is(claim_notification(_t('+573007770004'), 'called'), 'duplicate', 'REQ-040.5 "te están llamando" una sola vez por turno');

-- ------------------------------------------------------------ skip_two_left ----
select lives_ok($$ select skip_two_left(_t('+573007770003')) $$, 'REQ-040.2 el turno que nace con 2 o menos delante se marca');
select lives_ok($$ select skip_two_left(_t('+573007770003')) $$, 'REQ-040.2 marcarlo otra vez no falla');
select is((_n(_t('+573007770003'), 'two_left')).status, 'skipped'::notification_status, 'REQ-040.2 queda constancia con skipped');
select is(claim_notification(_t('+573007770003'), 'two_left'), 'duplicate', 'REQ-040.2 ese turno no recibe "faltan 2"');
select is((select notified_at from tickets where id = _t('+573007770003')), null, 'REQ-040.2 skipped no marca "Avisado ✓"');
select is(claim_notification(_t('+573007770003'), 'called'), 'claimed', 'REQ-040.5 ese turno sí recibe "te están llamando"');
select throws_ok($$ select skip_two_left('00000000-0000-4000-8000-000000000000') $$,
  'P0002', 'TICKET_NOT_FOUND', 'skip_two_left de un turno que no existe falla');

-- ------------------------------------------------------------------- baja ----
select _join('+573007770005', true);
select is(set_whatsapp_opt_out((select public_token from tickets where id = _t('+573007770005'))), true,
  'REQ-042.1 "No quiero avisos" desde Mi turno retira el permiso');
select is((_c('+573007770005')).whatsapp_opt_out_at, now(), 'REQ-042.3 la baja guarda fecha y hora en la ficha');
select is(claim_notification(_t('+573007770005'), 'two_left'), 'no_consent', 'REQ-042.3 tampoco se avisa en un turno ya activo');
select is(set_whatsapp_opt_out((select public_token from tickets where id = _t('+573007770005'))), false,
  'REQ-042.3 repetir la baja no cambia nada');
select throws_ok($$ select set_whatsapp_opt_out('no-existe') $$, 'P0002', 'TICKET_NOT_FOUND',
  'REQ-042.1 la baja con un enlace que no existe falla');
update customers set whatsapp_opt_in_at = now() + interval '1 hour' where phone_e164 = '+573007770005';
select is(claim_notification(_t('+573007770005'), 'two_left'), 'claimed',
  'REQ-042.3 vuelve a recibir avisos si marca la casilla después de la baja');

select _join('+573007770006', true);
insert into customers (business_id, phone_e164, name, whatsapp_opt_in_at)
values ((select other_biz from ctx), '+573007770006', 'Otro Negocio', now());
select is(whatsapp_opt_out_by_phone((select biz from ctx), '+573007770006'), true, 'REQ-042.2 "PARAR" retira el permiso');
select is(claim_notification(_t('+573007770006'), 'two_left'), 'no_consent', 'REQ-042.3 después de "PARAR" no se avisa');
select is((select whatsapp_opt_out_at from customers where business_id = (select other_biz from ctx) and phone_e164 = '+573007770006'), null,
  'REQ-042.2 "PARAR" solo toca la ficha de ese negocio');
select is(whatsapp_opt_out_by_phone((select biz from ctx), '+573007779999'), false, 'REQ-042.2 un celular sin ficha no cambia nada');

-- ---------------------------------------------------- set_notification_status ----
select _join('+573007770007', true);
select claim_notification(_t('+573007770007'), 'two_left');
select is(set_notification_status('sent', (_n(_t('+573007770007'), 'two_left')).id, 'wamid.h6-1'), true,
  'REQ-040.6 aceptado por Meta: queda sent con su id');
select is((_n(_t('+573007770007'), 'two_left')).meta_message_id, 'wamid.h6-1', 'REQ-040.6 guarda el id de Meta');
select is(set_notification_status('delivered', p_meta_message_id => 'wamid.h6-1'), true, 'REQ-043.2 el webhook lo marca entregado');
select is(set_notification_status('sent', p_meta_message_id => 'wamid.h6-1'), false, 'REQ-043.2 un delivered no retrocede a sent');
select is((_n(_t('+573007770007'), 'two_left')).status, 'delivered'::notification_status, 'REQ-043.2 sigue entregado');
select is(set_notification_status('failed', p_meta_message_id => 'wamid.no-existe'), false, 'REQ-040.7 un evento de un mensaje ajeno no falla');
select throws_ok($$ select set_notification_status('claimed', (_n(_t('+573007770007'), 'two_left')).id) $$,
  'P0004', 'INVALID_NOTIFICATION_STATUS', 'set_notification_status solo acepta sent, delivered y failed');

select _join('+573007770008', true);
select claim_notification(_t('+573007770008'), 'two_left');
select is(set_notification_status('failed', (_n(_t('+573007770008'), 'two_left')).id, p_error => '131026'), true,
  'REQ-040.7 Meta rechaza el aviso');
select is((select notified_at from tickets where id = _t('+573007770008')), null, 'REQ-040.7 se quita "Avisado ✓" y vuelve el botón');
select is((_n(_t('+573007770008'), 'two_left')).error_code, '131026', 'REQ-040.7 guarda el código de error');
select is(claim_notification(_t('+573007770008'), 'two_left'), 'duplicate', 'REQ-040.3 un aviso fallido no se reintenta solo');

-- REQ-040.7 un aviso manual (el barbero tocó "Avisar") no se pierde
select _join('+573007770009', true);
select _as((select juan_u from ctx));
select mark_ticket_notified(_t('+573007770009'));
select _anon();
select claim_notification(_t('+573007770009'), 'two_left');
select is((select notified_by from tickets where id = _t('+573007770009')), (select juan_u from ctx),
  'REQ-040.7 el aviso automático no borra quién avisó a mano');
select set_notification_status('failed', (_n(_t('+573007770009'), 'two_left')).id);
select ok((select notified_at is not null from tickets where id = _t('+573007770009')),
  'REQ-040.7 failed no borra un aviso manual');

-- ------------------------------------------------- REQ-043.1 tope del mes ----
-- Tickets ya atendidos en otro negocio para llenar el tope sin tocar la fila de la 33
insert into tickets (business_id, customer_name, service_id, source, status)
select (select other_biz from ctx), 'Relleno H6', (select other_corte from ctx), 'manual', 'done'
from generate_series(1, 3000);
insert into ticket_notifications (business_id, ticket_id, kind, status)
select business_id, id, 'two_left', 'sent' from tickets
where business_id = (select other_biz from ctx) and customer_name = 'Relleno H6' limit 2999;
update businesses set whatsapp_allowed = true, whatsapp_auto_enabled = true where id = (select other_biz from ctx);
update customers set whatsapp_opt_in_at = now() where business_id = (select other_biz from ctx);
with nuevos as (
  insert into customers (business_id, phone_e164, name, whatsapp_opt_in_at)
  select (select other_biz from ctx), '+57300777100' || n, 'Tope ' || n, now() from generate_series(1, 2) n
  returning id, phone_e164, name)
insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id, source)
select (select other_biz from ctx), id, name, phone_e164, (select other_corte from ctx), 'manual' from nuevos;

select is(claim_notification(_t('+573007771001'), 'two_left'), 'claimed', 'REQ-043.1 el aviso 3.000 todavía sale');
select is(claim_notification(_t('+573007771002'), 'two_left'), 'cap_reached', 'REQ-043.1 con 3.000 en el mes se deja de enviar');
select is((select count(*)::int from ticket_notifications where ticket_id = _t('+573007771002')), 0,
  'REQ-043.1 cap_reached no deja registro');
select is((select notified_at from tickets where id = _t('+573007771002')), null, 'REQ-043.1 el turno vuelve al botón manual');
select is((select (notification_month_stats((select other_biz from ctx)))->>'capReached'), 'true', 'REQ-043.2 los contadores avisan que se llegó al tope');
select _join('+573007770010', true);
select is(claim_notification(_t('+573007770010'), 'two_left'), 'claimed', 'REQ-043.1 el tope es por negocio');

-- El primer día del mes en Bogotá empieza a las 05:00 UTC
update ticket_notifications set created_at = (date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota') - interval '1 second'
 where business_id = (select other_biz from ctx);
select is(claim_notification(_t('+573007771002'), 'two_left'), 'claimed', 'REQ-043.1 al empezar el mes de Bogotá el contador vuelve a cero');
select is((select (notification_month_stats((select other_biz from ctx)))->>'capReached'), 'false', 'REQ-043.2 el mes nuevo no está en el tope');

-- ---------------------------------------------------- REQ-043.2 contadores ----
select _as((select owner_u from ctx));
select is(notification_month_stats((select biz from ctx)), '{"sent": 1, "failed": 2, "capReached": false}'::jsonb,
  'REQ-043.2 enviados, fallidos y tope del mes; lo saltado no cuenta');
select _as((select juan_u from ctx));
select throws_ok($$ select notification_month_stats((select biz from ctx)) $$, '42501', 'FORBIDDEN', 'REQ-043.2 el barbero no ve los contadores');
select _as((select other_u from ctx));
select throws_ok($$ select notification_month_stats((select biz from ctx)) $$, '42501', 'FORBIDDEN', 'REQ-043.2 otro dueño no ve los contadores');
select _anon();

-- ------------------------------------------------ REQ-041.4 quién da permiso ----
select auth.test_login((select owner_u from ctx));
select throws_ok($$ update customers set whatsapp_opt_in_at = now() where phone_e164 = '+573007770002' $$,
  '42501', 'FORBIDDEN', 'REQ-041.4 el dueño no puede marcar el permiso por el cliente');
select throws_ok($$ insert into customers (business_id, phone_e164, name, whatsapp_opt_in_at)
                    values ((select biz from ctx), '+573007770020', 'Con Permiso', now()) $$,
  '42501', 'FORBIDDEN', 'REQ-041.4 tampoco al crear la ficha');
select lives_ok($$ update customers set notes = 'prefiere tijera' where phone_e164 = '+573007770002' $$,
  'REQ-041.4 el dueño sigue editando el resto de la ficha');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ update customers set whatsapp_opt_in_at = now() where phone_e164 = '+573007770002' $$,
  '42501', 'FORBIDDEN', 'REQ-041.4 el barbero no puede marcar el permiso por el cliente');
select auth.test_logout();
select _anon();

-- --------------------------------------------- fichas fusionadas y eliminadas ----
insert into customers (business_id, phone_e164, name, whatsapp_opt_in_at, whatsapp_opt_out_at)
select (select biz from ctx), p, 'Fusión ' || right(p, 2), i, o from (values
  ('+573007770021', now() - interval '3 days', null::timestamptz),
  ('+573007770022', now() - interval '2 days', now() - interval '1 day'),
  ('+573007770023', null::timestamptz, null::timestamptz),
  ('+573007770024', now() - interval '1 day', null::timestamptz),
  ('+573007770025', now(), null::timestamptz)) v(p, i, o);
select _as((select owner_u from ctx));
select merge_customers((_c('+573007770021')).id, (_c('+573007770022')).id);
select merge_customers((_c('+573007770023')).id, (_c('+573007770024')).id);
select _anon();
select is(whatsapp_consent_active((_c('+573007770021')).whatsapp_opt_in_at, (_c('+573007770021')).whatsapp_opt_out_at), false,
  'REQ-042.3 fusionar fichas no revive a quien se dio de baja');
select is(whatsapp_consent_active((_c('+573007770023')).whatsapp_opt_in_at, (_c('+573007770023')).whatsapp_opt_out_at), true,
  'REQ-041.2 fusionar fichas conserva el permiso de la fusionada');
alter table ctx add column anon_c uuid;
update ctx set anon_c = (_c('+573007770025')).id;
select anonymize_customer((select anon_c from ctx));
select is((select whatsapp_opt_in_at from customers where id = (select anon_c from ctx)), null,
  'REQ-018.6 eliminar la ficha borra el permiso');

-- ---------------------------------------------------- RLS y permisos ADR-019 ----
select ok((select relrowsecurity and relforcerowsecurity from pg_class where oid = 'ticket_notifications'::regclass),
  'ADR-019 ticket_notifications tiene RLS forzada');
select auth.test_login((select owner_u from ctx));
select ok((select count(*) > 0 from ticket_notifications), 'REQ-043.2 el dueño lee los avisos de su negocio');
select is((select count(*)::int from ticket_notifications where business_id <> (select biz from ctx)), 0,
  'REQ-043.2 el dueño no ve los avisos de otro negocio');
select throws_ok($$ insert into ticket_notifications (business_id, ticket_id, kind, status)
                    select (select biz from ctx), id, 'called', 'sent' from tickets limit 1 $$,
  '42501', null, 'ADR-019 nadie escribe avisos directo, ni el dueño');
select throws_ok($$ update ticket_notifications set status = 'sent' $$, '42501', null, 'ADR-019 ni los cambia');
select auth.test_login((select juan_u from ctx));
select is((select count(*)::int from ticket_notifications), 0, 'REQ-043.2 el barbero no lee el registro de avisos');
select auth.test_logout();
select _anon();

select ok(not has_table_privilege('anon', 'ticket_notifications', 'select'), 'ADR-009 anon no lee los avisos');
select ok(has_table_privilege('service_role', 'ticket_notifications', 'select'), 'ADR-009 el servidor lee los avisos');
select is((select coalesce(string_agg(p.proname, ', ' order by p.proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
             and p.proname in ('set_whatsapp_opt_out', 'whatsapp_opt_out_by_phone', 'claim_notification', 'skip_two_left',
                               'set_notification_status', 'set_whatsapp_opt_in', 'whatsapp_consent_active', 'notification_cap_reached')),
  '', 'ADR-019 los avisos solo se mueven con service_role');
select ok(has_function_privilege('authenticated', 'notification_month_stats(uuid)', 'execute')
          and not has_function_privilege('anon', 'notification_month_stats(uuid)', 'execute'),
  'ADR-019 los contadores son del personal, validados por dentro');
select ok(has_function_privilege('service_role', 'claim_notification(uuid, notification_kind)', 'execute')
          and has_function_privilege('service_role', 'set_notification_status(notification_status, uuid, text, text)', 'execute')
          and has_function_privilege('service_role', 'skip_two_left(uuid)', 'execute')
          and has_function_privilege('service_role', 'set_whatsapp_opt_out(text)', 'execute')
          and has_function_privilege('service_role', 'whatsapp_opt_out_by_phone(uuid, text)', 'execute'),
  'ADR-009 service_role ejecuta las funciones del aviso');

select * from finish();
rollback;
