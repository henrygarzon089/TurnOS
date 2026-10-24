-- T-046 · Cierre de caja y reapertura (REQ-027.2–27.5) · ejemplo de cierre de design.md §5.2
begin;
select plan(20);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Corte + barba') as corte_barba,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from products p where p.business_id = z.id and p.name = 'Helado') as helado,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from customers c where c.business_id = z.id order by c.phone_e164 limit 1) as cliente,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update barbers set commission_pct = 60 where id = (select juan from ctx);
update barbers set commission_pct = 50 where id = (select pedro from ctx);
update loyalty_programs set enabled = true, reward_type = 'free_service', reward_service_id = (select corte from ctx)
 where business_id = (select biz from ctx);
delete from loyalty_cards where customer_id = (select cliente from ctx) and status in ('active', 'completed');
insert into loyalty_cards (business_id, customer_id, stamps, status, completed_at)
values ((select biz from ctx), (select cliente from ctx), 10, 'completed', now());

create or replace function _items(variadic p jsonb[]) returns jsonb language sql as $$ select to_jsonb(p) $$;
create or replace function _pay(m text, a int) returns jsonb language sql as $$
  select case when a = 0 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('method', m, 'amount', a)) end
$$;
create or replace function _s(id uuid) returns jsonb language sql as $$ select jsonb_build_object('kind', 'service', 'ref_id', id, 'qty', 1) $$;
create or replace function _p(id uuid) returns jsonb language sql as $$ select jsonb_build_object('kind', 'product', 'ref_id', id, 'qty', 1) $$;

select register_sale((select biz from ctx), null, (select juan from ctx), _items(_s((select corte from ctx))), _pay('nequi', 25000));
select register_sale((select biz from ctx), null, (select juan from ctx), _items(_s((select corte from ctx)), _p((select gaseosa from ctx))), _pay('cash', 29000));
select register_sale((select biz from ctx), null, (select pedro from ctx), _items(_s((select corte_barba from ctx))), _pay('card', 40000));
select register_sale((select biz from ctx), null, (select pedro from ctx),
  _items(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1, 'is_reward', true), _p((select helado from ctx))),
  _pay('cash', 3000), (select cliente from ctx));

-- Solo el dueño cierra
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select close_cash_day((select biz from ctx), null, 30000) $$, '42501', null, 'REQ-027.2 el barbero no cierra la caja');
select auth.test_logout();

select auth.test_login((select owner_u from ctx));
select throws_ok($$ select close_cash_day((select biz from ctx), null, -1) $$, 'P0004', null, 'REQ-027.2 el efectivo contado es un entero ≥ 0');
select throws_ok($$ select close_cash_day((select biz from ctx), business_day_bogota(now()) + 1, 0) $$, 'P0004', null,
  'REQ-027.5 no se cierra un día que no ha llegado');
create temp table c1 as select * from close_cash_day((select biz from ctx), null, 30000);
grant select on c1 to public;
select is((select cash_expected from c1), 32000, 'REQ-027.2 efectivo esperado 32.000 (ejemplo de cierre)');
select is((select difference from c1), -2000, 'REQ-027.2 contó 30.000 → diferencia −2.000');
select is((select closed_by from c1), (select owner_u from ctx), 'REQ-027.2 guarda quién cerró');
select isnt((select closed_at from c1), null, 'REQ-027.2 guarda la hora');
select is((select (totals ->> 'total')::int from c1), 97000, 'REQ-027.2 la foto guarda el total 97.000');
select is((select (totals -> 'byMethod' ->> 'card')::int from c1), 40000, 'REQ-027.2 la foto guarda los totales por medio');
select results_eq(
  $$ select b ->> 'name', (b ->> 'commission')::int from c1, jsonb_array_elements(totals -> 'barbers') b order by 1 $$,
  $$ values ('Juan'::text, 30000), ('Pedro'::text, 32500) $$, 'REQ-027.2 la foto guarda la comisión por barbero');
select ok((select totals ? 'sales' from c1) = false, 'REQ-027.2 la foto no repite el detalle de ventas');
select throws_ok($$ select close_cash_day((select biz from ctx), null, 30000) $$, 'P0004', null, 'REQ-027.3 un día ya cerrado no se vuelve a cerrar');

-- REQ-027.3 día cerrado: bloquea ventas y anulaciones
select throws_ok($$ select register_sale((select biz from ctx), null, (select juan from ctx), _items(_s((select corte from ctx))), _pay('cash', 25000)) $$,
  'P0009', null, 'REQ-027.3 con la caja cerrada no se registran ventas del día');
select throws_ok($$ select void_sale((select id from sales where business_id = (select biz from ctx) and status = 'active' limit 1), 'x') $$,
  'P0009', null, 'REQ-026.2 con la caja cerrada no se anulan ventas del día');
select is((cash_day_summary((select biz from ctx)) -> 'closure' ->> 'difference')::int, -2000, 'REQ-027.3 la caja del día muestra el cierre');

-- Reabrir con motivo
select throws_ok($$ select reopen_cash_day((select biz from ctx), null, ' ') $$, 'P0004', null, 'REQ-027.3 reabrir exige motivo');
select lives_ok($$ select reopen_cash_day((select biz from ctx), null, 'Faltó registrar un helado') $$, 'REQ-027.3 el dueño reabre con motivo');
select is((select status::text || ':' || reopen_reason from cash_closures where id = (select id from c1)), 'voided:Faltó registrar un helado',
  'REQ-027.3 el cierre anterior queda anulado con su motivo');
select lives_ok($$ select register_sale((select biz from ctx), null, null, _items(_p((select helado from ctx))), _pay('cash', 3000)) $$,
  'REQ-027.3 reabierta, se puede vender otra vez');
select is((select cash_expected from close_cash_day((select biz from ctx), null, 35000)), 35000,
  'REQ-027.3 el nuevo cierre incluye la venta posterior');
select auth.test_logout();

select * from finish();
rollback;
