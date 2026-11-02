-- T-066 · Lecturas del envío automático (REQ-040, ADR-027, design.md §12.4): la fila con celulares,
-- los avisos registrados, los `claimed` vencidos y el id de un aviso. Permisos ADR-019.
begin;
select plan(17);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update tickets set status = 'cancelled', cancel_reason = 'business' where business_id = (select biz from ctx)
  and status in ('waiting', 'called', 'in_service');
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);

create or replace function _ticket(p_phone text) returns uuid language sql as $$
  insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
  values ((select biz from ctx), 'Cliente ' || right(p_phone, 4), p_phone, (select corte from ctx))
  returning id
$$;

create temp table t as
select _ticket('+573007770101') as a, _ticket('+573007770102') as b, _ticket('+573007770103') as c,
       _ticket('+573007770104') as d;
grant select on t to public;

-- ------------------------------------------------------------- apagado ----
select is(get_notification_queue((select biz from ctx)), '{"enabled": false}'::jsonb,
  'REQ-043.3 apagado no entrega la fila');
select is(get_notification_queue('00000000-0000-4000-8000-000000000000'), '{"enabled": false}'::jsonb,
  'un negocio que no existe se trata como apagado');

update businesses set whatsapp_auto_enabled = true, grace_minutes = 7 where id = (select biz from ctx);

-- ---------------------------------------------------------------- fila ----
create temp table q as select get_notification_queue((select biz from ctx)) as v;
grant select on q to public;
select is((select v -> 'enabled' from q), 'true'::jsonb, 'REQ-043.3 activo entrega la fila');
select is((select v #>> '{business,name}' from q), 'Barbería La 33', 'REQ-040.1 trae el nombre del negocio');
select is((select v #>> '{business,graceMinutes}' from q), '7', 'REQ-040.5 trae el tiempo de gracia');
select is((select jsonb_array_length(v #> '{queue,waiting}') from q), 4, 'REQ-040.1 trae la fila para el estimado');
select is((select e ->> 'phoneE164' from q, jsonb_array_elements(v -> 'tickets') e
           where e ->> 'id' = (select a::text from t)), '+573007770101', 'REQ-040.1 trae el celular del turno');
select is((select e ->> 'publicToken' from q, jsonb_array_elements(v -> 'tickets') e
           where e ->> 'id' = (select a::text from t)),
          (select public_token from tickets where id = (select a from t)), 'REQ-040.1 trae el enlace a "Mi turno"');
select is((select e ->> 'customerName' from q, jsonb_array_elements(v -> 'tickets') e
           where e ->> 'id' = (select a::text from t)), 'Cliente 0101', 'REQ-040.1 trae el nombre del cliente');

-- `called` entra con su estado y uno de ayer no
update tickets set status = 'called', called_at = now(), assigned_barber_id = (select juan from ctx) where id = (select a from t);
update tickets set business_day = business_day - 1 where id = (select b from t);
select is((select e ->> 'status' from jsonb_array_elements(get_notification_queue((select biz from ctx)) -> 'tickets') e
           where e ->> 'id' = (select a::text from t)), 'called', 'REQ-040.5 trae los turnos llamados');
select ok(not exists (select 1 from jsonb_array_elements(get_notification_queue((select biz from ctx)) -> 'tickets') e
                      where e ->> 'id' = (select b::text from t)), 'un turno de otro día no entra');

-- ------------------------------------------------------------ registrados ----
select skip_two_left((select c from t));
insert into ticket_notifications (business_id, ticket_id, kind, status)
values ((select biz from ctx), (select a from t), 'two_left', 'failed');
select is((select count(*)::int from jsonb_array_elements(get_notification_queue((select biz from ctx)) -> 'recorded') r
           where r in (jsonb_build_object('ticketId', (select c from t), 'kind', 'two_left'),
                       jsonb_build_object('ticketId', (select a from t), 'kind', 'two_left'))),
  2, 'REQ-040.3 los avisos registrados cuentan en cualquier estado');

-- --------------------------------------------------------- id del aviso ----
select is(notification_id((select c from t), 'two_left'),
          (select id from ticket_notifications where ticket_id = (select c from t)), 'notification_id encuentra el aviso');
select is(notification_id((select c from t), 'called'), null, 'notification_id sin aviso da null');

-- ----------------------------------------------------- `claimed` vencidos ----
insert into ticket_notifications (business_id, ticket_id, kind, status, created_at, meta_message_id)
values ((select biz from ctx), (select a from t), 'called', 'claimed', now() - interval '3 minutes', null),
       ((select biz from ctx), (select c from t), 'called', 'claimed', now() - interval '1 minute', null),
       ((select biz from ctx), (select d from t), 'called', 'claimed', now() - interval '3 minutes', 'wamid.x');
select is(get_notification_queue((select biz from ctx)) -> 'staleClaims',
          jsonb_build_array((select id from ticket_notifications where ticket_id = (select a from t) and kind = 'called')),
  'REQ-040.7 solo vence el `claimed` de más de 2 minutos sin id de Meta');

-- ---------------------------------------------------- permisos ADR-019 ----
select is((select coalesce(string_agg(p.proname, ', ' order by p.proname), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
             and p.proname in ('get_notification_queue', 'notification_id')),
  '', 'ADR-019 estas lecturas traen celulares: solo service_role');
select ok(has_function_privilege('service_role', 'get_notification_queue(uuid)', 'execute')
          and has_function_privilege('service_role', 'notification_id(uuid, notification_kind)', 'execute'),
  'ADR-009 service_role las ejecuta');

select * from finish();
rollback;
