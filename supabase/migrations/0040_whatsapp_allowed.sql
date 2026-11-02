-- 0040 · Hito 6, solo los negocios habilitados por el operador encienden el aviso (T-070, ADR-029,
-- design.md §12.1). Cubre: REQ-043.6.
-- Las credenciales de WhatsApp son de toda la instalación y el dueño escribe `businesses` por RLS:
-- sin esto cualquier dueño encendería el aviso con el número y la tarjeta de Filo.

alter table businesses
  add column whatsapp_allowed boolean not null default false,
  add constraint businesses_whatsapp_allowed_check check (not whatsapp_auto_enabled or whatsapp_allowed);

-- REQ-043.6 la habilitación la da solo el operador (service_role): el personal no la escribe, ni
-- siquiera el dueño, que sí tiene política de escritura sobre el negocio. Igual que
-- customers_whatsapp_consent_guard (0036).
create or replace function businesses_whatsapp_allowed_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and new.whatsapp_allowed is distinct from old.whatsapp_allowed then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger businesses_whatsapp_allowed_guard before update on businesses
  for each row execute function businesses_whatsapp_allowed_guard();

-- ADR-027: el aviso solo se activa en Filo. En local y en CI no hay Filo y no cambia nada.
update businesses set whatsapp_allowed = true where slug = 'filo';

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function businesses_whatsapp_allowed_guard() from public, anon, authenticated;
grant execute on function businesses_whatsapp_allowed_guard() to service_role;
