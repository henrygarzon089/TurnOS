-- 0049 · La cita no bloquea fusionar ni borrar la ficha (REQ-018.5, REQ-050.2, ADR-033, T-087).
-- 0045 dejó la llave (business_id, customer_id) → customers sin acción: merge_customers y la
-- supresión hacen `delete from customers` y fallaban si la ficha tenía una cita. La cita guarda su
-- propio nombre y celular, así que basta con soltar la ficha: solo customer_id queda en null
-- (business_id no se toca). No redefine funciones.

alter table appointments drop constraint appointments_business_id_customer_id_fkey;
alter table appointments
  add constraint appointments_business_id_customer_id_fkey
  foreign key (business_id, customer_id) references customers (business_id, id)
  on delete set null (customer_id);
