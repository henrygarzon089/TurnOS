-- T-058 · Datos del Hito 5, experiencia del cliente (REQ-036…REQ-039, ADR-025, design.md §11)
-- Columnas y checks, cumpleaños en join_queue, bebida de cortesía, fotos de cortes con su límite,
-- bucket `media`, birthdays_this_week, lecturas públicas ampliadas y permisos (ADR-019).
begin;
select plan(90);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from products p where p.business_id = z.id and p.name = 'Helado') as helado,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       '0000000e-0000-0000-0000-0000000000e1'::uuid as other_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update tickets set status = 'cancelled', cancel_reason = 'business' where business_id = (select biz from ctx)
  and status in ('waiting', 'called', 'in_service');
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);

create or replace function _t(p_phone text) returns uuid language sql as $$
  select id from tickets where customer_phone_e164 = p_phone order by created_at desc limit 1
$$;
create or replace function _as(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;
create or replace function _anon() returns void language sql as $$
  select set_config('request.jwt.claims', '', true)
$$;
create or replace function _c(p_phone text) returns customers language sql as $$
  select * from customers where phone_e164 = p_phone
$$;

-- Otro negocio para las pruebas de aislamiento
insert into auth.users (id, email) values ((select other_u from ctx), 'otro-h5@test.local');
select _as((select other_u from ctx));
select create_business('Otra Barbería H5', 'otra-h5');
select _anon();
alter table ctx add column other_biz uuid, add column tinto uuid, add column aromatica uuid, add column ajena uuid;
update ctx set other_biz = (select id from businesses where slug = 'otra-h5');
insert into products (business_id, name, price, for_sale, is_courtesy) values
  ((select biz from ctx), 'Tinto H5', 0, false, true),
  ((select biz from ctx), 'Aromática H5', 0, false, true),
  ((select other_biz from ctx), 'Ajena H5', 0, false, true);
update ctx set tinto = (select id from products where name = 'Tinto H5'),
               aromatica = (select id from products where name = 'Aromática H5'),
               ajena = (select id from products where name = 'Ajena H5');

-- ------------------------------------------------------------ REQ-036.1 ----
select throws_ok($$ update businesses set google_review_url = 'http://g.page/r/la33/review' where id = (select biz from ctx) $$,
  '23514', null, 'REQ-036.1 el enlace de reseñas sin https:// se rechaza');
select lives_ok($$ update businesses set google_review_url = 'https://g.page/r/la33/review' where id = (select biz from ctx) $$,
  'REQ-036.1 el dueño guarda un enlace https:// de reseñas');

-- ------------------------------------------------------- REQ-037.1/037.3 ----
select throws_ok($$ update customers set birthday_month = 4, birthday_day = 31 where phone_e164 = '+573002000001' $$,
  '23514', null, 'REQ-037.3 el 31 de abril no existe');
select throws_ok($$ update customers set birthday_month = 2, birthday_day = 30 where phone_e164 = '+573002000001' $$,
  '23514', null, 'REQ-037.3 el 30 de febrero no existe');
select throws_ok($$ update customers set birthday_month = 13, birthday_day = 1 where phone_e164 = '+573002000001' $$,
  '23514', null, 'REQ-037.3 el mes 13 no existe');
select throws_ok($$ update customers set birthday_month = 5, birthday_day = null where phone_e164 = '+573002000001' $$,
  '23514', null, 'REQ-037.1 día y mes van juntos (sin año)');
select lives_ok($$ update customers set birthday_month = 2, birthday_day = 29 where phone_e164 = '+573002000001' $$,
  'REQ-037.3 el 29 de febrero es válido');

-- El barbero con alcance sobre la ficha (ADR-016) y el dueño editan el cumpleaños
select auth.test_login((select juan_u from ctx));
select lives_ok($$ update customers set birthday_month = 7, birthday_day = 15 where phone_e164 = '+573002000002' $$,
  'REQ-037.1 el barbero edita el cumpleaños de la ficha');
select auth.test_logout();
select is((select array[birthday_month, birthday_day]::int[] from customers where phone_e164 = '+573002000002'), array[7, 15],
  'REQ-037.1 queda guardado lo que puso el barbero');
select auth.test_login((select owner_u from ctx));
select lives_ok($$ update customers set birthday_month = 7, birthday_day = 16 where phone_e164 = '+573002000002' $$,
  'REQ-037.1 el dueño edita el cumpleaños de la ficha');
select auth.test_logout();

-- ----------------------------------------------------- REQ-038.1/038.7 ----
select is((select count(*)::int from products where business_id = (select biz from ctx)
            and name in ('Helado', 'Gaseosa', 'Agua', 'Jugo') and (not for_sale or is_courtesy)), 0,
  'REQ-038.7 los productos que ya existían siguen a la venta y no son de cortesía (nada cambia en caja)');
select lives_ok($$ insert into products (business_id, name, price, for_sale, is_courtesy, photo_path)
                   values ((select biz from ctx), 'Limonada H5', 4000, true, true,
                           (select biz from ctx)::text || '/products/11111111-1111-4111-8111-111111111111.webp') $$,
  'REQ-038.1 un producto puede ser a la venta y de cortesía a la vez, con foto opcional');

-- ------------------------------------------------------------ REQ-037.2 ----
select lives_ok($$ select join_queue(p_slug => 'la-33', p_name => 'Cumple Nuevo', p_phone => '+573005880001',
                   p_service_id => (select corte from ctx), p_privacy_version => 1,
                   p_birthday_month => 5, p_birthday_day => 14) $$,
  'REQ-037.2 tomar turno con cumpleaños');
select is((select array[birthday_month, birthday_day]::int[] from customers where phone_e164 = '+573005880001'), array[5, 14],
  'REQ-037.2 la ficha que no tenía cumpleaños lo guarda');
update tickets set status = 'cancelled', cancel_reason = 'business' where id = _t('+573005880001');
select lives_ok($$ select join_queue(p_slug => 'la-33', p_name => 'Cumple Nuevo', p_phone => '+573005880001',
                   p_service_id => (select corte from ctx), p_privacy_version => 1,
                   p_birthday_month => 6, p_birthday_day => 20) $$,
  'REQ-037.2 volver a tomar turno con otro cumpleaños');
select is((select array[birthday_month, birthday_day]::int[] from customers where phone_e164 = '+573005880001'), array[5, 14],
  'REQ-037.2 un cumpleaños del formulario nunca reemplaza uno ya guardado');
update tickets set status = 'cancelled', cancel_reason = 'business' where id = _t('+573005880001');
select throws_ok($$ select join_queue(p_slug => 'la-33', p_name => 'Fecha Mala', p_phone => '+573005880002',
                   p_service_id => (select corte from ctx), p_privacy_version => 1,
                   p_birthday_month => 2, p_birthday_day => 30) $$,
  '23514', null, 'REQ-037.3 join_queue rechaza una fecha imposible');
select ok(customer_has_birthday('la-33', '+573005880001') and not customer_has_birthday('la-33', '+573002000010'),
  'REQ-037.2 el formulario sabe si la ficha ya tiene cumpleaños (para no volver a pedirlo)');

-- ------------------------------------------------------- REQ-038.3/038.6 ----
select lives_ok($$ select join_queue(p_slug => 'la-33', p_name => 'Con Tinto', p_phone => '+573005880011',
                   p_service_id => (select corte from ctx), p_privacy_version => 1,
                   p_courtesy_product_id => (select tinto from ctx)) $$,
  'REQ-038.3 tomar turno con bebida de cortesía');
select is((select courtesy_product_id from tickets where id = _t('+573005880011')), (select tinto from ctx),
  'REQ-038.3 el turno guarda la bebida escogida');
select is((select courtesy_product_id from tickets where id = (
            select id from tickets where customer_phone_e164 = '+573005880001' order by created_at desc limit 1)), null,
  'REQ-038.3 "No, gracias" (sin bebida) es lo normal');
select throws_ok($$ select join_queue(p_slug => 'la-33', p_name => 'Con Helado', p_phone => '+573005880012',
                   p_service_id => (select corte from ctx), p_privacy_version => 1,
                   p_courtesy_product_id => (select helado from ctx)) $$,
  'P0012', 'COURTESY_INVALID', 'REQ-038.6 un producto que no es de cortesía se rechaza');
select throws_ok($$ select join_queue(p_slug => 'la-33', p_name => 'Con Ajena', p_phone => '+573005880012',
                   p_service_id => (select corte from ctx), p_privacy_version => 1,
                   p_courtesy_product_id => (select ajena from ctx)) $$,
  'P0012', 'COURTESY_INVALID', 'REQ-038.6 una cortesía de otro negocio se rechaza');
update products set is_active = false where id = (select aromatica from ctx);
select throws_ok($$ select join_queue(p_slug => 'la-33', p_name => 'Con Aromática', p_phone => '+573005880012',
                   p_service_id => (select corte from ctx), p_privacy_version => 1,
                   p_courtesy_product_id => (select aromatica from ctx)) $$,
  'P0012', 'COURTESY_INVALID', 'REQ-038.6 una cortesía inactiva se rechaza');
select is((select count(*)::int from tickets where customer_phone_e164 = '+573005880012'), 0,
  'REQ-038.6 con cortesía inválida no se crea el turno');
update products set is_active = true where id = (select aromatica from ctx);

-- ------------------------------------------------------------ REQ-038.4 ----
delete from realtime.messages_local;
select lives_ok($$ select set_ticket_courtesy((select public_token from tickets where id = _t('+573005880011')), (select aromatica from ctx)) $$,
  'REQ-038.4 en espera se cambia la bebida');
select is((select courtesy_product_id from tickets where id = _t('+573005880011')), (select aromatica from ctx),
  'REQ-038.4 queda la bebida nueva');
select ok((select count(*) from realtime.messages_local where topic = 'queue:' || (select biz from ctx)) >= 1,
  'ADR-008 cambiar la bebida avisa a la fila (queue_changed)');
select lives_ok($$ select set_ticket_courtesy((select public_token from tickets where id = _t('+573005880011')), null) $$,
  'REQ-038.4 en espera se quita la bebida');
select is((select courtesy_product_id from tickets where id = _t('+573005880011')), null, 'REQ-038.4 queda sin bebida');
select throws_ok($$ select set_ticket_courtesy((select public_token from tickets where id = _t('+573005880011')), (select helado from ctx)) $$,
  'P0012', 'COURTESY_INVALID', 'REQ-038.6 el cambio desde "Mi turno" valida igual que join_queue');
select set_ticket_courtesy((select public_token from tickets where id = _t('+573005880011')), (select tinto from ctx));
select _as((select owner_u from ctx));
select transition_ticket(_t('+573005880011'), 'called', 'owner', null, (select juan from ctx));
select _anon();
select throws_ok($$ select set_ticket_courtesy((select public_token from tickets where id = _t('+573005880011')), (select aromatica from ctx)) $$,
  'P0004', 'TICKET_NOT_WAITING', 'REQ-038.4 desde que lo llaman ya no se cambia la bebida');
select throws_ok($$ select set_ticket_courtesy('token-que-no-existe', null) $$,
  'P0002', 'TICKET_NOT_FOUND', 'REQ-004.7 un token que no existe no revela nada');

-- REQ-038.7 si el producto se acaba, el turno que ya lo tenía lo conserva
update products set is_active = false where id = (select tinto from ctx);
select is((select courtesy_product_id from tickets where id = _t('+573005880011')), (select tinto from ctx),
  'REQ-038.7 desactivar la bebida no se la quita a los turnos que ya la tenían');
select is((select get_ticket_by_token(public_token) -> 'courtesy' ->> 'name' from tickets where id = _t('+573005880011')), 'Tinto H5',
  'REQ-038.4 "Mi turno" muestra la bebida escogida');
select is((select count(*)::int from sales s join tickets t on t.id = s.ticket_id where t.customer_phone_e164 = '+573005880011'), 0,
  'REQ-038.7 la cortesía no genera venta ni cobro');

-- ------------------------------------------------------------ REQ-038.5 ----
delete from realtime.messages_local;
select auth.test_login((select juan_u from ctx));
select lives_ok($$ select mark_courtesy_served(_t('+573005880011')) $$, 'REQ-038.5 el barbero marca la bebida "Servida ✓"');
select auth.test_logout();
select ok((select courtesy_served_at is not null and courtesy_served_by = (select juan_u from ctx)
           from tickets where id = _t('+573005880011')),
  'REQ-038.5 queda la hora y quién la sirvió');
select ok((select count(*) from realtime.messages_local where topic = 'queue:' || (select biz from ctx)) >= 1,
  'ADR-008 marcar servida avisa a la fila y a "Mi turno"');
select is((select get_ticket_by_token(public_token) -> 'courtesy' ->> 'served' from tickets where id = _t('+573005880011')), 'true',
  'REQ-038.5 "Mi turno" ve la bebida servida');
alter table ctx add column served_at timestamptz;
update ctx set served_at = (select courtesy_served_at from tickets where id = _t('+573005880011'));
select auth.test_login((select owner_u from ctx));
select lives_ok($$ select mark_courtesy_served(_t('+573005880011')) $$, 'REQ-038.5 marcar de nuevo no falla');
select auth.test_logout();
select is((select courtesy_served_at from tickets where id = _t('+573005880011')), (select served_at from ctx),
  'REQ-038.5 marcar servida es idempotente (no cambia la hora)');
select auth.test_login((select juan_u from ctx));
update tickets set courtesy_served_at = null, courtesy_served_by = null where id = _t('+573005880011');
select auth.test_logout();
select ok((select courtesy_served_at is not null from tickets where id = _t('+573005880011')),
  'REQ-038.5 el barbero no puede desmarcarla (sin update directo sobre tickets)');
alter table ctx add column tinto_t uuid;
update ctx set tinto_t = _t('+573005880011');
select auth.test_login((select other_u from ctx));
select throws_ok($$ select mark_courtesy_served((select tinto_t from ctx)) $$, '42501', null,
  'REQ-031.1 el dueño de otro negocio no marca bebidas de La 33');
select auth.test_logout();
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select mark_courtesy_served((select id from tickets where customer_phone_e164 = '+573005880001'
                                                  order by created_at desc limit 1)) $$,
  'P0004', 'NO_COURTESY', 'REQ-038.5 un turno sin bebida no se marca');
select auth.test_logout();

-- ------------------------------------------------------- REQ-036.2–036.4 ----
select is((select get_ticket_by_token(public_token) ->> 'googleReviewUrl' from tickets where id = _t('+573005880011')), null,
  'REQ-036.2 el botón de reseña no aparece antes de terminar');
select _as((select owner_u from ctx));
select transition_ticket(_t('+573005880011'), 'in_service', 'owner');
select transition_ticket(_t('+573005880011'), 'done', 'owner');
select _anon();
select is((select get_ticket_by_token(public_token) ->> 'googleReviewUrl' from tickets where id = _t('+573005880011')),
  'https://g.page/r/la33/review', 'REQ-036.2 turno terminado con enlace guardado: trae el enlace de reseña');
select join_queue(p_slug => 'la-33', p_name => 'Cancela', p_phone => '+573005880021', p_service_id => (select corte from ctx), p_privacy_version => 1);
select _as((select owner_u from ctx));
select transition_ticket(_t('+573005880021'), 'cancelled', 'owner');
select _anon();
select is((select get_ticket_by_token(public_token) ->> 'googleReviewUrl' from tickets where id = _t('+573005880021')), null,
  'REQ-036.4 un turno cancelado no trae el enlace de reseña');
select join_queue(p_slug => 'la-33', p_name => 'No Llega', p_phone => '+573005880022', p_service_id => (select corte from ctx), p_privacy_version => 1);
select _as((select owner_u from ctx));
select transition_ticket(_t('+573005880022'), 'called', 'owner', null, (select pedro from ctx));
select transition_ticket(_t('+573005880022'), 'no_show', 'owner');
select _anon();
select is((select get_ticket_by_token(public_token) ->> 'googleReviewUrl' from tickets where id = _t('+573005880022')), null,
  'REQ-036.4 un "no llegó" no trae el enlace de reseña');
update businesses set google_review_url = null where id = (select biz from ctx);
select is((select get_ticket_by_token(public_token) ->> 'googleReviewUrl' from tickets where id = _t('+573005880011')), null,
  'REQ-036.3 sin enlace guardado no hay botón de reseña');
select is((select get_ticket_by_token(public_token) ->> 'status' from tickets where id = _t('+573005880011')), 'done',
  'REQ-036.3 el turno terminado se sigue mostrando (el gracias sí aparece)');

-- ------------------------------------------------------- REQ-038.2/038.3 ----
select ok((select get_public_business('la-33') -> 'products' @> jsonb_build_array(jsonb_build_object('name', 'Helado', 'price', 3000))),
  'REQ-038.2 la portada trae los productos a la venta con precio');
select ok(not (select get_public_business('la-33') -> 'products' @> jsonb_build_array(jsonb_build_object('name', 'Aromática H5'))),
  'REQ-038.2 un producto solo de cortesía no sale en "Lo que vendemos"');
select ok((select get_public_business('la-33') -> 'products' @> jsonb_build_array(jsonb_build_object('name', 'Limonada H5', 'photoPath',
            (select biz from ctx)::text || '/products/11111111-1111-4111-8111-111111111111.webp'))),
  'REQ-038.2 cada producto trae su foto');
select ok((select get_public_business('la-33') -> 'courtesies' @> jsonb_build_array(jsonb_build_object('name', 'Aromática H5')))
          and not (select get_public_business('la-33') -> 'courtesies' @> jsonb_build_array(jsonb_build_object('name', 'Tinto H5')))
          and not (select get_public_business('la-33') -> 'courtesies' @> jsonb_build_array(jsonb_build_object('name', 'Helado'))),
  'REQ-038.3 el formulario ofrece solo las cortesías activas');

-- ------------------------------------------------------- REQ-039.1/039.2 ----
select auth.test_login((select juan_u from ctx));
select lives_ok($$ insert into barber_photos (business_id, barber_id, path)
                   values ((select biz from ctx), (select juan from ctx), 'juan-1.webp') $$,
  'REQ-039.1 el barbero sube una foto suya');
select throws_ok($$ insert into barber_photos (business_id, barber_id, path)
                    values ((select biz from ctx), (select pedro from ctx), 'pedro-de-juan.webp') $$,
  '42501', null, 'REQ-039.1 el barbero no sube fotos a nombre de otro');
select auth.test_logout();
select auth.test_login((select owner_u from ctx));
select lives_ok($$ insert into barber_photos (business_id, barber_id, path)
                   values ((select biz from ctx), (select pedro from ctx), 'pedro-1.webp') $$,
  'REQ-039.1 el dueño sube fotos de cualquier barbero');
select auth.test_logout();
select auth.test_login((select juan_u from ctx));
delete from barber_photos where path = 'pedro-1.webp';
select auth.test_logout();
select is((select count(*)::int from barber_photos where path = 'pedro-1.webp'), 1,
  'REQ-039.1 el barbero no borra fotos de otro');
select auth.test_login((select owner_u from ctx));
select lives_ok($$ delete from barber_photos where path = 'pedro-1.webp' $$, 'REQ-039.1 el dueño borra fotos de cualquier barbero');
select auth.test_logout();
select is((select count(*)::int from barber_photos where path = 'pedro-1.webp'), 0, 'REQ-039.1 la foto del dueño quedó borrada');
select auth.test_login((select other_u from ctx));
select is((select count(*)::int from barber_photos), 0, 'REQ-031.1 otro negocio no ve las fotos de La 33');
select auth.test_logout();

insert into barber_photos (business_id, barber_id, path, created_at)
select (select biz from ctx), (select juan from ctx), 'juan-' || g || '.webp', now() + make_interval(mins => g)
from generate_series(2, 12) g;
select auth.test_login((select juan_u from ctx));
select throws_ok($$ insert into barber_photos (business_id, barber_id, path)
                    values ((select biz from ctx), (select juan from ctx), 'juan-13.webp') $$,
  'P0013', 'PHOTO_LIMIT', 'REQ-039.2 la foto 13 se rechaza (el límite vive en la base)');
select lives_ok($$ delete from barber_photos where path = 'juan-1.webp' $$, 'REQ-039.1 el barbero borra una suya');
select lives_ok($$ insert into barber_photos (business_id, barber_id, path)
                   values ((select biz from ctx), (select juan from ctx), 'juan-13.webp') $$,
  'REQ-039.2 borrando una, puede subir otra');
select auth.test_logout();

-- ------------------------------------------------------- REQ-039.5/039.6 ----
select is(jsonb_array_length(get_barber_photos('la-33', (select juan from ctx))), 12, 'REQ-039.5 "Ver cortes" trae las fotos del barbero');
select is(get_barber_photos('la-33', (select juan from ctx)) -> 0 ->> 'path', 'juan-12.webp',
  'REQ-039.5 de la más nueva a la más vieja');
select is((get_public_business('la-33') -> 'photoCounts' ->> (select juan::text from ctx))::int, 12,
  'REQ-039.5 la portada sabe qué barbero tiene fotos');
select is(get_barber_photos('otra-h5', (select juan from ctx)), '[]'::jsonb,
  'REQ-031.1 no se leen fotos de un barbero con el slug de otro negocio');
update barbers set is_active = false where id = (select juan from ctx);
select is(get_barber_photos('la-33', (select juan from ctx)), '[]'::jsonb, 'REQ-039.6 barbero desactivado: sus fotos no se muestran');
select ok(not (get_public_business('la-33') -> 'photoCounts' ? (select juan::text from ctx)),
  'REQ-039.6 barbero desactivado: la portada no lo cuenta');
select is((select count(*)::int from barber_photos where barber_id = (select juan from ctx)), 12,
  'REQ-039.6 las fotos se conservan por si vuelve');
update barbers set is_active = true where id = (select juan from ctx);

-- ------------------------------------------------------ Storage (§11.3) ----
select ok((select public and file_size_limit = 307200 from storage.buckets where id = 'media'),
  'REQ-039.4 bucket media de lectura pública con límite de 300 KB');
select auth.test_login((select juan_u from ctx));
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('media',
                   (select biz::text || '/barbers/' || juan::text || '/22222222-2222-4222-8222-222222222222.webp' from ctx)) $$,
  'REQ-039.1 el barbero sube el archivo en su carpeta');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media',
                    (select biz::text || '/barbers/' || pedro::text || '/33333333-3333-4333-8333-333333333333.webp' from ctx)) $$,
  '42501', null, 'REQ-039.1 el barbero no sube archivos en la carpeta de otro');
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media',
                    (select biz::text || '/products/44444444-4444-4444-8444-444444444444.webp' from ctx)) $$,
  '42501', null, 'REQ-038.1 el barbero no sube fotos de productos');
select auth.test_logout();
select auth.test_login((select owner_u from ctx));
select lives_ok($$ insert into storage.objects (bucket_id, name) values ('media',
                   (select biz::text || '/products/44444444-4444-4444-8444-444444444444.webp' from ctx)) $$,
  'REQ-038.1 el dueño sube la foto del producto');
select auth.test_logout();
select auth.test_login((select other_u from ctx));
select throws_ok($$ insert into storage.objects (bucket_id, name) values ('media',
                    (select biz::text || '/products/55555555-5555-4555-8555-555555555555.webp' from ctx)) $$,
  '42501', null, 'REQ-031.1 el dueño de otro negocio no sube archivos a La 33');
select auth.test_logout();

-- ------------------------------------------------------- REQ-037.4/037.5 ----
insert into customers (business_id, phone_e164, name, birthday_month, birthday_day, do_not_contact, anonymized_at) values
  ((select biz from ctx), '+573005890001', 'Cumple A', 2, 26, false, null),
  ((select biz from ctx), '+573005890002', 'Cumple B fuera', 3, 3, false, null),
  ((select biz from ctx), '+573005890003', 'Cumple C bisiesto', 2, 29, false, null),
  ((select biz from ctx), '+573005890004', 'Cumple D no contactar', 2, 25, true, null),
  ((select biz from ctx), '+573005890005', 'Cumple E eliminado', 2, 25, false, now()),
  ((select biz from ctx), '+573005890006', 'Cumple F', 3, 2, false, null),
  ((select biz from ctx), '+573005890007', 'Cumple G enero', 1, 2, false, null);
select is(array(select name from birthdays_this_week((select biz from ctx), '2027-02-24') where name like 'Cumple %'),
  array['Cumple A', 'Cumple C bisiesto', 'Cumple F'],
  'REQ-037.4 hoy y los 6 días siguientes, ordenados por fecha (el día 7 ya no)');
select is((select celebrates_on from birthdays_this_week((select biz from ctx), '2027-02-24') where name = 'Cumple C bisiesto'),
  '2027-02-28'::date, 'REQ-037.4 en año no bisiesto, el 29 de febrero aparece el 28');
select is((select celebrates_on from birthdays_this_week((select biz from ctx), '2028-02-24') where name = 'Cumple C bisiesto'),
  '2028-02-29'::date, 'REQ-037.4 en año bisiesto, el 29 de febrero aparece el 29');
select is((select celebrates_on from birthdays_this_week((select biz from ctx), '2026-12-28') where name = 'Cumple G enero'),
  '2027-01-02'::date, 'REQ-037.4 la semana cruza el fin de año');
select ok(not exists (select 1 from birthdays_this_week((select biz from ctx), '2027-02-24') where name like 'Cumple D%' or name like 'Cumple E%'),
  'REQ-037.5 sin "no contactar" ni fichas eliminadas');
select auth.test_login((select juan_u from ctx));
select throws_ok($$ select * from birthdays_this_week((select biz from ctx)) $$, '42501', null,
  'REQ-037.4 la lista "Cumplen esta semana" es del dueño');
select auth.test_logout();
alter table ctx add column cumple_a uuid;
update ctx set cumple_a = (select id from customers where phone_e164 = '+573005890001');
select auth.test_login((select owner_u from ctx));
select anonymize_customer((select cumple_a from ctx));
select auth.test_logout();
select ok((select birthday_month is null and birthday_day is null from customers where id = (select cumple_a from ctx)),
  'REQ-018.6 eliminar la ficha borra también el cumpleaños');

-- ----------------------------------------------------- REQ-037.4/037.6 ----
select ok((select body like '%{nombre}%' and body like '%{negocio}%' from message_templates
           where business_id = (select biz from ctx) and key = 'birthday'),
  'REQ-037.4 plantilla "cumpleaños" con {nombre} y {negocio}');
select is((select count(*)::int from message_templates where business_id = (select other_biz from ctx)), 4,
  'REQ-037.4 un negocio nuevo trae también la plantilla de cumpleaños');
select ok((select body ilike '%cumpleaños%' from privacy_policy_versions where business_id = (select other_biz from ctx) and version = 1),
  'REQ-037.6 el aviso de privacidad por defecto menciona el cumpleaños como dato opcional');

-- ------------------------------------------------------------- ADR-019 ----
select ok(not has_function_privilege('authenticated', 'set_ticket_courtesy(text, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'get_barber_photos(text, uuid)', 'execute')
          and not has_function_privilege('authenticated', 'customer_has_birthday(text, text)', 'execute')
          and has_function_privilege('service_role', 'set_ticket_courtesy(text, uuid)', 'execute')
          and has_function_privilege('service_role', 'get_barber_photos(text, uuid)', 'execute'),
  'ADR-019 las funciones públicas nuevas solo las llama el servidor (service_role)');
select ok(has_function_privilege('authenticated', 'mark_courtesy_served(uuid)', 'execute')
          and has_function_privilege('authenticated', 'birthdays_this_week(uuid, date)', 'execute')
          and not has_function_privilege('anon', 'mark_courtesy_served(uuid)', 'execute')
          and not has_function_privilege('anon', 'birthdays_this_week(uuid, date)', 'execute'),
  'ADR-019 el personal ejecuta mark_courtesy_served y birthdays_this_week; anon no');

select * from finish();
rollback;
