-- T-122 · Inventario: vitrina desde la caja y la cortesía (REQ-072.1–072.4, ADR-039, design.md §18.4,
-- ejemplo Q). register_sale y void_sale no cambian: el gancho son triggers.
begin;
select plan(18);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from products p where p.business_id = z.id and p.name = 'Agua') as agua_p,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa_p,
       (select id from products p where p.business_id = z.id and p.name = 'Tinto') as tinto_p,
       (select id from services s where s.business_id = z.id order by sort_order limit 1) as corte,
       (select id from inventory_locations l where l.business_id = z.id and l.kind = 'shelf') as vitrina
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create temp table ids (k text primary key, v uuid);
grant all on ids to public;

create function pg_temp.shelf(p_item text) returns int language sql as $$
  select coalesce(sum(case when to_location_id = (select vitrina from ctx) then qty else -qty end), 0)::int
  from stock_movements
  where item_id = (select v from ids where k = p_item) and (select vitrina from ctx) in (from_location_id, to_location_id)
$$;
-- Venta solo de productos, en efectivo, sin barbero (REQ-024.2)
create function pg_temp.sell(p_product uuid, p_qty int, p_price int) returns uuid language sql as $$
  select (register_sale((select biz from ctx), null, null,
            jsonb_build_array(jsonb_build_object('kind', 'product', 'ref_id', p_product, 'qty', p_qty)),
            jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', p_qty * p_price)))).id
$$;

select auth.test_login((select owner_u from ctx));
insert into ids select 'agua', save_inventory_item((select biz from ctx), jsonb_build_object('name', 'Agua 600 ml',
  'group', 'for_sale', 'use', 'sale', 'presentation', 'Botella', 'unitLabel', 'botella', 'minQty', 6, 'maxQty', 24,
  'shelfMin', 4, 'productId', (select agua_p from ctx)));
insert into ids select 'tinto', save_inventory_item((select biz from ctx), jsonb_build_object('name', 'Tinto',
  'group', 'for_sale', 'use', 'sale', 'presentation', 'Vaso', 'unitLabel', 'vaso', 'minQty', 0, 'maxQty', 50,
  'productId', (select tinto_p from ctx)));
select register_stock_purchase((select v from ids where k = 'agua'), 10, 1200);
select transfer_stock((select v from ids where k = 'agua'),
                      (select id from inventory_locations where business_id = (select biz from ctx) and kind = 'warehouse'),
                      (select vitrina from ctx), 2);

-- ------------------------------------------------------- ejemplo Q: vender ----
select lives_ok($$ insert into ids select 'venta', pg_temp.sell((select agua_p from ctx), 3, 2500) $$,
  'REQ-072.3 la caja vende aunque la vitrina tenga menos de lo pedido');
select is(pg_temp.shelf('agua'), -1, 'REQ-072.1 la venta descuenta la vitrina (2 − 3)');
select is(pg_temp.shelf('agua'), -1, 'REQ-072.3 y la vitrina queda negativa, para revisar en el conteo');
select ok((select (x ->> 'negative')::boolean from jsonb_array_elements(inventory_overview((select biz from ctx)) -> 'items') x
           where x ->> 'id' = (select v::text from ids where k = 'agua')),
  'REQ-072.3 el resumen la marca en rojo');
select is((select kind::text || ' · ' || qty || ' · ' || (sale_id = (select v from ids where k = 'venta'))::text
                  || ' · ' || (sale_item_id is not null)::text
           from stock_movements where item_id = (select v from ids where k = 'agua') and kind = 'sale'),
  'sale · 3 · true · true', 'REQ-072.1 el movimiento dice qué venta y qué línea lo hizo');
select is((select qty from inventory_stock((select biz from ctx)) s join inventory_locations l on l.id = s.location_id
           where l.kind = 'warehouse' and s.item_id = (select v from ids where k = 'agua')),
  8, 'REQ-072.1 la bodega no se toca: se vende desde la vitrina');

select lives_ok($$ select pg_temp.sell((select gaseosa_p from ctx), 1, 4000) $$,
  'REQ-072.1 un producto sin ítem enlazado se vende igual');
select is((select count(*)::int from stock_movements m join sale_items si on si.id = m.sale_item_id
           where si.ref_id = (select gaseosa_p from ctx)), 0, 'REQ-072.1 y no mueve inventario');
select lives_ok($$ select register_sale((select biz from ctx), null, (select juan from ctx),
                     jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1)),
                     jsonb_build_array(jsonb_build_object('method', 'cash',
                       'amount', (select price from services where id = (select corte from ctx))))) $$,
  'REQ-072.1 un servicio se cobra igual');
select is((select count(*)::int from stock_movements where kind = 'sale' and business_id = (select biz from ctx)), 1,
  'REQ-072.1 solo las líneas de producto mueven la vitrina');

-- ------------------------------------------------------- ejemplo Q: anular ----
select lives_ok($$ select void_sale((select v from ids where k = 'venta'), 'Error de digitación') $$,
  'REQ-072.2 el dueño anula la venta');
select is(pg_temp.shelf('agua'), 2, 'REQ-072.2 lo vendido vuelve a la vitrina');
select throws_ok($$ select void_sale((select v from ids where k = 'venta'), 'Otra vez') $$,
  null, null, 'REQ-072.2 una venta anulada no se anula de nuevo');
select is(pg_temp.shelf('agua'), 2, 'REQ-072.2 y la vitrina no recibe dos veces');
select ok((select pg_get_triggerdef(oid) like '%AFTER UPDATE OF status ON public.sales%'
                  and pg_get_triggerdef(oid) like '%old.status = ''active''%'
                  and pg_get_triggerdef(oid) like '%new.status = ''voided''%'
           from pg_trigger where tgname = 'stock_on_sale_void'),
  'REQ-072.2 solo el paso de activa a anulada mueve stock; ningún otro cambio de la venta');

-- -------------------------------------------------------------- cortesía ----
select auth.test_logout();
insert into ids select 'turno', id from tickets where business_id = (select biz from ctx) order by created_at limit 1;
update tickets set courtesy_product_id = (select tinto_p from ctx), courtesy_served_at = null
where id = (select v from ids where k = 'turno');
select auth.test_login((select owner_u from ctx));
select lives_ok($$ select mark_courtesy_served((select v from ids where k = 'turno')) $$,
  'REQ-072.4 se marca servida la bebida de cortesía');
select is(pg_temp.shelf('tinto'), -1, 'REQ-072.4 la cortesía sale de la vitrina como una venta');
select auth.test_logout();
update tickets set courtesy_served_at = now() + interval '1 minute' where id = (select v from ids where k = 'turno');
select is(pg_temp.shelf('tinto'), -1, 'REQ-072.4 una sola vez por turno');

select * from finish();
rollback;
