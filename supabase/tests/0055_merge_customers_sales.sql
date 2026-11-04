-- pgTAP · fusionar fichas con ventas (REQ-018.5, ADR-005, ADR-016)
-- Antes de 0055 el delete de la ficha fusionada disparaba `on delete set null` en sales.customer_id
-- y sales_guard lo rechazaba con SALE_IMMUTABLE: no se podía fusionar a nadie que hubiera pagado.
begin;
select plan(9);

create temp table ctx as
select b.id as biz from businesses b where b.slug = 'la-33';
grant select on ctx to public;

insert into customers (business_id, phone_e164, name)
select biz, '+573009980001', 'Queda' from ctx;
insert into customers (business_id, phone_e164, name)
select biz, '+573009980002', 'Se fusiona' from ctx;

-- Tres ventas de la ficha que se fusiona: activa, anulada y de un día con cierre activo
create or replace function _sale(p_day date) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into sales (business_id, business_day, customer_id, services_total, products_total, discount_total, total,
                     commission_pct, commission_base, commission_amount, business_amount, created_by)
  values ((select biz from ctx), p_day, (select id from customers where phone_e164 = '+573009980002'),
          0, 8000, 0, 8000, 0, 0, 0, 0, null)
  returning id into v;
  insert into sale_payments (business_id, sale_id, method, amount) values ((select biz from ctx), v, 'cash', 8000);
  return v;
end $$;
create temp table s as
select _sale(current_date) as activa,
       _sale(current_date) as anulada,
       _sale(current_date - 3) as cerrada;
grant select on s to public;
update sales set status = 'voided', voided_reason = 'prueba', voided_by = gen_random_uuid(), voided_at = now()
 where id = (select anulada from s);
insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
select biz, current_date - 3, '{}'::jsonb, 8000, 8000, 0, gen_random_uuid() from ctx;

-- Fuera de una fusión, las ventas siguen sin poder cambiar de cliente
select throws_ok(
  $$ update sales set customer_id = (select id from customers where phone_e164 = '+573009980001')
      where id = (select activa from s) $$,
  'P0004', 'SALE_IMMUTABLE',
  'REQ-026.1 una venta no cambia de cliente fuera de una fusión');

select lives_ok(
  $$ select merge_customers((select id from customers where phone_e164 = '+573009980001'),
                            (select id from customers where phone_e164 = '+573009980002')) $$,
  'REQ-018.5 se fusiona una ficha que tiene ventas');

select is((select count(*)::int from sales
            where customer_id = (select id from customers where phone_e164 = '+573009980001')),
          3, 'REQ-018.5 las ventas de la ficha fusionada pasan a la que queda');

select results_eq(
  $$ select status::text, total from sales where id = (select anulada from s) $$,
  $$ values ('voided', 8000) $$,
  'REQ-018.5 la venta anulada pasa sin cambiar estado ni monto');

select is((select customer_id from sales where id = (select cerrada from s)),
          (select id from customers where phone_e164 = '+573009980001'),
          'REQ-018.5 la venta de un día cerrado también pasa');

select is((select count(*)::int from cash_closures
            where business_id = (select biz from ctx) and business_day = current_date - 3 and status = 'active'),
          1, 'REQ-026.2 el cierre de ese día sigue activo');

select is((select count(*)::int from customers where phone_e164 = '+573009980002'),
          0, 'REQ-018.5 la ficha fusionada se borra');

-- El permiso interno solo cubre customer_id
select throws_ok(
  $$ select set_config('turnos.internal', '1', true);
     update sales set total = 1, products_total = 1 where id = (select activa from s) $$,
  'P0004', 'SALE_IMMUTABLE',
  'REQ-026.1 el permiso de la fusión no deja cambiar montos');

select throws_ok(
  $$ select set_config('turnos.internal', '1', true);
     update sales set customer_id = null where id = (select activa from s) $$,
  'P0004', 'SALE_IMMUTABLE',
  'REQ-026.1 el permiso de la fusión no deja quitar el cliente');

select * from finish();
rollback;
