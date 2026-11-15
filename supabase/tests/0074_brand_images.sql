-- T-220 · Fotos del barbero, de los servicios, logo y portada (REQ-085…087, REQ-090.2, ADR-063)
begin;
select plan(16);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create or replace function _p(p_dir text) returns text language sql as $$
  select (select biz from ctx)::text || '/' || p_dir || '/11111111-1111-4111-8111-111111111111.webp'
$$;

-- ---------------------------------------------------------- Storage ----
select auth.test_login((select owner_u from ctx));
select ok(media_can_write(_p('services')), 'REQ-086.1 el dueño puede subir la foto de un servicio');
select ok(media_can_write(_p('brand')), 'REQ-087.1 el dueño puede subir el logo y la portada');
select ok(media_can_write(_p('barbers/' || (select pedro from ctx))),
  'REQ-085.1 el dueño puede subir la foto de cualquier barbero');
select auth.test_logout();

select auth.test_login((select juan_u from ctx));
select ok(media_can_write(_p('barbers/' || (select juan from ctx))),
  'REQ-085.2 el barbero puede subir su propia foto');
select ok(not media_can_write(_p('barbers/' || (select pedro from ctx))),
  'REQ-085.2 el barbero no sube la foto de otro barbero');
select ok(not media_can_write(_p('services')), 'REQ-090.2 el barbero no sube fotos de servicios');
select ok(not media_can_write(_p('brand')), 'REQ-090.2 el barbero no cambia el logo ni la portada');

-- ------------------------------------------------------- columnas ----
select lives_ok($$ update barbers set photo_path = _p('barbers/' || (select juan from ctx))
                   where id = (select juan from ctx) $$,
  'REQ-085.2 el barbero guarda su propia foto');
update barbers set photo_path = _p('barbers/' || (select juan from ctx)) where id = (select pedro from ctx);
select is((select photo_path from barbers where id = (select pedro from ctx)), null,
  'REQ-085.2 el barbero no cambia la foto de otro barbero (RLS)');
select auth.test_logout();

select throws_ok($$ update barbers set photo_path = _p('barbers/' || (select juan from ctx))
                    where id = (select pedro from ctx) $$,
  '23514', null, 'REQ-090.2 la foto de un barbero no puede apuntar a la carpeta de otro');
select throws_ok($$ update services set photo_path = 'otro/services/11111111-1111-4111-8111-111111111111.webp'
                    where id = (select corte from ctx) $$,
  '23514', null, 'REQ-090.2 la foto de un servicio debe ser del mismo negocio');

select auth.test_login((select owner_u from ctx));
select lives_ok($$ update services set photo_path = _p('services') where id = (select corte from ctx) $$,
  'REQ-086.1 el dueño guarda la foto de un servicio');
select lives_ok($$ update businesses set logo_path = _p('brand'), cover_path = _p('brand')
                   where id = (select biz from ctx) $$,
  'REQ-087.1 el dueño guarda el logo y la portada');
select auth.test_logout();

-- ------------------------------------------------- lecturas públicas ----
select is(get_public_business('la-33') -> 'barberPhotos' ->> (select juan from ctx)::text,
  _p('barbers/' || (select juan from ctx)), 'REQ-085.5 la portada trae la foto de cada barbero');
select ok((select get_public_business('la-33') -> 'services' @> jsonb_build_array(
            jsonb_build_object('name', 'Corte', 'photoPath', _p('services')))),
  'REQ-086.2 cada servicio trae su foto');
select is(get_public_business('la-33') ->> 'coverPath', _p('brand'),
  'REQ-087.2 la portada trae la foto del local');

select * from finish();
rollback;
