-- T-068 · Lecturas de las pantallas del aviso (design.md §12.6): estado del negocio y del permiso, y
-- párrafo de WhatsApp en el aviso de privacidad por defecto.
begin;
select plan(17);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

insert into businesses (name, slug) values ('Otra Barbería', 'otra-0039');

insert into customers (business_id, phone_e164, name, whatsapp_opt_in_at, whatsapp_opt_out_at) values
  ((select biz from ctx), '+573009990001', 'Con permiso', now() - interval '1 day', null),
  ((select biz from ctx), '+573009990002', 'Dado de baja', now() - interval '2 day', now() - interval '1 day'),
  ((select biz from ctx), '+573009990003', 'Sin permiso', null, null),
  ((select biz from ctx), '+573009990004', 'Volvió a aceptar', now() - interval '1 hour', now() - interval '1 day');

-- Turnos antes de leer: get_ticket_by_token es stable y no vería uno creado en la misma sentencia
insert into tickets (business_id, customer_id, customer_name, customer_phone_e164, service_id)
select (select biz from ctx), c.id, c.name, c.phone_e164, (select corte from ctx)
from customers c where c.phone_e164 in ('+573009990001', '+573009990002', '+573009990003');
insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
values ((select biz from ctx), 'Sin ficha', '+573009990005', (select corte from ctx));

create or replace function _consent(p_phone text) returns boolean
language sql stable as $$
  select (get_ticket_by_token(public_token) ->> 'whatsappConsent')::boolean
  from tickets where customer_phone_e164 = p_phone
$$;

-- --------------------------------------------------- formulario de turno ----
select is(customer_has_whatsapp_consent('la-33', '+573009990001'), true,
  'REQ-041.3 con permiso vigente el formulario muestra la línea');
select is(customer_has_whatsapp_consent('la-33', '+573009990004'), true,
  'REQ-041.3 un permiso posterior a la baja está vigente');
select is(customer_has_whatsapp_consent('la-33', '+573009990002'), false,
  'REQ-041.1 tras la baja el formulario vuelve a mostrar la casilla');
select is(customer_has_whatsapp_consent('la-33', '+573009990003'), false,
  'REQ-041.1 sin permiso el formulario muestra la casilla');
select is(customer_has_whatsapp_consent('la-33', '+573009990099'), false,
  'REQ-041.1 sin ficha el formulario muestra la casilla');
select is(customer_has_whatsapp_consent('otra-0039', '+573009990001'), false,
  'REQ-041.3 el permiso es de la ficha de cada negocio');

-- ------------------------------------------------------ negocio apagado ----
select is((get_public_business('la-33') ->> 'whatsappAutoEnabled')::boolean, false,
  'REQ-043.3 el aviso viene apagado');
select is(_consent('+573009990001'), false,
  'REQ-043.3 apagado, "Mi turno" no ofrece la baja aunque la ficha tenga permiso');

-- ------------------------------------------------------ negocio activo ----
update businesses set whatsapp_allowed = true, whatsapp_auto_enabled = true where id = (select biz from ctx);

select is((get_public_business('la-33') ->> 'whatsappAutoEnabled')::boolean, true,
  'REQ-041.1 activo, el formulario lo sabe');
select is(_consent('+573009990001'), true,
  'REQ-042.1 activo y con permiso vigente, "Mi turno" ofrece la baja');
select is(_consent('+573009990002'), false,
  'REQ-042.1 dado de baja, "Mi turno" no la ofrece');
select is(_consent('+573009990003'), false,
  'REQ-042.1 sin permiso, "Mi turno" no la ofrece');
select is(_consent('+573009990005'), false,
  'REQ-041.5 un turno sin ficha no tiene permiso');

-- ---------------------------------------------------- aviso de privacidad ----
select ok(default_privacy_text('La 33') ~ 'WhatsApp \(Meta\)'
          and default_privacy_text('La 33') ~ 'celular y (su )?nombre pasan por WhatsApp',
  'REQ-041.6 el aviso por defecto dice que el celular y el nombre pasan por WhatsApp (Meta)');
select ok(default_privacy_text('La 33') ~ 'cumpleaños',
  'REQ-037.6 el aviso por defecto conserva el cumpleaños');

-- ------------------------------------------------------ permisos ADR-019 ----
select ok(not has_function_privilege('authenticated', 'customer_has_whatsapp_consent(text, text)', 'execute'),
  'ADR-009 el personal no consulta el permiso con su sesión');
select ok(has_function_privilege('service_role', 'customer_has_whatsapp_consent(text, text)', 'execute'),
  'ADR-009 las páginas públicas lo consultan con service_role');

select * from finish();
rollback;
