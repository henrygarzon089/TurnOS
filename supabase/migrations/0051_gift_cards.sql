-- 0051 · Hito 9, tarjetas de regalo: datos, venta, consulta y lista (T-090, ADR-034)
-- Cubre: REQ-055.1–055.6, REQ-056.3 (lectura por token), REQ-059.3 (lista). Diseño: design.md §15.1–§15.3.
-- Sin vender ninguna tarjeta nada cambia en la caja.

-- ------------------------------------------------------------ columnas ----
create type gift_card_status as enum ('active', 'voided');

-- REQ-055.2 la venta de la tarjeta suma al total, aparte de servicios, productos y cuotas
alter table sales add column gift_card_total int not null default 0 check (gift_card_total >= 0);
alter table sales drop constraint sales_total_ck;
alter table sales add constraint sales_total_ck
  check (total = services_total + products_total + membership_total + gift_card_total);

-- --------------------------------------------------------- gift_cards ----
-- REQ-055.3–055.6 una tarjeta al portador: código para el cobro, token para la página, un año
create table gift_cards (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references businesses (id) on delete cascade,
  code text not null check (code ~ '^[A-HJKMNP-Z2-9]{8}$'),
  token text not null unique default gen_public_token(16),
  sale_id uuid not null unique references sales (id),
  buyer_customer_id uuid not null,
  recipient_name text check (length(trim(recipient_name)) between 1 and 40),
  amount int not null check (amount between 10000 and 500000 and amount % 1000 = 0),
  sold_on date not null,
  expires_on date not null,
  status gift_card_status not null default 'active',
  created_at timestamptz not null default now(),
  created_by uuid,
  unique (business_id, code),
  unique (business_id, id),
  constraint gift_cards_one_year_ck check (expires_on = (sold_on + interval '1 year')::date),
  foreign key (business_id, buyer_customer_id) references customers (business_id, id)
);
create index gift_cards_buyer_idx on gift_cards (buyer_customer_id);

-- REQ-057.1 el pago con tarjeta dice cuál tarjeta (lo usa register_sale en 0052)
alter table sale_payments add column gift_card_id uuid;
alter table sale_payments add constraint sale_payments_gift_card_fk
  foreign key (business_id, gift_card_id) references gift_cards (business_id, id);
alter table sale_payments add constraint sale_payments_gift_card_ck
  check ((method = 'gift_card') = (gift_card_id is not null));
create index sale_payments_gift_card_idx on sale_payments (gift_card_id) where gift_card_id is not null;

-- ------------------------------------------------------------------ RLS ----
-- §15.2 el dueño lee; el barbero no ve nada (usa gift_card_lookup); los cambios solo con funciones
alter table gift_cards enable row level security;
alter table gift_cards force row level security;
create policy gift_cards_owner_select on gift_cards for select to authenticated
  using (is_owner_of(business_id));
revoke all on gift_cards from public, anon, authenticated;
grant select on gift_cards to authenticated;
grant all on gift_cards to service_role;

-- ------------------------------------------------------------ funciones ----
-- REQ-055.4 código de 8 caracteres sin 0 O 1 I L (31 símbolos), al azar
create or replace function gift_card_new_code() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  a constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  b bytea := gen_random_bytes(8);
  c text := '';
begin
  for i in 0..7 loop
    c := c || substr(a, (get_byte(b, i) % 31) + 1, 1);
  end loop;
  return c;
end $$;

-- Lo que la persona escribe: mayúsculas, sin espacios ni guiones ("k7qm-4xpa" → "K7QM4XPA")
create or replace function gift_card_normalize_code(p_code text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p_code, ''), '[[:space:]-]', '', 'g')) $$;

-- design.md §15.1 saldo = valor − pagos en ventas activas (anular una venta lo devuelve solo)
create or replace function gift_card_balance(p_gift_card_id uuid) returns int
language sql stable security definer set search_path = public as $$
  select g.amount - coalesce((select sum(p.amount) from sale_payments p join sales s on s.id = p.sale_id
                              where p.gift_card_id = g.id and s.status = 'active'), 0)::int
  from gift_cards g where g.id = p_gift_card_id
$$;

-- design.md §15.1 estado que se muestra: anulada, vencida, agotada o vigente (en ese orden)
create or replace function gift_card_state(p_gift_card_id uuid, p_day date default null) returns text
language sql stable security definer set search_path = public as $$
  select case when g.status = 'voided' then 'voided'
              when g.expires_on < coalesce(p_day, business_day_bogota(now())) then 'expired'
              when gift_card_balance(g.id) = 0 then 'exhausted'
              else 'active' end
  from gift_cards g where g.id = p_gift_card_id
$$;

-- REQ-055.1–055.6 el dueño vende una tarjeta: venta sin barbero, turno ni comisión, a nombre de
-- quien compra. El día cerrado lo rechaza sales_guard (CASH_DAY_CLOSED).
-- p_payments: [{"method":"cash"|"nequi"|"transfer"|"card","amount":50000}]
create or replace function sell_gift_card(p_business_id uuid, p_amount int, p_buyer_phone text,
                                          p_buyer_name text, p_recipient_name text, p_payments jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_today date := business_day_bogota(now());
  v_buyer uuid;
  v_recipient text := nullif(trim(coalesce(p_recipient_name, '')), '');
  v_paid int := 0;
  pay jsonb;
  v_code text;
  s sales%rowtype;
  g gift_cards%rowtype;
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_amount is null or p_amount < 10000 or p_amount > 500000 or p_amount % 1000 <> 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0004';
  end if;
  if v_recipient is not null and length(v_recipient) > 40 then
    raise exception 'INVALID_NAME' using errcode = 'P0004';
  end if;
  for pay in select * from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) loop
    if pay ->> 'method' = 'gift_card' then
      raise exception 'INVALID_PAYMENT' using errcode = 'P0004';   -- REQ-057.7
    end if;
    v_paid := v_paid + (pay ->> 'amount')::int;
  end loop;
  if v_paid <> p_amount then
    raise exception 'PAYMENTS_MISMATCH' using errcode = 'P0004';
  end if;
  v_buyer := membership_customer(p_business_id, p_buyer_phone, p_buyer_name); -- INVALID_PHONE

  loop
    v_code := gift_card_new_code();
    exit when not exists (select 1 from gift_cards where business_id = p_business_id and code = v_code);
  end loop;

  insert into sales (business_id, business_day, customer_id, services_total, products_total, gift_card_total,
                     total, created_by)
  values (p_business_id, v_today, v_buyer, 0, 0, p_amount, p_amount, auth.uid())
  returning * into s;

  insert into gift_cards (business_id, code, sale_id, buyer_customer_id, recipient_name, amount, sold_on,
                          expires_on, created_by)
  values (p_business_id, v_code, s.id, v_buyer, v_recipient, p_amount, s.business_day,
          (s.business_day + interval '1 year')::date, auth.uid())
  returning * into g;

  insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total)
  values (p_business_id, s.id, 'gift_card', g.id, 'Tarjeta de regalo', 1, p_amount, 0, p_amount);

  insert into sale_payments (business_id, sale_id, method, amount)
  select p_business_id, s.id, (p ->> 'method')::payment_method, (p ->> 'amount')::int
  from jsonb_array_elements(coalesce(p_payments, '[]'::jsonb)) p
  where (p ->> 'amount')::int > 0;

  return jsonb_build_object('saleId', s.id, 'giftCardId', g.id, 'code', g.code, 'token', g.token,
                            'expiresOn', g.expires_on);
end $$;

-- REQ-057.1 el personal escribe el código en el cobro y ve saldo y vencimiento (sin el comprador)
create or replace function gift_card_lookup(p_business_id uuid, p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  g gift_cards%rowtype;
begin
  if auth.uid() is not null and not is_member_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  select * into g from gift_cards where business_id = p_business_id and code = gift_card_normalize_code(p_code);
  if not found then
    return null;
  end if;
  return jsonb_build_object('giftCardId', g.id, 'code', g.code, 'recipientName', g.recipient_name,
                            'balance', gift_card_balance(g.id), 'expiresOn', g.expires_on,
                            'status', gift_card_state(g.id));
end $$;

-- REQ-059.3 lista del dueño, las más nuevas primero
create or replace function gift_cards_list(p_business_id uuid)
returns table (id uuid, code text, recipient_name text, buyer_name text, buyer_phone text, amount int,
               balance int, sold_on date, expires_on date, status text, token text)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is not null and not is_owner_of(p_business_id) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return query
  select g.id, g.code, g.recipient_name, c.name, c.phone_e164, g.amount, gift_card_balance(g.id),
         g.sold_on, g.expires_on, gift_card_state(g.id), g.token
  from gift_cards g join customers c on c.id = g.buyer_customer_id
  where g.business_id = p_business_id
  order by g.created_at desc;
end $$;

-- REQ-056.2 / REQ-056.3 página pública: sin comprador ni ventas. Solo service_role (ADR-009).
create or replace function get_gift_card_by_token(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('businessName', b.name, 'slug', b.slug, 'recipientName', g.recipient_name,
                            'code', g.code, 'amount', g.amount, 'balance', gift_card_balance(g.id),
                            'expiresOn', g.expires_on, 'status', gift_card_state(g.id))
  from gift_cards g join businesses b on b.id = g.business_id
  where g.token = p_token
$$;

-- merge_customers no se redefine: hoy ya no puede fusionar una ficha con ventas (al borrarla, la FK
-- de sales.customer_id intenta cambiar la venta y sales_guard lo rechaza con SALE_IMMUTABLE), y
-- quien compra una tarjeta siempre tiene la venta. Cuando se arregle eso, mover también
-- gift_cards.buyer_customer_id (nota en design.md §15.1).

-- ---------------------------------------------------- permisos ADR-019 ----
revoke execute on function
  gift_card_new_code(),
  gift_card_normalize_code(text),
  gift_card_balance(uuid),
  gift_card_state(uuid, date),
  sell_gift_card(uuid, int, text, text, text, jsonb),
  gift_card_lookup(uuid, text),
  gift_cards_list(uuid),
  get_gift_card_by_token(text)
from public, anon, authenticated;
grant execute on function
  gift_card_new_code(),
  gift_card_normalize_code(text),
  gift_card_balance(uuid),
  gift_card_state(uuid, date),
  sell_gift_card(uuid, int, text, text, text, jsonb),
  gift_card_lookup(uuid, text),
  gift_cards_list(uuid),
  get_gift_card_by_token(text)
to service_role;
-- Personal (cada una valida el negocio por dentro): vender y listar el dueño, consultar cualquiera
grant execute on function
  sell_gift_card(uuid, int, text, text, text, jsonb),
  gift_card_lookup(uuid, text),
  gift_cards_list(uuid)
to authenticated;
