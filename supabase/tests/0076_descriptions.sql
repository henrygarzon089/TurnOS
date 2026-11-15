-- T-260 · Descripción de los servicios y del negocio (REQ-096, REQ-097, ADR-070, design §29.1)
begin;
select plan(15);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte
from businesses z where z.slug = 'la-33';

-- services.description
select lives_ok($$ update services set description = null where id = (select corte from ctx) $$,
  'REQ-096.3 el servicio puede quedar sin descripción (null)');
select lives_ok($$ update services set description = 'x' where id = (select corte from ctx) $$,
  'REQ-096.3 una descripción de 1 caracter se guarda');
select lives_ok($$ update services set description = repeat('a', 140) where id = (select corte from ctx) $$,
  'REQ-096.3 una descripción de 140 caracteres se guarda');
select throws_ok($$ update services set description = repeat('a', 141) where id = (select corte from ctx) $$,
  '23514', null, 'REQ-096.3 la base de datos rechaza una descripción de 141 caracteres');
select throws_ok($$ update services set description = '' where id = (select corte from ctx) $$,
  '23514', null, 'REQ-096.3 la base de datos rechaza una descripción vacía');
select throws_ok($$ update services set description = '   ' where id = (select corte from ctx) $$,
  '23514', null, 'REQ-096.3 la base de datos rechaza una descripción de solo espacios');

-- businesses.description
select lives_ok($$ update businesses set description = repeat('b', 200) where id = (select biz from ctx) $$,
  'REQ-097.2 una descripción del negocio de 200 caracteres se guarda');
select throws_ok($$ update businesses set description = repeat('b', 201) where id = (select biz from ctx) $$,
  '23514', null, 'REQ-097.2 la base de datos rechaza una descripción del negocio de 201 caracteres');
select throws_ok($$ update businesses set description = '' where id = (select biz from ctx) $$,
  '23514', null, 'REQ-097.2 la base de datos rechaza una descripción del negocio vacía');
select throws_ok($$ update businesses set description = '  ' where id = (select biz from ctx) $$,
  '23514', null, 'REQ-097.2 la base de datos rechaza una descripción del negocio de solo espacios');

-- get_public_business
update services set description = 'Máquina y tijera, lavado y peinado' where id = (select corte from ctx);
update businesses set description = 'Barbería de barrio' where id = (select biz from ctx);

select is((select s ->> 'description' from jsonb_array_elements(get_public_business('la-33') -> 'services') s
           where s ->> 'id' = (select corte from ctx)::text),
  'Máquina y tijera, lavado y peinado',
  'REQ-096.4 get_public_business devuelve la descripción del servicio');
select is(get_public_business('la-33') ->> 'description', 'Barbería de barrio',
  'REQ-097.3 get_public_business devuelve la descripción del negocio');

update services set description = null where id = (select corte from ctx);
update businesses set description = null where id = (select biz from ctx);

select is((select s -> 'description' from jsonb_array_elements(get_public_business('la-33') -> 'services') s
           where s ->> 'id' = (select corte from ctx)::text),
  'null'::jsonb, 'REQ-096.4 sin descripción, el servicio llega con description null');
select is(get_public_business('la-33') -> 'description', 'null'::jsonb,
  'REQ-097.3 sin descripción, el negocio llega con description null');
select ok(not has_function_privilege('anon', 'get_public_business(text)', 'execute'),
  'NFR-004 get_public_business sigue sin permiso para anon (ADR-009)');

select * from finish();
rollback;
