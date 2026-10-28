-- T-052 · La fila respeta qué servicios hace cada barbero (REQ-035.7–35.9, REQ-035.11–35.13, ADR-023)
begin;
select plan(20);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Mateo') as mateo,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update tickets set status = 'cancelled', cancel_reason = 'business' where business_id = (select biz from ctx)
  and status in ('waiting', 'called', 'in_service');
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);

-- Mateo es "la estilista": el único que hace cepillado
insert into services (business_id, name, duration_min, price) values ((select biz from ctx), 'Cepillado', 30, 25000);
alter table ctx add column cepillado uuid;
update ctx set cepillado = (select id from services where business_id = ctx.biz and name = 'Cepillado');
select auth.test_login((select owner_u from ctx));
select set_service_barbers((select cepillado from ctx), array[(select mateo from ctx)]);
select auth.test_logout();

create or replace function _t(p_phone text) returns uuid language sql as $$
  select id from tickets where customer_phone_e164 = p_phone order by created_at desc limit 1
$$;
create or replace function _as(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;

-- REQ-035.8 preferido que no hace el servicio
select throws_ok($$ select join_queue('la-33', 'Ana', '+573005670001', (select cepillado from ctx), (select juan from ctx), 1) $$,
  'P0010', 'BARBER_CANT_DO_SERVICE', 'REQ-035.8 join_queue rechaza a un barbero que no hace el servicio');
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select add_manual_ticket((select biz from ctx), 'Ana', '', (select cepillado from ctx), (select juan from ctx)) $$,
  'P0010', 'BARBER_CANT_DO_SERVICE', 'REQ-035.8 add_manual_ticket también lo rechaza');
select auth.test_logout();
select lives_ok($$ select join_queue('la-33', 'Bea', '+573005670002', (select cepillado from ctx), (select mateo from ctx), 1) $$,
  'REQ-035.8 con el barbero que sí lo hace, entra');
update tickets set status = 'cancelled', cancel_reason = 'business' where id = _t('+573005670002');

-- REQ-035.7 nadie presente lo hace
update barbers set status = 'off' where id = (select mateo from ctx);
select throws_ok($$ select join_queue('la-33', 'Caro', '+573005670003', (select cepillado from ctx), null, 1) $$,
  'P0011', 'NO_BARBER_FOR_SERVICE', 'REQ-035.7 join_queue rechaza un servicio que hoy nadie hace');
update barbers set status = 'off' where business_id = (select biz from ctx);
select lives_ok($$ select join_queue('la-33', 'Temprano', '+573005670009', (select cepillado from ctx), null, 1) $$,
  'REQ-035.7 con nadie presente todavía (recién abren), el turno entra como antes');
update tickets set status = 'cancelled', cancel_reason = 'business' where id = _t('+573005670009');
update barbers set status = 'available' where business_id = (select biz from ctx);
update barbers set status = 'paused' where id = (select mateo from ctx);
select lives_ok($$ select join_queue('la-33', 'Caro', '+573005670003', (select cepillado from ctx), null, 1) $$,
  'REQ-035.7 si quien lo hace está en pausa, sigue presente: el turno entra');
update barbers set status = 'available' where id = (select mateo from ctx);

-- Fila: cepillado "cualquiera" (Caro) y luego un corte "cualquiera" (Dani)
select join_queue('la-33', 'Dani', '+573005670004', (select corte from ctx), null, 1);

-- REQ-035.9 la lista del barbero
select ok(not exists (select 1 from barber_queue_tickets((select juan from ctx)) where id = _t('+573005670003'))
          and exists (select 1 from barber_queue_tickets((select juan from ctx)) where id = _t('+573005670004')),
  'REQ-035.9 en la fila de Juan no aparece el cepillado de "cualquiera", sí el corte');
select ok(exists (select 1 from barber_queue_tickets((select mateo from ctx)) where id = _t('+573005670003')),
  'REQ-035.9 en la fila de Mateo sí aparece el cepillado');

-- REQ-035.9 "Llamar al siguiente" salta lo que no hace; el primero de su fila es el corte
select _as((select juan_u from ctx));
select is((call_next()).id, _t('+573005670004'), 'REQ-035.9 Juan llama al siguiente y le llega el corte, no el cepillado');
select set_config('request.jwt.claims', '', true);
select is((select status::text from tickets where id = _t('+573005670003')), 'waiting',
  'REQ-035.10 el cepillado sigue esperando: nunca pasa a quien no lo hace');
select auth.test_login((select owner_u from ctx));
select is((call_next((select mateo from ctx))).id, _t('+573005670003'), 'REQ-035.9 Mateo llama al siguiente y le llega el cepillado');
select auth.test_logout();

-- REQ-035.9 el barbero que llama a mano: "el primero de su fila" ignora lo que no hace (REQ-007.8)
select join_queue('la-33', 'Eva', '+573005670005', (select cepillado from ctx), null, 1);
select join_queue('la-33', 'Fer', '+573005670006', (select corte from ctx), null, 1);
select _as((select pedro_u from ctx));
select lives_ok($$ select transition_ticket(_t('+573005670006'), 'called', 'barber', null, (select pedro from ctx)) $$,
  'REQ-035.9 para Pedro el primero de su fila es el corte (el cepillado de delante no es de su fila)');
select set_config('request.jwt.claims', '', true);

-- REQ-035.12 quitarle el servicio a un barbero no le quita los turnos que ya lo esperan
select join_queue('la-33', 'Gabi', '+573005670007', (select barba from ctx), (select luis from ctx), 1);
select auth.test_login((select owner_u from ctx));
select set_barber_services((select luis from ctx), array[(select corte from ctx)]);
select auth.test_logout();
select is((select preferred_barber_id from tickets where id = _t('+573005670007')), (select luis from ctx),
  'REQ-035.12 el turno de barba sigue con Luis aunque ya no haga barba');
select auth.test_login((select owner_u from ctx));
select is((call_next((select luis from ctx))).id, _t('+573005670007'), 'REQ-035.12 Luis lo llama igual');
select auth.test_logout();

-- REQ-035.11 el dueño solo asigna a quien hace el servicio
update tickets set status = 'cancelled', cancel_reason = 'business' where business_id = (select biz from ctx)
  and status in ('called', 'in_service');
update barbers set status = 'available' where business_id = (select biz from ctx);
select join_queue('la-33', 'Hana', '+573005670008', (select cepillado from ctx), null, 1);
select auth.test_login((select owner_u from ctx));
select throws_ok($$ select transition_ticket(_t('+573005670008'), 'called', 'owner', null, (select juan from ctx)) $$,
  'P0010', 'BARBER_CANT_DO_SERVICE', 'REQ-035.11 el dueño no llama un cepillado con Juan');
select throws_ok($$ update tickets set preferred_barber_id = (select juan from ctx) where id = _t('+573005670008') $$,
  'P0010', 'BARBER_CANT_DO_SERVICE', 'REQ-035.11 el dueño no reasigna un cepillado a Juan');
select lives_ok($$ update tickets set preferred_barber_id = (select mateo from ctx) where id = _t('+573005670008') $$,
  'REQ-035.11 sí lo reasigna a Mateo');
select lives_ok($$ select transition_ticket(_t('+573005670008'), 'called', 'owner', null, (select mateo from ctx)) $$,
  'REQ-035.11 y lo llama con Mateo');

-- REQ-035.13 la caja no valida quién hace qué
select lives_ok($$
  select register_sale((select biz from ctx), null, (select juan from ctx),
    jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select cepillado from ctx), 'qty', 1, 'discount', 0, 'is_reward', false)),
    jsonb_build_array(jsonb_build_object('method', 'cash', 'amount', 25000)))
$$, 'REQ-035.13 se cobra un cepillado hecho por Juan (de favor) sin error');
select is((select commission_amount from sales where barber_id = (select juan from ctx) and total = 25000 order by created_at desc limit 1) > 0,
  true, 'REQ-035.13 y Juan recibe su comisión');
select auth.test_logout();

select * from finish();
rollback;
