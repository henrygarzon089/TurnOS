-- T-067 · Mensajes entrantes de WhatsApp en un número compartido (REQ-042, ADR-028, design.md §12.5):
-- a quién se le retira el permiso, qué número de contacto se usa y la ventana móvil de 24 h.
begin;
select plan(24);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

insert into businesses (name, slug) values ('Otra Barbería', 'otra-0038');
create temp table ctx2 as select id as biz from businesses where slug = 'otra-0038';
grant select on ctx2 to public;

create or replace function _customer(p_biz uuid, p_phone text, p_in timestamptz, p_out timestamptz default null)
returns uuid language sql as $$
  insert into customers (business_id, phone_e164, name, whatsapp_opt_in_at, whatsapp_opt_out_at)
  values (p_biz, p_phone, 'Cliente', p_in, p_out) returning id
$$;

create or replace function _notice(p_biz uuid, p_phone text, p_status notification_status, p_at timestamptz)
returns void language plpgsql as $$
declare
  v_ticket uuid;
  v_service uuid;
begin
  select id into v_service from services where business_id = p_biz limit 1;
  if v_service is null then
    insert into services (business_id, name, price, duration_min) values (p_biz, 'Corte', 20000, 30)
    returning id into v_service;
  end if;
  insert into tickets (business_id, customer_name, customer_phone_e164, service_id, status, cancel_reason)
  values (p_biz, 'Cliente', p_phone, v_service, 'cancelled', 'business') returning id into v_ticket;
  insert into ticket_notifications (business_id, ticket_id, kind, status, created_at)
  values (p_biz, v_ticket, 'called', p_status, p_at);
end $$;

-- ------------------------------------------------------- baja: a quién ----
select _customer((select biz from ctx), '+573008880001', now() - interval '1 day');
select _customer((select biz from ctx2), '+573008880001', now() - interval '1 day');
select _customer((select biz from ctx), '+573008880002', now() - interval '2 day', now() - interval '1 day');
select _customer((select biz from ctx), '+573008880003', null);

select is(
  (select count(*)::int from jsonb_array_elements_text(whatsapp_inbound_context('+573008880001') -> 'optOutBusinessIds')),
  2, 'REQ-042.2 con número compartido la baja cubre cada negocio con permiso vigente, activo o no');
select is(whatsapp_inbound_context('+573008880002') -> 'optOutBusinessIds', '[]'::jsonb,
  'REQ-042.3 quien ya se dio de baja no tiene permiso que retirar');
select is(whatsapp_inbound_context('+573008880003') -> 'optOutBusinessIds', '[]'::jsonb,
  'REQ-042.2 quien nunca dio permiso no tiene permiso que retirar');
select is(whatsapp_inbound_context('+573008889999') -> 'optOutBusinessIds', '[]'::jsonb,
  'REQ-042.2 un celular sin ficha no tiene permiso que retirar');

select ok(whatsapp_opt_out_by_phone(b, '+573008880001'), 'REQ-042.3 la baja cambia la ficha')
from (select biz as b from ctx union all select biz from ctx2) x;
select is(whatsapp_inbound_context('+573008880001') -> 'optOutBusinessIds', '[]'::jsonb,
  'REQ-042.2 un evento repetido ya no encuentra nada que retirar');

-- ------------------------------------------------------ número de contacto ----
update businesses set whatsapp_contact_phone = '+573001110000' where id = (select biz from ctx);
update businesses set whatsapp_contact_phone = '+573002220000' where id = (select biz from ctx2);

select is(whatsapp_inbound_context('+573008880010') ->> 'contactPhone', null,
  'REQ-042.5 sin aviso previo y sin negocio activo no hay número');

update businesses set whatsapp_auto_enabled = true where id = (select biz from ctx);
select is(whatsapp_inbound_context('+573008880010') ->> 'contactPhone', '+573001110000',
  'REQ-042.4 sin aviso previo usa el único negocio activo');

update businesses set whatsapp_auto_enabled = true where id = (select biz from ctx2);
select is(whatsapp_inbound_context('+573008880010') ->> 'contactPhone', null,
  'REQ-042.5 sin aviso previo y con varios negocios activos no adivina');

select _notice((select biz from ctx), '+573008880011', 'delivered', now() - interval '2 hour');
select _notice((select biz from ctx2), '+573008880011', 'sent', now() - interval '1 hour');
select is(whatsapp_inbound_context('+573008880011') ->> 'contactPhone', '+573002220000',
  'REQ-042.4 usa el negocio del aviso más reciente');

select _notice((select biz from ctx), '+573008880011', 'failed', now() - interval '10 minute');
select _notice((select biz from ctx), '+573008880011', 'skipped', now() - interval '5 minute');
select is(whatsapp_inbound_context('+573008880011') ->> 'contactPhone', '+573002220000',
  'REQ-042.4 un aviso fallido u omitido no cuenta: al cliente no le llegó');

update businesses set whatsapp_contact_phone = null where id = (select biz from ctx2);
select is(whatsapp_inbound_context('+573008880011') ->> 'contactPhone', null,
  'REQ-042.5 si ese negocio no tiene número, la respuesta lo omite');

-- --------------------------------------------------------- ventana móvil ----
select ok(claim_whatsapp_reply('+573008880020'), 'REQ-042.4 el primer mensaje recibe respuesta');
select ok(not claim_whatsapp_reply('+573008880020'), 'REQ-042.4 el segundo mensaje no');
select ok(claim_whatsapp_reply('+573008880021'), 'REQ-042.4 el límite es por celular');

update rate_limits set window_start = now() - interval '23 hours 59 minutes' where key = 'wa-reply:+573008880020';
select ok(not claim_whatsapp_reply('+573008880020'), 'REQ-042.4 sigue cerrada a las 23 h 59 min, aunque cambie el día');
update rate_limits set window_start = now() - interval '24 hours 1 minute' where key = 'wa-reply:+573008880020';
select ok(claim_whatsapp_reply('+573008880020'), 'REQ-042.4 vuelve a abrirse pasadas 24 h');
select is((select count(*)::int from rate_limits where key = 'wa-reply:+573008880020'), 1,
  'REQ-042.4 no acumula registros por celular');

-- check_rate_limit limpia al azar lo de más de 2 horas: no debe tocar la ventana de 24 h
update rate_limits set window_start = now() - interval '23 hours' where key = 'wa-reply:+573008880021';
select check_rate_limit('limpieza-' || g, 5) from generate_series(1, 300) g;
select ok(not claim_whatsapp_reply('+573008880021'), 'REQ-042.4 check_rate_limit no borra la ventana de 24 h');

update rate_limits set window_start = now() - interval '25 hours' where key = 'wa-reply:+573008880021';
select ok(claim_whatsapp_reply('+573008880022'), 'REQ-042.4 otro celular reclama su ventana');
select is((select count(*)::int from rate_limits where key = 'wa-reply:+573008880021'), 0,
  'REQ-018.6 un registro vencido no conserva el celular');

-- ---------------------------------------------------------------- supresión ----
create temp table anon as select _customer((select biz from ctx), '+573008880030', now()) as id;
grant select on anon to public;
select ok(claim_whatsapp_reply('+573008880030'), 'REQ-042.4 cliente con respuesta reciente');
select anonymize_customer((select id from anon));
select is((select count(*)::int from rate_limits where key = 'wa-reply:+573008880030'), 0,
  'REQ-018.6 eliminar la ficha borra el celular de la ventana de respuesta');

select * from finish();
rollback;
