-- Seguridad: quién puede ejecutar las funciones (NFR-004, ADR-009, REQ-031.1)
-- En Supabase real, anon y authenticated reciben EXECUTE sobre todo `public` por default
-- privileges; el shim local no lo reproduce. Esta prueba fija la regla en las dos bases.
begin;
select plan(6);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
     -- funciones de extensiones (pg_trgm: similitud de texto, no leen tablas) quedan como las deja Supabase
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  0, 'NFR-004 anon no ejecuta ninguna función nuestra (las páginas públicas van por service_role, ADR-009)');

select is(
  (select coalesce(string_agg(p.proname, ', '), '') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname in ('join_queue', 'upsert_customer', 'check_rate_limit', 'get_ticket_by_token', 'get_public_business',
                       'cancel_ticket_by_token', 'get_preferred_barber', 'get_invitation', 'accept_invitation',
                       'get_screen_queue', 'close_expired_queues', 'queue_snapshot', 'notify_queue_changed',
                       'set_ticket_courtesy', 'get_barber_photos', 'customer_has_birthday', 'courtesy_is_valid')),
  '', 'ADR-009 las funciones públicas del servidor no se llaman con la sesión del personal');

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
     and p.proname in ('add_manual_ticket', 'anonymize_customer', 'barber_can_see_customer', 'barber_customers',
                       'barber_queue_tickets', 'call_next', 'cash_closures_list', 'cash_day_summary', 'close_cash_day',
                       'create_business', 'customer_loyalty', 'inactive_customers', 'is_business_open',
                       'mark_ticket_notified', 'mark_ticket_unpaid', 'merge_customers', 'redeem_loyalty_card',
                       'register_sale', 'remove_barber', 'reopen_cash_day', 'reorder_ticket', 'search_customers',
                       'set_barber_services', 'set_barber_status', 'set_service_barbers', 'transition_ticket',
                       'void_sale', 'weekly_summary', 'mark_courtesy_served', 'birthdays_this_week')),
  30, 'REQ-031.1 el personal ejecuta las funciones de su trabajo (cada una valida el negocio)');

select ok(has_function_privilege('authenticated', 'is_member_of(uuid)', 'execute')
          and has_function_privilege('authenticated', 'is_owner_of(uuid)', 'execute')
          and has_function_privilege('authenticated', 'my_barber_id(uuid)', 'execute')
          and has_function_privilege('authenticated', 'media_can_write(text)', 'execute'),
  'REQ-031.1 las funciones de las políticas RLS (y de storage.objects, REQ-039.1) siguen disponibles para el personal');
select ok(has_function_privilege('authenticated', 'gen_public_token(int)', 'execute'),
  'REQ-030.2 el token de invitación (default de la columna) se genera con la sesión del dueño');
select ok(has_function_privilege('service_role', 'register_sale(uuid, uuid, uuid, jsonb, jsonb, uuid)', 'execute')
          and has_function_privilege('service_role', 'join_queue(text, text, text, uuid, uuid, int, ticket_source, int, int, uuid)', 'execute'),
  'ADR-009 service_role ejecuta todo');

select * from finish();
rollback;
