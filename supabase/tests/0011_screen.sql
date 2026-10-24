begin;
select plan(7);
select is(short_name('Juan Pérez'), 'Juan P.', 'REQ-013.2 primer nombre + inicial');
select is(short_name('camilo andrés restrepo'), 'Camilo A.', 'REQ-013.2 usa el segundo token como apellido/inicial');
select is(short_name('Sara'), 'Sara', 'REQ-013.2 un solo nombre');
select is(short_name('  ana   maría  '), 'Ana M.', 'REQ-013.2 espacios de más');

create temp table ctx as
select z.id as biz, z.screen_key as key,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte
from businesses z where z.slug = 'la-33';
insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
select biz, 'Camilo Restrepo', '+573005558001', corte from ctx;

select is(get_screen_queue('la-33', 'clave-mala'), null, 'REQ-013.1 clave incorrecta → null');
select is((get_screen_queue('la-33', (select key from ctx))) -> 'anyone' ->> 0, 'Camilo R.', 'REQ-013.2 nombre abreviado en la pantalla');
select is(position('+57300' in (get_screen_queue('la-33', (select key from ctx)))::text), 0, 'P6 la pantalla nunca lleva celulares');
select * from finish();
rollback;
