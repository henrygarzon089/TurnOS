-- 0047 · Plantillas de citas (REQ-054.5, design.md §14.1, T-079). Va aparte de 0046 porque los valores
-- nuevos del enum message_template_key no se usan en la misma transacción que los agrega (como 0044).
-- Los negocios nuevos las reciben de un trigger en vez de redefinir create_business: así no se pisa
-- con otras migraciones que la cambien.

create or replace function appointment_templates(p_business_id uuid) returns void
language sql security definer set search_path = public as $$
  insert into message_templates (business_id, key, body) values
    (p_business_id, 'appointment_confirm',
     'Hola {nombre}, tu cita en {negocio} es el {fecha} a las {hora}. Aquí la ves o la cancelas: {enlace}'),
    (p_business_id, 'appointment_reminder',
     'Hola {nombre}, te recordamos tu cita mañana {fecha} a las {hora} en {negocio}. Si no puedes venir, cancélala aquí: {enlace}'),
    (p_business_id, 'appointment_cancelled',
     'Hola {nombre}, tuvimos que cancelar tu cita del {fecha} a las {hora} en {negocio}. Reserva otra aquí: {enlace}')
  on conflict (business_id, key) do nothing
$$;

create or replace function businesses_appointment_templates() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform appointment_templates(new.id);
  return new;
end $$;
create trigger businesses_appointment_templates after insert on businesses
  for each row execute function businesses_appointment_templates();

select appointment_templates(id) from businesses;

revoke all on function appointment_templates(uuid), businesses_appointment_templates() from public, anon, authenticated;
grant execute on function appointment_templates(uuid), businesses_appointment_templates() to service_role;
