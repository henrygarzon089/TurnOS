-- T-045 · Caja de hoy: cash_day_summary (REQ-027.1, REQ-026.1) · ejemplo de design.md §5.2 exacto
begin;
select plan(18);

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
update loyalty_cards set status = 'completed', stamps = 10, completed_at = now()
 where customer_id = (select cliente from ctx) and status in ('active', 'completed');
insert into loyalty_cards (business_id, customer_id, stamps, status, completed_at)
select (select biz from ctx), (select cliente from ctx), 10, 'completed', now()
where not exists (select 1 from loyalty_cards where customer_id = (select cliente from ctx) and status = 'completed');

create or replace function _items(variadic p jsonb[]) returns jsonb language sql as $$ select to_jsonb(p) $$;
create or replace function _pay(m text, a int) returns jsonb language sql as $$
  select case when a = 0 then '[]'::jsonb else jsonb_build_array(jsonb_build_object('method', m, 'amount', a)) end
$$;
create or replace function _s(id uuid) returns jsonb language sql as $$ select jsonb_build_object('kind', 'service', 'ref_id', id, 'qty', 1) $$;
create or replace function _p(id uuid) returns jsonb language sql as $$ select jsonb_build_object('kind', 'product', 'ref_id', id, 'qty', 1) $$;

-- Las 4 ventas del ejemplo de cierre (design.md §5.2)
select register_sale((select biz from ctx), null, (select juan from ctx), _items(_s((select corte from ctx))), _pay('nequi', 25000));
select register_sale((select biz from ctx), null, (select juan from ctx), _items(_s((select corte from ctx)), _p((select gaseosa from ctx))), _pay('cash', 29000));
select register_sale((select biz from ctx), null, (select pedro from ctx), _items(_s((select corte_barba from ctx))), _pay('card', 40000));
select register_sale((select biz from ctx), null, (select pedro from ctx),
  _items(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1, 'is_reward', true), _p((select helado from ctx))),
  _pay('cash', 3000), (select cliente from ctx));
-- Una venta anulada no cuenta (REQ-026.1)
create temp table anulada as
select (register_sale((select biz from ctx), null, (select juan from ctx), _items(_s((select corte from ctx))), _pay('transfer', 25000))).id;
grant select on anulada to public;
select auth.test_login((select owner_u from ctx));
select void_sale((select id from anulada), 'Cobrada dos veces');
select auth.test_logout();

create temp table r as select cash_day_summary((select biz from ctx)) as j;
grant select on r to public;

select is((select (j -> 'byMethod' ->> 'cash')::int from r), 32000, 'REQ-027.1 efectivo 32.000');
select is((select (j -> 'byMethod' ->> 'nequi')::int from r), 25000, 'REQ-027.1 Nequi 25.000');
select is((select (j -> 'byMethod' ->> 'transfer')::int from r), 0, 'REQ-026.1 la transferencia anulada no suma');
select is((select (j -> 'byMethod' ->> 'card')::int from r), 40000, 'REQ-027.1 tarjeta 40.000');
select is((select (j ->> 'total')::int from r), 97000, 'REQ-027.1 total vendido 97.000');
select is((select (j ->> 'services')::int from r), 90000, 'REQ-027.1 servicios 90.000');
select is((select (j ->> 'products')::int from r), 7000, 'REQ-027.1 productos 7.000');
select is((select (j ->> 'rewards')::int from r), 25000, 'REQ-027.1 premios de fidelidad 25.000');
select is((select (j ->> 'cashExpected')::int from r), 32000, 'REQ-027.2 efectivo esperado 32.000');
select results_eq(
  $$ select b ->> 'name', (b ->> 'services')::int, (b ->> 'sold')::int, (b ->> 'commission')::int, (b ->> 'business')::int
     from r, jsonb_array_elements(j -> 'barbers') b order by b ->> 'name' $$,
  $$ values ('Juan'::text, 2, 50000, 30000, 20000), ('Pedro'::text, 2, 40000, 32500, 32500) $$,
  'REQ-027.1 por barbero: Juan 2 servicios $ 50.000 comisión 30.000; Pedro 2, $ 40.000, 32.500');
select is((select jsonb_array_length(j -> 'sales') from r), 5, 'REQ-026.1 el detalle muestra todas las ventas, también la anulada');
select is((select s ->> 'status' from r, jsonb_array_elements(j -> 'sales') s where s ->> 'id' = (select id::text from anulada)), 'voided',
  'REQ-026.1 la anulada queda visible como anulada');
select is((select s ->> 'voidedReason' from r, jsonb_array_elements(j -> 'sales') s where s ->> 'id' = (select id::text from anulada)), 'Cobrada dos veces',
  'REQ-026.1 con su motivo');
select is((select s ->> 'methods' from r, jsonb_array_elements(j -> 'sales') s where (s ->> 'total')::int = 29000), 'Efectivo',
  'REQ-027.1 cada venta muestra su medio de pago');
select is((select s ->> 'items' from r, jsonb_array_elements(j -> 'sales') s where (s ->> 'total')::int = 29000), 'Corte, Gaseosa',
  'REQ-027.1 cada venta muestra lo vendido');
select is((select (cash_day_summary((select biz from ctx), business_day_bogota(now()) - 1) ->> 'total')::int), 0, 'REQ-027.5 otro día no mezcla ventas');

select auth.test_login((select juan_u from ctx));
select throws_ok($$ select cash_day_summary((select biz from ctx)) $$, '42501', null, 'REQ-029.1 el barbero no ve la caja del negocio');
select auth.test_logout();

-- "En vivo" (ADR-008): cada venta avisa por el canal del negocio, sin datos personales
select ok((select count(*) from realtime.messages_local
           where topic = 'queue:' || (select biz from ctx)::text and payload ->> 'kind' = 'sale') >= 5,
  'REQ-027.1 cada venta avisa al canal del negocio para refrescar la caja');

select * from finish();
rollback;
