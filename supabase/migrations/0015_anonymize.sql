-- 0015 · Supresión de datos (T-034)
-- Cubre: REQ-018.6, NFR-005 (Ley 1581)
-- Redefine anonymize_customer de 0013: además borra el celular de rate_limits y desmarca el
-- preferido manual. Las ventas (T-040) deben anonimizarse aquí también cuando existan.
create or replace function anonymize_customer(p_customer_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  c customers%rowtype;
begin
  select * into c from customers where id = p_customer_id for update;
  if not found or c.anonymized_at is not null then
    raise exception 'CUSTOMER_NOT_FOUND' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not is_owner_of(c.business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if exists (select 1 from tickets where customer_id = c.id and status in ('waiting', 'called', 'in_service')) then
    raise exception 'CUSTOMER_HAS_ACTIVE_TICKET' using errcode = 'P0005';
  end if;

  update tickets set customer_name = 'Cliente eliminado', customer_phone_e164 = null where customer_id = c.id;
  perform set_config('turnos.internal', '1', true);
  update customers
     set name = 'Cliente eliminado', phone_e164 = 'deleted:' || c.id::text, notes = null,
         preferred_barber_id = null, preferred_barber_manual = false, do_not_contact = true,
         anonymized_at = now()
   where id = c.id;
  perform set_config('turnos.internal', '', true);
  delete from reminders where customer_id = c.id;
  delete from rate_limits where key = 'phone:' || c.phone_e164;
end $$;
