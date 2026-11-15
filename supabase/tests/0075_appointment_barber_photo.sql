-- T-226 · "Mi cita" con la foto del barbero (REQ-085.5, design §26.1)
begin;
select plan(3);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan
from businesses z where z.slug = 'la-33';

insert into appointments (business_id, customer_name, customer_phone_e164, service_id, service_name,
  service_duration_min, service_price, barber_id, starts_at, ends_at, business_day, source, public_token)
select biz, 'Foto E2E', '+573009990001', corte, 'Corte', 30, 25000, juan,
       '2030-01-10 15:00-05', '2030-01-10 15:30-05', '2030-01-10', 'public', 'tok-foto-0075-abcd'
from ctx;

select is(get_appointment_by_token('tok-foto-0075-abcd') -> 'barberPhoto', 'null'::jsonb,
  'REQ-085.4 sin foto, Mi cita recibe barberPhoto null (las iniciales)');

update barbers set photo_path = (select biz from ctx)::text || '/barbers/' || (select juan from ctx)::text
  || '/22222222-2222-4222-8222-222222222222.webp' where id = (select juan from ctx);

select is(get_appointment_by_token('tok-foto-0075-abcd') ->> 'barberPhoto',
  (select biz from ctx)::text || '/barbers/' || (select juan from ctx)::text
    || '/22222222-2222-4222-8222-222222222222.webp',
  'REQ-085.5 Mi cita recibe la foto del barbero de la cita');

select is(get_appointment_by_token('tok-foto-0075-abcd') ->> 'barberName', 'Juan',
  'REQ-085.5 Mi cita sigue trayendo el nombre del barbero');

select * from finish();
rollback;
