-- T-048 · Resumen semanal y ocupación (REQ-028.1–28.4, REQ-021.1) · design.md §5.3
-- Semana fija pasada: lunes 2024-03-04 a domingo 2024-03-10 (America/Bogota).
begin;
select plan(17);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       date '2024-03-04' as wk
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- Ejemplo de §5.3: 6 días × 11 h de apertura × 5 sillas = 19.800 min-silla
update businesses set chairs_count = 5 where id = (select biz from ctx);
update business_hours set opens_at = '09:00', closes_at = '20:00', is_closed = (weekday = 0) where business_id = (select biz from ctx);
delete from barber_status_events where business_id = (select biz from ctx)
  and at >= (date '2024-02-25')::timestamp at time zone 'America/Bogota'
  and at < (date '2024-03-17')::timestamp at time zone 'America/Bogota';
-- Juan y Pedro atienden de 9:00 a 20:00 lunes a sábado: 2 × 6 × 660 = 7.920 min
insert into barber_status_events (business_id, barber_id, status, at)
select (select biz from ctx), b, s::barber_status,
       ((select wk from ctx) + d)::timestamp at time zone 'America/Bogota' + t
from unnest(array[(select juan from ctx), (select pedro from ctx)]) b,
     generate_series(0, 5) d,
     (values ('busy', interval '9 hours'), ('available', interval '20 hours')) e(s, t);

-- Clientes: 2 nuevos (primera visita en la semana) y 1 que repite (venía de antes)
insert into customers (business_id, phone_e164, name, first_visit_at, last_visit_at, visits_count) values
  ((select biz from ctx), '+573005640001', 'Nuevo Uno', '2024-03-05 15:00-05', '2024-03-05 15:00-05', 1),
  ((select biz from ctx), '+573005640002', 'Nuevo Dos', '2024-03-09 10:00-05', '2024-03-09 10:00-05', 1),
  ((select biz from ctx), '+573005640003', 'Repite', '2023-11-01 10:00-05', '2024-03-06 10:00-05', 4);
-- Turnos de la semana: 3 terminados (uno por cliente), 1 no llegó, 1 cancelado
insert into tickets (business_id, business_day, customer_id, customer_name, customer_phone_e164, service_id, assigned_barber_id,
                     status, created_at, finished_at, cancel_reason, source)
select (select biz from ctx), d, c.id, c.name, c.phone_e164, (select corte from ctx), (select juan from ctx),
       st::ticket_status, d + time '10:00', case when st = 'done' then d + time '10:30' end,
       case when st = 'cancelled' then 'customer'::cancel_reason end, 'qr'
from (values ('+573005640001', date '2024-03-05', 'done'), ('+573005640002', date '2024-03-09', 'done'),
             ('+573005640003', date '2024-03-06', 'done'), ('+573005640003', date '2024-03-07', 'no_show'),
             ('+573005640001', date '2024-03-08', 'cancelled')) v(phone, d, st)
join customers c on c.phone_e164 = v.phone;
-- Ventas de la semana (Juan 60 %): 2 cortes; una anulada no cuenta
insert into sales (business_id, business_day, barber_id, services_total, products_total, discount_total, total,
                   commission_pct, commission_base, commission_amount, business_amount, status, voided_reason, voided_by, voided_at)
values ((select biz from ctx), '2024-03-05', (select juan from ctx), 25000, 0, 0, 25000, 60, 25000, 15000, 10000, 'active', null, null, null),
       ((select biz from ctx), '2024-03-06', (select juan from ctx), 25000, 4000, 0, 29000, 60, 25000, 15000, 10000, 'active', null, null, null),
       ((select biz from ctx), '2024-03-07', (select juan from ctx), 25000, 0, 0, 25000, 60, 25000, 15000, 10000, 'voided', 'x',
        (select owner_u from ctx), now());
insert into sale_items (business_id, sale_id, kind, ref_id, name, qty, unit_price, discount, line_total)
select (select biz from ctx), s.id, 'service', (select corte from ctx), 'Corte', 1, 25000, 0, 25000
from sales s where s.business_id = (select biz from ctx) and s.business_day between '2024-03-04' and '2024-03-10';
insert into sale_payments (business_id, sale_id, method, amount)
select (select biz from ctx), s.id, 'cash', s.total
from sales s where s.business_id = (select biz from ctx) and s.business_day between '2024-03-04' and '2024-03-10';
set constraints all immediate;
set constraints all deferred;

create temp table w as select weekly_summary((select biz from ctx), (select wk from ctx)) as j;
grant select on w to public;

select is((select (j ->> 'openMinutes')::int from w), 3960, 'REQ-028.2 minutos de apertura de la semana: 6 × 11 h = 3.960');
select is((select (j ->> 'chairs')::int from w), 5, 'REQ-028.2 número de sillas');
select is((select (j ->> 'busyMinutes')::int from w), 7920, 'REQ-028.2 minutos en servicio del historial de estados: 7.920');
select is((select (j ->> 'occupancyPct')::numeric from w), 40.0, 'REQ-028.2 ocupación del ejemplo de §5.3: 40 %');
select is((select (d ->> 'occupancyPct')::numeric from w, jsonb_array_elements(j -> 'days') d where d ->> 'day' = '2024-03-04'), 40.0,
  'REQ-028.2 detalle por día: lunes 2 × 660 ÷ (660 × 5) = 40 %');
select is((select (d ->> 'occupancyPct')::numeric from w, jsonb_array_elements(j -> 'days') d where d ->> 'day' = '2024-03-10'), 0.0,
  'REQ-028.2 el domingo cerrado no suma');
select is((select (b ->> 'occupancyPct')::numeric from w, jsonb_array_elements(j -> 'barbers') b where b ->> 'name' = 'Juan'), 100.0,
  'REQ-028.2 detalle por barbero: Juan atendió todas las horas de apertura');
select is((select (b ->> 'busyMinutes')::int from w, jsonb_array_elements(j -> 'barbers') b where b ->> 'name' = 'Luis'), 0,
  'REQ-028.2 un barbero sin servicios tiene 0 min');
select is((select (j ->> 'newCustomers')::int from w), 2, 'REQ-021.1 clientes nuevos de la semana: 2');
select is((select (j ->> 'repeatCustomers')::int from w), 1, 'REQ-021.1 clientes que repiten: 1');
select is((select (j ->> 'lostTickets')::int from w), 2, 'REQ-028.4 turnos perdidos (no llegó + cancelado): 2');
select is((select (j ->> 'services')::int from w), 2, 'REQ-028.1 servicios de la semana (sin la venta anulada)');
select is((select (j ->> 'sold')::int from w), 54000, 'REQ-028.1 total vendido 54.000');
select results_eq($$ select b ->> 'name', (b ->> 'services')::int, (b ->> 'sold')::int, (b ->> 'commission')::int
                     from w, jsonb_array_elements(j -> 'barbers') b where b ->> 'name' = 'Juan' $$,
  $$ values ('Juan'::text, 2, 50000, 30000) $$, 'REQ-028.1 total por barbero');
select is((select j ->> 'weekStart' from w), '2024-03-04', 'REQ-028.1 semana de lunes a domingo (PA-21)');
select is((weekly_summary((select biz from ctx), date '2024-03-06') ->> 'weekStart'), '2024-03-04',
  'REQ-028.1 cualquier día de la semana devuelve su lunes');

select auth.test_login((select juan_u from ctx));
select throws_ok($$ select weekly_summary((select biz from ctx), (select wk from ctx)) $$, '42501', null,
  'REQ-029.1 el barbero no ve el resumen del negocio');
select auth.test_logout();

select * from finish();
rollback;
