-- 0021 · Caja: ventas, líneas, pagos, cierres e historial de comisión (T-040)
-- Cubre: REQ-023.3, REQ-024.2, REQ-025.2–25.4, REQ-026.1–26.2, REQ-027.2–27.3, NFR-010
-- Diseño: design.md §2.2 (sales, sale_items, sale_payments, cash_closures, commission_changes),
-- §2.5 (triggers), §5 (fórmulas). ADR-005: montos enteros COP y registros inmutables.
-- RLS: activada y forzada sin políticas (nadie lee ni escribe con su JWT) hasta T-042.
-- Las ventas no guardan nombre ni celular del cliente (solo customer_id): anonymize_customer
-- (REQ-018.6) no necesita cambios.

create type payment_method as enum ('cash', 'nequi', 'transfer', 'card');
create type sale_status as enum ('active', 'voided');
create type sale_item_kind as enum ('service', 'product');
create type closure_status as enum ('active', 'voided');

-- ----------------------------------------------------------------- sales ----
create table sales (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  business_day date not null,                                   -- REQ-027.5 (Bogotá)
  ticket_id uuid unique references tickets (id),                -- null: venta sin turno (REQ-023.4)
  barber_id uuid references barbers (id),                       -- null: solo productos (REQ-024.2)
  customer_id uuid references customers (id) on delete set null,
  services_total int not null check (services_total >= 0),
  products_total int not null check (products_total >= 0),
  discount_total int not null default 0 check (discount_total >= 0),
  total int not null check (total >= 0),
  commission_pct int not null default 0 check (commission_pct between 0 and 100),
  commission_base int not null default 0 check (commission_base >= 0),
  commission_amount int not null default 0 check (commission_amount >= 0),
  business_amount int not null default 0,
  loyalty_card_id uuid references loyalty_cards (id),
  status sale_status not null default 'active',
  voided_reason text,
  voided_by uuid,
  voided_at timestamptz,
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint sales_total_ck check (total = services_total + products_total),
  constraint sales_business_amount_ck check (business_amount = commission_base - commission_amount),
  constraint sales_voided_ck check (
    (status = 'active' and voided_at is null and voided_reason is null)
    or (status = 'voided' and voided_at is not null and voided_by is not null
        and length(trim(coalesce(voided_reason, ''))) > 0))
);
create index sales_day_idx on sales (business_id, business_day, status);
create index sales_barber_day_idx on sales (barber_id, business_day);

-- ------------------------------------------------------------ sale_items ----
create table sale_items (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  kind sale_item_kind not null,
  ref_id uuid,                                                  -- services.id o products.id
  name text not null check (length(trim(name)) between 1 and 60),
  qty int not null check (qty > 0),
  unit_price int not null check (unit_price >= 0),
  discount int not null default 0 check (discount >= 0),
  line_total int not null,
  is_reward boolean not null default false,                     -- premio de fidelidad (REQ-019.4)
  constraint sale_items_total_ck check (line_total = unit_price * qty - discount and line_total >= 0)
);
create index sale_items_sale_idx on sale_items (sale_id);

-- --------------------------------------------------------- sale_payments ----
create table sale_payments (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  sale_id uuid not null references sales (id) on delete cascade,
  method payment_method not null,
  amount int not null check (amount > 0)
);
create index sale_payments_sale_idx on sale_payments (sale_id);

-- --------------------------------------------------------- cash_closures ----
create table cash_closures (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  business_day date not null,
  totals jsonb not null,                                        -- foto completa (design §5.2)
  cash_expected int not null check (cash_expected >= 0),
  cash_counted int not null check (cash_counted >= 0),
  difference int not null,
  closed_by uuid not null,
  closed_at timestamptz not null default now(),
  status closure_status not null default 'active',
  reopen_reason text,
  voided_at timestamptz,
  constraint cash_closures_difference_ck check (difference = cash_counted - cash_expected),
  constraint cash_closures_voided_ck check (
    (status = 'active' and voided_at is null and reopen_reason is null)
    or (status = 'voided' and voided_at is not null and length(trim(coalesce(reopen_reason, ''))) > 0))
);
create unique index cash_closures_active_uniq on cash_closures (business_id, business_day) where status = 'active';

-- ---------------------------------------------------- commission_changes ----
create table commission_changes (
  id bigserial primary key,
  business_id uuid not null references businesses (id) on delete cascade,
  barber_id uuid not null references barbers (id) on delete cascade,
  old_pct int,
  new_pct int not null,
  changed_by uuid,
  at timestamptz not null default now()
);
create index commission_changes_barber_idx on commission_changes (barber_id, at desc);

-- La tarjeta canjeada apunta a la venta que aplicó el premio (REQ-019.4, prevista en 0013).
alter table loyalty_cards add constraint loyalty_cards_redeemed_sale_fk
  foreign key (redeemed_sale_id) references sales (id);

-- =============================================================== triggers ====

-- REQ-025.3: historial de cambios de porcentaje (solo cuando cambia).
create or replace function barbers_commission_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.commission_pct is distinct from old.commission_pct then
    insert into commission_changes (business_id, barber_id, old_pct, new_pct, changed_by)
    values (new.business_id, new.id, old.commission_pct, new.commission_pct, auth.uid());
  end if;
  return new;
end $$;
create trigger barbers_commission_change after update of commission_pct on barbers
  for each row execute function barbers_commission_change();

-- REQ-023.3: Σ pagos = total. Diferido al final de la transacción para que register_sale (T-041)
-- inserte la venta y sus pagos en cualquier orden. Una venta en $ 0 (premio) no lleva pagos.
create or replace function sale_payments_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_sale uuid;
  v_total int;
  v_paid int;
begin
  if tg_table_name = 'sales' then
    v_sale := new.id;
  elsif tg_op = 'DELETE' then
    v_sale := old.sale_id;
  else
    v_sale := new.sale_id;
  end if;
  select total into v_total from sales where id = v_sale;
  if not found then return null; end if; -- la venta se borró en la misma transacción
  select coalesce(sum(amount), 0) into v_paid from sale_payments where sale_id = v_sale;
  if v_paid <> v_total then
    raise exception 'PAYMENTS_MISMATCH: pagos % ≠ total %', v_paid, v_total using errcode = 'P0004';
  end if;
  return null;
end $$;
create constraint trigger sales_payments_total after insert on sales
  deferrable initially deferred for each row execute function sale_payments_check();
create constraint trigger sale_payments_total after insert or update or delete on sale_payments
  deferrable initially deferred for each row execute function sale_payments_check();

-- ADR-005 / REQ-026.1: una venta no se edita; solo pasa de activa a anulada (con motivo, quién,
-- cuándo). REQ-026.2 / REQ-027.3: nada de ventas ni anulaciones en un día con cierre activo.
create or replace function sales_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from cash_closures c
             where c.business_id = new.business_id and c.business_day = new.business_day and c.status = 'active') then
    raise exception 'CASH_DAY_CLOSED' using errcode = 'P0009';
  end if;
  if tg_op = 'UPDATE' then
    if old.status = 'voided' or new.status <> 'voided'
       or (to_jsonb(new) - array['status', 'voided_reason', 'voided_by', 'voided_at'])
          <> (to_jsonb(old) - array['status', 'voided_reason', 'voided_by', 'voided_at']) then
      raise exception 'SALE_IMMUTABLE' using errcode = 'P0004';
    end if;
    if new.voided_at is null or new.voided_by is null or length(trim(coalesce(new.voided_reason, ''))) = 0 then
      raise exception 'VOID_REQUIRES_REASON' using errcode = 'P0004';
    end if;
  end if;
  return new;
end $$;
create trigger sales_guard before insert or update on sales
  for each row execute function sales_guard();

-- Líneas y pagos tampoco se editan (se anula la venta y se registra otra).
create or replace function sale_rows_immutable() returns trigger
language plpgsql as $$
begin
  raise exception 'SALE_IMMUTABLE' using errcode = 'P0004';
end $$;
create trigger sale_items_immutable before update on sale_items
  for each row execute function sale_rows_immutable();
create trigger sale_payments_immutable before update on sale_payments
  for each row execute function sale_rows_immutable();

-- REQ-027.2 / REQ-027.3: un cierre no se edita; solo se anula al reabrir (con motivo).
create or replace function cash_closures_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'voided' or new.status <> 'voided'
     or (to_jsonb(new) - array['status', 'reopen_reason', 'voided_at'])
        <> (to_jsonb(old) - array['status', 'reopen_reason', 'voided_at']) then
    raise exception 'CLOSURE_IMMUTABLE' using errcode = 'P0004';
  end if;
  return new;
end $$;
create trigger cash_closures_guard before update on cash_closures
  for each row execute function cash_closures_guard();

-- ===================================================================== RLS ====
-- Políticas en T-042 (design.md §2.4). Mientras tanto, cerrado para anon/authenticated.
alter table sales enable row level security;              alter table sales force row level security;
alter table sale_items enable row level security;         alter table sale_items force row level security;
alter table sale_payments enable row level security;      alter table sale_payments force row level security;
alter table cash_closures enable row level security;      alter table cash_closures force row level security;
alter table commission_changes enable row level security; alter table commission_changes force row level security;
