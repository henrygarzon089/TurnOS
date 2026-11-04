-- pgTAP · la cita no bloquea fusionar ni borrar la ficha del cliente (REQ-018.5, REQ-050.2, ADR-033)
-- La cita guarda nombre y celular propios: si la ficha se fusiona o se borra, la cita sigue.
begin;
select plan(5);

create temp table ctx as
select b.id as biz,
       (select id from barbers where business_id = b.id order by sort_order limit 1) as barber,
       (select id from services where business_id = b.id order by sort_order limit 1) as service
  from businesses b where b.slug = 'la-33';
grant select on ctx to public;

insert into customers (business_id, phone_e164, name)
select biz, '+573009970001', 'Queda' from ctx;
insert into customers (business_id, phone_e164, name)
select biz, '+573009970002', 'Se fusiona' from ctx;
insert into customers (business_id, phone_e164, name)
select biz, '+573009970003', 'Se borra' from ctx;

insert into appointments (business_id, customer_id, customer_name, customer_phone_e164, service_id,
                          service_name, service_duration_min, service_price, barber_id, starts_at,
                          ends_at, business_day, source)
select c.biz, cu.id, cu.name, cu.phone_e164, c.service, 'Corte', 20, 25000, c.barber,
       now() + interval '1 day', now() + interval '1 day 20 minutes', current_date + 1, 'owner'
  from ctx c join customers cu on cu.business_id = c.biz
 where cu.phone_e164 in ('+573009970002', '+573009970003');

select lives_ok(
  $$ select merge_customers((select id from customers where phone_e164 = '+573009970001'),
                            (select id from customers where phone_e164 = '+573009970002')) $$,
  'REQ-018.5 se fusiona una ficha que tiene una cita');

select results_eq(
  $$ select status::text, customer_name, customer_id is null from appointments
      where customer_phone_e164 = '+573009970002' $$,
  $$ values ('booked', 'Se fusiona', true) $$,
  'REQ-050.2 la cita sigue pendiente con su nombre y celular');

select lives_ok(
  $$ delete from customers where phone_e164 = '+573009970003' $$,
  'REQ-050.2 se borra una ficha que tiene una cita');

select is((select count(*)::int from appointments where customer_phone_e164 = '+573009970003'),
          1, 'REQ-050.2 la cita de la ficha borrada sigue');

select is((select confdeltype::text from pg_constraint
            where conname = 'appointments_business_id_customer_id_fkey'),
          'n', 'REQ-050.2 la llave a la ficha es on delete set null (solo customer_id)');

select * from finish();
rollback;
