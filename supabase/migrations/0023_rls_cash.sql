-- 0023 · RLS de caja (T-042)
-- Cubre: REQ-029.1, REQ-023.7, REQ-031.1 · design.md §2.4
-- Solo lectura por políticas: las escrituras van por funciones security definer que validan rol
-- (register_sale, void_sale; close_cash_day/reopen_cash_day en T-046). Sin políticas de
-- insert/update/delete, un insert directo falla y un update directo no toca filas.

-- sales: el dueño ve las de su negocio; el barbero, solo las suyas (REQ-029.1).
create policy sales_select on sales for select to authenticated
  using (is_owner_of(business_id) or barber_id = my_barber_id(business_id));

-- Líneas y pagos: visibles si la venta lo es.
create policy sale_items_select on sale_items for select to authenticated
  using (is_owner_of(business_id)
         or exists (select 1 from sales s where s.id = sale_id and s.barber_id = my_barber_id(s.business_id)));
create policy sale_payments_select on sale_payments for select to authenticated
  using (is_owner_of(business_id)
         or exists (select 1 from sales s where s.id = sale_id and s.barber_id = my_barber_id(s.business_id)));

-- cash_closures: solo el dueño (el barbero nunca ve totales del negocio, REQ-029.1).
create policy cash_closures_select on cash_closures for select to authenticated
  using (is_owner_of(business_id));

-- commission_changes: el dueño todo; el barbero, su propio historial.
create policy commission_changes_select on commission_changes for select to authenticated
  using (is_owner_of(business_id) or barber_id = my_barber_id(business_id));
