begin;
select plan(6);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

delete from realtime.messages_local;

insert into tickets (id, business_id, customer_name, customer_phone_e164, service_id)
select '40000000-0000-0000-0000-000000000001', biz, 'RT', '+573005556001', corte from ctx;

select is((select count(*)::int from realtime.messages_local where topic = 'queue:' || (select biz from ctx)), 1,
  'ADR-008 crear un turno emite queue_changed en el canal del negocio');
select is((select payload ->> 'type' from realtime.messages_local limit 1), 'queue_changed', 'ADR-008 tipo del mensaje');
select is((select private from realtime.messages_local limit 1), false, 'ADR-008 canal público (sin datos personales)');
select is((select bool_and(not (payload ? 'customer_name') and not (payload ? 'customer_phone_e164')) from realtime.messages_local), true,
  'REQ-031.2 el payload no lleva datos personales');

delete from realtime.messages_local;
update tickets set notified_at = now() where id = '40000000-0000-0000-0000-000000000001';
select is((select count(*)::int from realtime.messages_local), 0, 'un cambio irrelevante (notified_at) no emite');

update barbers set status = 'paused' where id = (select juan from ctx);
select is((select count(*)::int from realtime.messages_local where payload ->> 'kind' = 'barber'), 1,
  'REQ-006.3 cambio de estado de barbero emite');

select * from finish();
rollback;
