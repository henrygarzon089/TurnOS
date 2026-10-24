-- 0019 · Barbero preferido preseleccionado (T-038)
-- Cubre: REQ-022.1. El formulario público pregunta con el celular guardado en el navegador; solo
-- se devuelve el id del barbero (ningún otro dato del cliente) y solo si atiende hoy y no está en
-- pausa. Como las demás funciones públicas, solo la llama service_role (ADR-009).
create or replace function get_preferred_barber(p_slug text, p_phone text)
returns uuid
language sql stable security definer set search_path = public as $$
  select b.id
  from businesses z
  join customers c on c.business_id = z.id and c.phone_e164 = p_phone and c.anonymized_at is null
  join barbers b on b.id = c.preferred_barber_id and b.business_id = z.id
  where z.slug = p_slug
    and b.is_active
    and b.status in ('available', 'busy')
$$;

revoke all on function get_preferred_barber(text, text) from public;
grant execute on function get_preferred_barber(text, text) to service_role;
