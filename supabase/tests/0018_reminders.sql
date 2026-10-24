-- T-037 · Clientes para recordar (REQ-020.1–20.5)
begin;
select plan(12);

create temp table ctx as
select z.id as biz, 'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

select is((select inactive_days from businesses where id = (select biz from ctx)), 21, 'REQ-020.1 N por defecto = 21 días');

-- Escenario propio y controlado: sacamos al seed de la lista
update customers set last_visit_at = now() where business_id = (select biz from ctx);
insert into customers (business_id, phone_e164, name, visits_count, last_visit_at) values
  ((select biz from ctx), '+573005610001', 'Hace Cuarenta', 4, now() - interval '40 days'),
  ((select biz from ctx), '+573005610002', 'Hace Treinta', 2, now() - interval '30 days'),
  ((select biz from ctx), '+573005610003', 'Hace Diez', 6, now() - interval '10 days'),
  ((select biz from ctx), '+573005610004', 'Nunca Terminó', 0, null),
  ((select biz from ctx), '+573005610005', 'Justo Veintiuno', 3, now() - interval '21 days 2 hours');

select auth.test_login((select owner_u from ctx));
select results_eq($$ select name from inactive_customers((select biz from ctx)) $$,
  $$ values ('Hace Cuarenta'::text), ('Hace Treinta'::text) $$,
  'REQ-020.2 solo > N días y con visitas, los que llevan más tiempo primero');
select ok(not exists (select 1 from inactive_customers((select biz from ctx)) where name = 'Justo Veintiuno'),
  'REQ-020.2 hace exactamente 21 días (en días del negocio) no es "más de 21"');
select is((select days_since from inactive_customers((select biz from ctx)) where name = 'Hace Cuarenta'), 40,
  'REQ-020.2 muestra los días sin venir');
select is((select visits_count from inactive_customers((select biz from ctx)) where name = 'Hace Treinta'), 2,
  'REQ-020.2 muestra las visitas totales');

-- REQ-020.1 cambiar N
update businesses set inactive_days = 35 where id = (select biz from ctx);
select results_eq($$ select name from inactive_customers((select biz from ctx)) $$,
  $$ values ('Hace Cuarenta'::text) $$, 'REQ-020.1 con N = 35 cambia la lista');
update businesses set inactive_days = 21 where id = (select biz from ctx);

-- REQ-020.4 registrar el envío con quién lo envió; excluido 7 días
insert into reminders (business_id, customer_id, sent_by)
select (select biz from ctx), id, auth.uid() from customers where phone_e164 = '+573005610001';
select is((select sent_by from reminders r join customers c on c.id = r.customer_id where c.phone_e164 = '+573005610001'),
  (select owner_u from ctx), 'REQ-020.4 registra quién envió el recordatorio');
select ok(not exists (select 1 from inactive_customers((select biz from ctx)) where name = 'Hace Cuarenta'),
  'REQ-020.4 recién recordado sale de la lista');
-- Reloj simulado: el recordatorio fue hace 8 días → vuelve a aparecer
update reminders set sent_at = now() - interval '8 days'
 where customer_id = (select id from customers where phone_e164 = '+573005610001');
select ok(exists (select 1 from inactive_customers((select biz from ctx)) where name = 'Hace Cuarenta'),
  'REQ-020.4 a los 8 días vuelve a la lista');

-- REQ-020.5 No contactar
update customers set do_not_contact = true where phone_e164 = '+573005610002';
select ok(not exists (select 1 from inactive_customers((select biz from ctx)) where name = 'Hace Treinta'),
  'REQ-020.5 "No contactar" lo excluye permanentemente');
select auth.test_logout();

-- El barbero no ve la lista ni registra recordatorios
select auth.test_login((select juan_u from ctx));
select throws_ok($$ insert into reminders (business_id, customer_id) select (select biz from ctx), id from customers where phone_e164 = '+573005610003' $$,
  '42501', null, 'REQ-020.4 el barbero no registra recordatorios');
select is((select count(*)::int from reminders), 0, 'REQ-020.2 el barbero no ve los recordatorios');
select auth.test_logout();

select * from finish();
rollback;
