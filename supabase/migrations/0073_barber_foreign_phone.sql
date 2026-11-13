-- 0073 · Barbero con celular de otro país (T-194, REQ-081.2, ADR-058). Diseño: design.md §23.8.
-- Solo cambia la regla del celular del barbero: cualquier E.164 válido (+, 8 a 15 dígitos). Un +57
-- sigue con la regla colombiana. Los celulares de clientes (tickets, customers, citas, membresías,
-- tarjetas de regalo) no cambian (REQ-081.6). La cuenta alias (ADR-010) ya sirve con cualquier número.

alter table barbers drop constraint barbers_phone_e164_check;
alter table barbers add constraint barbers_phone_e164_check check (
  phone_e164 ~ '^\+573\d{9}$'
  or phone_e164 ~ '^\+57 3\d{9}$'
  or (phone_e164 ~ '^\+[1-9]\d{7,14}$' and phone_e164 !~ '^\+57')
);
