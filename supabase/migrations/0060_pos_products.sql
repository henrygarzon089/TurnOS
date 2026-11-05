-- 0060 · Hito 12, punto de venta: datos (T-110, ADR-038)
-- Cubre: REQ-065.1–065.5, REQ-068.1 y los checks de REQ-067.2/067.3/068.3/068.4. Diseño: design.md §17.1–§17.2.
-- Sin marcar ningún producto la caja no cambia: la comisión de productos queda en 0.

-- ---------------------------------------------------------- businesses ----
-- REQ-065.1 un solo % de comisión por productos; REQ-068.1 % de descuento de empleado
alter table businesses
  add column product_commission_pct int not null default 10 check (product_commission_pct between 0 and 100),
  add column staff_discount_pct int not null default 20 check (staff_discount_pct between 0 and 100);

-- ------------------------------------------------- business_pct_changes ----
-- REQ-065.4 historial de los dos %, como commission_changes (REQ-025.3)
create type business_pct_kind as enum ('product_commission', 'staff_discount');
create table business_pct_changes (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  kind business_pct_kind not null,
  old_pct int,
  new_pct int not null,
  changed_by uuid,
  at timestamptz not null default now()
);
create index business_pct_changes_business_idx on business_pct_changes (business_id, at desc);

create or replace function businesses_pct_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.product_commission_pct is distinct from old.product_commission_pct then
    insert into business_pct_changes (business_id, kind, old_pct, new_pct, changed_by)
    values (new.id, 'product_commission', old.product_commission_pct, new.product_commission_pct, auth.uid());
  end if;
  if new.staff_discount_pct is distinct from old.staff_discount_pct then
    insert into business_pct_changes (business_id, kind, old_pct, new_pct, changed_by)
    values (new.id, 'staff_discount', old.staff_discount_pct, new.staff_discount_pct, auth.uid());
  end if;
  return new;
end $$;
create trigger businesses_pct_change after update of product_commission_pct, staff_discount_pct on businesses
  for each row execute function businesses_pct_change();

-- ------------------------------------------------------------- products ----
-- REQ-065.2 "Da comisión al que vende"; REQ-065.3 categoría opcional
alter table products
  add column commissionable boolean not null default false,
  add column category text check (length(trim(category)) between 1 and 30);

-- ----------------------------------------------------------- sale_items ----
-- REQ-065.5 / REQ-067.2 la línea guarda si dio comisión (copia del producto al vender)
alter table sale_items add column commissionable boolean not null default false;
alter table sale_items add constraint sale_items_commissionable_ck
  check (kind = 'product' or not commissionable);

-- ---------------------------------------------------------------- sales ----
-- REQ-067.2 comisión de productos aparte de la de servicios; REQ-068 compra de un barbero
alter table sales
  add column product_commission_pct int not null default 0 check (product_commission_pct between 0 and 100),
  add column product_commission_base int not null default 0 check (product_commission_base >= 0),
  add column product_commission_amount int not null default 0 check (product_commission_amount >= 0),
  add column staff_buyer_id uuid,
  add column staff_discount_total int not null default 0 check (staff_discount_total >= 0);
alter table sales add constraint sales_staff_buyer_fk
  foreign key (business_id, staff_buyer_id) references barbers (business_id, id);
-- REQ-068.3 / REQ-068.4 solo productos, sin turno, sin barbero, sin comisión
alter table sales add constraint sales_staff_purchase_ck
  check (staff_buyer_id is null
         or (barber_id is null and ticket_id is null and services_total = 0 and membership_total = 0
             and gift_card_total = 0 and product_commission_amount = 0));
-- REQ-067.3 sin barbero no hay comisión de productos
alter table sales add constraint sales_product_commission_ck
  check (barber_id is not null or product_commission_amount = 0);
alter table sales add constraint sales_staff_discount_ck
  check (staff_discount_total = 0 or staff_buyer_id is not null);
create index sales_staff_buyer_idx on sales (staff_buyer_id) where staff_buyer_id is not null;

-- ------------------------------------------------------------------ RLS ----
-- §17.2 el dueño lee el historial; el barbero no; se escribe solo por el trigger
alter table business_pct_changes enable row level security;
alter table business_pct_changes force row level security;
create policy business_pct_changes_owner_select on business_pct_changes for select to authenticated
  using (is_owner_of(business_id));

revoke all on business_pct_changes from public, anon, authenticated;
grant select on business_pct_changes to authenticated;
grant all on business_pct_changes to service_role;

revoke execute on function businesses_pct_change() from public, anon, authenticated;
