-- pgTAP · fusionar fichas conserva el cumpleaños (T-060, REQ-037.1, REQ-018.5)
begin;
select plan(3);

insert into customers (business_id, phone_e164, name, birthday_month, birthday_day)
select id, '+573009990001', 'Sin cumple', null, null from businesses where slug = 'la-33';
insert into customers (business_id, phone_e164, name, birthday_month, birthday_day)
select id, '+573009990002', 'Con cumple', 2, 29 from businesses where slug = 'la-33';
insert into customers (business_id, phone_e164, name, birthday_month, birthday_day)
select id, '+573009990003', 'Otro cumple', 7, 15 from businesses where slug = 'la-33';
insert into customers (business_id, phone_e164, name, birthday_month, birthday_day)
select id, '+573009990004', 'Sin cumple dos', null, null from businesses where slug = 'la-33';

select merge_customers((select id from customers where phone_e164 = '+573009990001'),
                       (select id from customers where phone_e164 = '+573009990002'));
select results_eq(
  $$ select birthday_month::int, birthday_day::int from customers where phone_e164 = '+573009990001' $$,
  $$ values (2, 29) $$,
  'REQ-037.1 la ficha que queda toma el cumpleaños de la fusionada si no tenía');

select merge_customers((select id from customers where phone_e164 = '+573009990001'),
                       (select id from customers where phone_e164 = '+573009990003'));
select results_eq(
  $$ select birthday_month::int, birthday_day::int from customers where phone_e164 = '+573009990001' $$,
  $$ values (2, 29) $$,
  'REQ-037.1 la ficha que queda conserva su cumpleaños si ya tenía');

select merge_customers((select id from customers where phone_e164 = '+573009990004'),
                       (select id from customers where phone_e164 = '+573009990001'));
select results_eq(
  $$ select birthday_month::int, birthday_day::int from customers where phone_e164 = '+573009990004' $$,
  $$ values (2, 29) $$,
  'REQ-037.1 el cumpleaños sigue pasando en una segunda fusión');

select * from finish();
rollback;
