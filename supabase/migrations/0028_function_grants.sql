-- 0028 · Permisos de ejecución de funciones (seguridad, NFR-004 · ADR-009 · REQ-031.1)
-- Supabase da EXECUTE a anon y authenticated sobre todo `public` por default privileges, y varias
-- funciones aceptan `auth.uid() is null` como si fuera service_role. Resultado: con la llave
-- pública se podían llamar (p. ej. search_customers con el id público del negocio). El shim
-- local de ADR-015 no reproduce esos permisos, por eso ninguna prueba lo detectó.
-- Regla: anon no ejecuta nada; authenticated solo lo del personal; service_role todo.

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on all functions in schema public to service_role;

-- Funciones del personal (cada una valida rol y negocio por dentro)
grant execute on function
  add_manual_ticket(uuid, text, text, uuid, uuid),
  anonymize_customer(uuid),
  barber_can_see_customer(uuid),
  barber_customers(text, int),
  barber_queue_tickets(uuid),
  call_next(uuid),
  cash_closures_list(uuid, int),
  cash_day_summary(uuid, date),
  close_cash_day(uuid, date, int),
  create_business(text, text, text),
  customer_loyalty(uuid),
  inactive_customers(uuid),
  is_business_open(uuid, timestamptz),
  mark_ticket_notified(uuid),
  mark_ticket_unpaid(uuid, text),
  merge_customers(uuid, uuid),
  redeem_loyalty_card(uuid, uuid),
  register_sale(uuid, uuid, uuid, jsonb, jsonb, uuid),
  remove_barber(uuid),
  reopen_cash_day(uuid, date, text),
  reorder_ticket(uuid, uuid),
  search_customers(uuid, text, int),
  set_barber_status(uuid, barber_status, boolean),
  transition_ticket(uuid, ticket_status, actor_type, text, uuid),
  void_sale(uuid, text),
  weekly_summary(uuid, date)
to authenticated;

-- Usadas por políticas RLS y por defaults de columnas (se evalúan con la sesión del usuario)
grant execute on function
  is_member_of(uuid), is_owner_of(uuid), my_barber_id(uuid), auth_business_ids(),
  gen_public_token(int), business_day_bogota(timestamptz)
to authenticated;

-- gen_public_token es el default de columnas que inserta el dueño (invitaciones): se ejecuta con los
-- permisos de su dueño para no depender del permiso del usuario sobre pgcrypto.
alter function gen_public_token(int) security definer;

-- Funciones nuevas: sin EXECUTE por defecto; cada migración da permisos explícitos.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
