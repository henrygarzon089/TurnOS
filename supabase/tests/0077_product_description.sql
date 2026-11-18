-- T-270 · Descripción de los productos del menú (REQ-098, ADR-072, design §30.1)
begin;
select plan(11);

create temp table ctx as
select (select id from products p where p.business_id = z.id and p.name = 'Helado') as helado,
       (select id from products p where p.business_id = z.id and p.name = 'Tinto') as tinto
from businesses z where z.slug = 'la-33';

select lives_ok($$ update products set description = null where id = (select helado from ctx) $$,
  'REQ-098.2 el producto puede quedar sin descripción (null)');
select lives_ok($$ update products set description = 'x' where id = (select helado from ctx) $$,
  'REQ-098.2 una descripción de 1 caracter se guarda');
select lives_ok($$ update products set description = repeat('a', 140) where id = (select helado from ctx) $$,
  'REQ-098.2 una descripción de 140 caracteres se guarda');
select throws_ok($$ update products set description = repeat('a', 141) where id = (select helado from ctx) $$,
  '23514', null, 'REQ-098.2 la base de datos rechaza una descripción de 141 caracteres');
select throws_ok($$ update products set description = '' where id = (select helado from ctx) $$,
  '23514', null, 'REQ-098.2 la base de datos rechaza una descripción vacía');
select throws_ok($$ update products set description = '   ' where id = (select helado from ctx) $$,
  '23514', null, 'REQ-098.2 la base de datos rechaza una descripción de solo espacios');

update products set description = 'Helado de paleta, varios sabores' where id = (select helado from ctx);

select is((select p ->> 'description' from jsonb_array_elements(get_public_business('la-33') -> 'products') p
           where p ->> 'id' = (select helado from ctx)::text),
  'Helado de paleta, varios sabores',
  'REQ-098.3 get_public_business devuelve la descripción del producto');

update products set description = null where id = (select helado from ctx);

select is((select p -> 'description' from jsonb_array_elements(get_public_business('la-33') -> 'products') p
           where p ->> 'id' = (select helado from ctx)::text),
  'null'::jsonb, 'REQ-098.4 sin descripción, el producto llega con description null');

update products set description = 'Café negro' where id = (select tinto from ctx);
select ok(not exists (select 1 from jsonb_array_elements(get_public_business('la-33') -> 'courtesies') c
                      where c ? 'description'),
  'REQ-098.3 la cortesía no lleva descripción (PA-H24-2)');

insert into businesses (name, slug) values ('Otra', 'otra-h24');
insert into products (business_id, name, price, description)
  values ((select id from businesses where slug = 'otra-h24'), 'Cera ajena', 9000, 'De otro negocio');
select ok(not exists (select 1 from jsonb_array_elements(get_public_business('la-33') -> 'products') p
                      where p ->> 'description' = 'De otro negocio'),
  'REQ-098.3 get_public_business no incluye productos de otro negocio');

select ok(not has_function_privilege('anon', 'get_public_business(text)', 'execute'),
  'NFR-004 get_public_business sigue sin permiso para anon (ADR-009)');

select * from finish();
rollback;
