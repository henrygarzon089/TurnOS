-- T-070 · Solo los negocios que habilita el operador encienden el aviso (REQ-043.6, ADR-029,
-- design.md §12.1): el personal no cambia `whatsapp_allowed` y el aviso no se enciende sin él.
begin;
select plan(11);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- ------------------------------------------------------------ por defecto ----
select has_column('businesses', 'whatsapp_allowed', 'REQ-043.6 businesses tiene whatsapp_allowed');
select is((select whatsapp_allowed from businesses where id = (select biz from ctx)), false,
  'REQ-043.6 un negocio existente nace sin habilitar');
insert into businesses (name, slug) values ('Nueva 0040', 'nueva-0040');
select is((select whatsapp_allowed from businesses where slug = 'nueva-0040'), false,
  'REQ-043.6 un negocio nuevo nace sin habilitar');

-- ------------------------------------------------------- dueño sin habilitar ----
select auth.test_login((select owner_u from ctx));
select throws_ok($$ update businesses set whatsapp_auto_enabled = true where id = (select biz from ctx) $$,
  '23514', null, 'REQ-043.6 el dueño no enciende el aviso en un negocio sin habilitar');
select throws_ok($$ update businesses set whatsapp_allowed = true where id = (select biz from ctx) $$,
  '42501', 'FORBIDDEN', 'REQ-043.6 el dueño no habilita su propio negocio');
select throws_ok($$ update businesses set whatsapp_allowed = true, whatsapp_auto_enabled = true
                    where id = (select biz from ctx) $$,
  '42501', 'FORBIDDEN', 'REQ-043.6 ni habilitando y encendiendo a la vez');
select lives_ok($$ update businesses set grace_minutes = 6 where id = (select biz from ctx) $$,
  'REQ-043.6 el dueño sigue editando el resto del negocio');
select auth.test_login((select juan_u from ctx));
update businesses set whatsapp_allowed = true where id = (select biz from ctx); -- RLS: 0 filas
select auth.test_logout();
select is((select whatsapp_allowed from businesses where id = (select biz from ctx)), false,
  'REQ-043.6 el barbero tampoco lo habilita');

-- ------------------------------------------------ el operador lo habilita ----
update businesses set whatsapp_allowed = true where id = (select biz from ctx);
select auth.test_login((select owner_u from ctx));
select lives_ok($$ update businesses set whatsapp_auto_enabled = true where id = (select biz from ctx) $$,
  'REQ-043.6 habilitado, el dueño enciende el aviso');
select throws_ok($$ update businesses set whatsapp_allowed = false where id = (select biz from ctx) $$,
  '42501', 'FORBIDDEN', 'REQ-043.6 el dueño tampoco quita la habilitación');
select auth.test_logout();

select throws_ok($$ update businesses set whatsapp_allowed = false where id = (select biz from ctx) $$,
  '23514', null, 'REQ-043.6 quitar la habilitación exige apagar el aviso en el mismo cambio');

select * from finish();
rollback;
