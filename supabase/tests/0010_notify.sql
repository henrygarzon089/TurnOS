begin;
select plan(3);
create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
select '50000000-0000-0000-0000-000000000001', biz, 'Aviso', '+573005557001', corte from ctx;
select auth.test_login((select juan_u from ctx));
select isnt((select notified_at from mark_ticket_notified('50000000-0000-0000-0000-000000000001')), null,
  'REQ-009.3 registra la hora del aviso');
select is((select notified_by from tickets where id = '50000000-0000-0000-0000-000000000001'), (select juan_u from ctx),
  'REQ-009.3 registra quién avisó');
select is((select count(*)::int from ticket_events where ticket_id = '50000000-0000-0000-0000-000000000001' and reason = 'notified'), 1,
  'REQ-007.7 evento notified');
select auth.test_logout();
select * from finish();
rollback;
