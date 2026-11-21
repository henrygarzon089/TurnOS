-- T-310 · Postulaciones de "Trabaja con nosotros" (REQ-102, ADR-079, design §34.1)
begin;
select plan(18);

create temp table ctx as
select z.id as biz,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

create function pg_temp.apply(p_phone text, p_name text default 'Camilo Ruiz', p_ip text default '10.0.0.1')
returns text language sql as $$
  select submit_job_application('la-33', p_name, p_phone, 'barbero', 3, 'https://instagram.com/camilo',
    'tiempo_completo', 'Me gusta el degradado', 'v1', p_ip)
$$;

select is(pg_temp.apply('+573001110001'), 'created', 'REQ-102.4 una postulación válida se guarda');
select is((select count(*)::int from job_applications where phone_e164 = '+573001110001'), 1,
  'REQ-102.4 queda una fila en el negocio');
select is((select status::text from job_applications where phone_e164 = '+573001110001'), 'nueva',
  'REQ-102.6 entra como nueva');
select is(pg_temp.apply('+5491155550001', 'Pedro Gómez'), 'created',
  'REQ-102.3 acepta un celular de otro país');

select throws_ok($$ select submit_job_application('la-33', 'C', '+573001110002', 'barbero', 3, null,
  'tiempo_completo', null, 'v1', null) $$, '22023', 'INVALID', 'REQ-102.4 un nombre muy corto no se guarda');
select throws_ok($$ select submit_job_application('la-33', 'Camilo', '3001110002', 'barbero', 3, null,
  'tiempo_completo', null, 'v1', null) $$, '22023', 'INVALID', 'REQ-102.4 un celular sin formato no se guarda');
select throws_ok($$ select submit_job_application('la-33', 'Camilo', '+573001110002', 'barbero', 3,
  'javascript:alert(1)', 'tiempo_completo', null, 'v1', null) $$, '22023', 'INVALID',
  'REQ-102.4 un enlace que no es https no se guarda');
select throws_ok($$ select submit_job_application('la-33', 'Camilo', '+573001110002', 'barbero', 3, null,
  'tiempo_completo', null, '', null) $$, '22023', 'INVALID', 'REQ-102.3 sin autorización de datos no se guarda');

update job_applications set status = 'contactada' where phone_e164 = '+573001110001';
select is(pg_temp.apply('+573001110001', 'Camilo Andrés Ruiz', '10.0.0.2'), 'updated',
  'REQ-102.5 el mismo celular en 30 días actualiza');
select is((select count(*)::int || ' ' || min(full_name) || ' ' || min(status::text) from job_applications
           where phone_e164 = '+573001110001'), '1 Camilo Andrés Ruiz nueva',
  'REQ-102.5 no se duplica y vuelve a nueva');
select is(pg_temp.apply('+573001110001', 'Camilo', '10.0.0.3'), 'updated', 'REQ-102.5 tercer envío del día');
select is(pg_temp.apply('+573001110001', 'Camilo', '10.0.0.4'), 'rate_limited',
  'REQ-102.5 más de 3 por celular al día se frenan');

select auth.test_login((select juan_u from ctx));
select is((select count(*)::int from job_applications), 0, 'REQ-102.7 el barbero no ve postulaciones');
select throws_ok($$ select delete_job_application((select id from job_applications limit 1)) $$,
  '42501', 'FORBIDDEN', 'REQ-102.7 el barbero no borra');
select auth.test_logout();

select ok(not has_table_privilege('anon', 'job_applications', 'select')
          and not has_function_privilege('anon', 'submit_job_application(text, text, text, text, int, text, text, text, text, text)', 'execute')
          and not has_function_privilege('authenticated', 'submit_job_application(text, text, text, text, int, text, text, text, text, text)', 'execute'),
  'REQ-102.7 anon no lee y el envío solo corre en el servidor (ADR-009)');

select auth.test_login((select owner_u from ctx));
select set_job_application_status((select id from job_applications where phone_e164 = '+5491155550001'), 'contactada');
select is((select count(*)::int || ' ' || count(*) filter (where status = 'contactada')::int from job_applications),
  '2 1', 'REQ-102.6 el dueño ve las de su negocio y marca contactada');
select delete_job_application((select id from job_applications where phone_e164 = '+5491155550001'));
select is((select count(*)::int from job_applications), 1, 'REQ-102.6 el dueño borra una postulación');
select auth.test_logout();

update job_applications set created_at = now() - interval '13 months';
select is(purge_job_applications(), 1, 'REQ-102.7 a los 12 meses se borran solas');

select * from finish();
rollback;
