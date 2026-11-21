-- T-320 · Descripción del barbero y menú por categoría en la web (REQ-103, ADR-082, design §35)
begin;
select plan(9);

create temp table ctx as
select z.id as biz,
       (select id from barbers b where b.business_id = z.id and b.is_active order by sort_order limit 1) as barber
from businesses z where z.slug = 'la-33';

select throws_ok($$ update barbers set bio = repeat('a', 201) where id = (select barber from ctx) $$,
  '23514', null, 'REQ-103.3 la descripción del barbero tiene máximo 200 caracteres');
select throws_ok($$ update barbers set bio = '   ' where id = (select barber from ctx) $$,
  '23514', null, 'REQ-103.3 una descripción en blanco no se guarda (va null)');
select lives_ok($$ update barbers set bio = repeat('a', 200) where id = (select barber from ctx) $$,
  'REQ-103.3 200 caracteres sí se guardan');

update barbers set bio = 'Experto en degradados' where id = (select barber from ctx);
select is((select t ->> 'bio' from jsonb_array_elements(get_public_site('la-33') -> 'team') t
           where t ->> 'id' = (select barber::text from ctx)),
  'Experto en degradados', 'REQ-103.4 la web trae la descripción del barbero');
select ok(get_public_site('la-33')::text !~ '\+57' and not (get_public_site('la-33') -> 'team' -> 0 ? 'phone'),
  'REQ-103.4 el equipo sigue sin celulares');

insert into products (business_id, name, price, for_sale, is_courtesy, category, sort_order)
select biz, 'Cera de prueba', 25000, true, false, 'Cuidado', -5 from ctx;
insert into products (business_id, name, price, for_sale, is_courtesy, category, sort_order)
select biz, 'Café de cortesía', 0, false, true, 'Bebidas', -6 from ctx;
select is((select m ->> 'category' from jsonb_array_elements(get_public_site('la-33') -> 'menu') m
           where m ->> 'name' = 'Cera de prueba'),
  'Cuidado', 'REQ-103.5 el menú trae la categoría de cada producto');
select ok(not exists (select 1 from jsonb_array_elements(get_public_site('la-33') -> 'menu') m
                      where m ->> 'name' = 'Café de cortesía'),
  'REQ-103.5 el menú solo trae lo que está a la venta');
select is((get_public_site('la-33') -> 'menu' -> 0 ->> 'name'), 'Cera de prueba',
  'REQ-103.5 el menú va en el orden del dueño');
select ok((get_public_site('la-33') -> 'menu' -> 0) ?& array['id', 'name', 'price', 'photoPath', 'description', 'category'],
  'REQ-103.5 cada producto trae nombre, precio, foto, descripción y categoría');

select * from finish();
rollback;
