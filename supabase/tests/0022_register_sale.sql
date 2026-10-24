-- T-041 · register_sale / void_sale (REQ-019.4, REQ-023.2–23.4, REQ-023.7, REQ-024.3, REQ-025.2,
-- REQ-025.4, REQ-026.1) · design.md §5.1 ejemplos A–D exactos · ADR-018
begin;
select plan(47);

create temp table ctx as
select z.id as biz,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from services s where s.business_id = z.id and s.name = 'Barba') as barba,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Luis') as luis,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Mateo') as mateo,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u
from businesses z where z.slug = 'la-33';
grant select on ctx to public;
update business_hours set opens_at = '00:00', closes_at = '23:59', is_closed = false where business_id = (select biz from ctx);
update barbers set status = 'available', present_day = current_date where business_id = (select biz from ctx);
update barbers set commission_pct = 60 where id = (select juan from ctx);
update barbers set commission_pct = 50 where id in ((select pedro from ctx), (select mateo from ctx));
update barbers set commission_pct = 33 where id = (select luis from ctx);
update loyalty_programs set enabled = true, visits_required = 10, reward_type = 'free_service', reward_service_id = (select corte from ctx)
 where business_id = (select biz from ctx);

-- Turno terminado por un barbero (payment_status = 'pending')
create or replace function _done(p_phone text, p_barber uuid, p_service uuid default null) returns uuid
language plpgsql as $$
declare v uuid; u uuid;
begin
  select user_id into u from barbers where id = p_barber;
  perform join_queue('la-33', 'Cobro Prueba', p_phone, coalesce(p_service, (select corte from ctx)), null, 1);
  select id into v from tickets where customer_phone_e164 = p_phone and status = 'waiting';
  perform set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true);
  perform set_config('turnos.from_call_next', '1', true);
  perform transition_ticket(v, 'called', 'barber', null, p_barber);
  perform set_config('turnos.from_call_next', '', true);
  perform transition_ticket(v, 'in_service', 'barber');
  perform transition_ticket(v, 'done', 'barber');
  perform set_config('request.jwt.claims', '', true);
  return v;
end $$;
create or replace function _svc(p uuid, p_discount int default 0, p_reward boolean default false, p_reason text default null)
returns jsonb language sql as $$
  select jsonb_build_object('kind', 'service', 'ref_id', p, 'qty', 1, 'discount', p_discount,
                            'is_reward', p_reward, 'discount_reason', p_reason)
$$;
create or replace function _prod(p uuid, p_qty int default 1) returns jsonb language sql as $$
  select jsonb_build_object('kind', 'product', 'ref_id', p, 'qty', p_qty)
$$;
create or replace function _pay(m text, a int) returns jsonb language sql as $$
  select jsonb_build_array(jsonb_build_object('method', m, 'amount', a))
$$;
create or replace function _as(u uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u, 'role', 'authenticated')::text, true)
$$;
create temp table sale_ids (k text primary key, id uuid);
grant all on sale_ids to public;

-- ------------------------------------------------------------- Ejemplo A (design §5.1) ----
create temp table t_a as select _done('+573005620001', (select juan from ctx)) as id;
grant select on t_a to public;
-- El precio del catálogo cambia después de tomar el turno: el cobro usa el precio congelado
update services set price = 30000 where id = (select corte from ctx);
select _as((select juan_u from ctx));
select lives_ok($$
  insert into sale_ids select 'A', (register_sale((select biz from ctx), (select id from t_a), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx))), _pay('nequi', 25000))).id
$$, 'REQ-023.3 el barbero registra el cobro de su turno');
select results_eq(
  $$ select services_total, products_total, discount_total, total, commission_pct, commission_base, commission_amount, business_amount
     from sales where id = (select id from sale_ids where k = 'A') $$,
  $$ values (25000, 0, 0, 25000, 60, 25000, 15000, 10000) $$,
  'REQ-025.2 ejemplo A: corte $ 25.000 al 60 % → comisión 15.000, negocio 10.000');
select is((select unit_price from sale_items where sale_id = (select id from sale_ids where k = 'A')), 25000,
  'REQ-023.3 usa el precio congelado en el turno, no el del catálogo actual');
select is((select payment_status::text from tickets where id = (select id from t_a)), 'paid', 'REQ-023.3 el turno queda pagado');
select is((select customer_id from sales where id = (select id from sale_ids where k = 'A')),
  (select customer_id from tickets where id = (select id from t_a)), 'REQ-023.3 la venta lleva el cliente del turno');
select is((select business_day from sales where id = (select id from sale_ids where k = 'A')), business_day_bogota(now()),
  'REQ-027.5 la venta lleva el día de caja de Bogotá');
select is((select created_by from sales where id = (select id from sale_ids where k = 'A')), (select juan_u from ctx),
  'REQ-023.3 guarda quién registró');
select is((select method::text || ':' || amount from sale_payments where sale_id = (select id from sale_ids where k = 'A')), 'nequi:25000',
  'REQ-023.3 guarda el medio de pago');
select throws_ok($$ select register_sale((select biz from ctx), (select id from t_a), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx))), _pay('nequi', 25000)) $$,
  'P0004', null, 'REQ-023.3 un turno ya cobrado no se cobra dos veces');
update services set price = 25000 where id = (select corte from ctx);

-- ------------------------------------------------------------- Ejemplo B ----
select _as((select juan_u from ctx));
select lives_ok($$
  insert into sale_ids select 'B', (register_sale((select biz from ctx), _done('+573005620002', (select juan from ctx)), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx)), _prod((select gaseosa from ctx))), _pay('cash', 29000))).id
$$, 'REQ-023.2 cobro con producto agregado');
select results_eq(
  $$ select services_total, products_total, total, commission_amount, business_amount from sales where id = (select id from sale_ids where k = 'B') $$,
  $$ values (25000, 4000, 29000, 15000, 10000) $$,
  'REQ-024.3 ejemplo B: corte + gaseosa → total 29.000, la gaseosa no genera comisión');

-- ------------------------------------------------------------- Ejemplo C (premio) ----
create temp table t_c as select _done('+573005620003', (select juan from ctx)) as id;
grant select on t_c to public;
update loyalty_cards set stamps = 10, status = 'completed', completed_at = now()
 where customer_id = (select customer_id from tickets where id = (select id from t_c));
create temp table card_c as
select id from loyalty_cards where customer_id = (select customer_id from tickets where id = (select id from t_c)) and status = 'completed';
grant select on card_c to public;
select _as((select juan_u from ctx));
select lives_ok($$
  insert into sale_ids select 'C', (register_sale((select biz from ctx), (select id from t_c), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx), 25000, true)), '[]'::jsonb)).id
$$, 'REQ-019.4 aplica el premio al cobrar');
select results_eq(
  $$ select services_total, discount_total, total, commission_base, commission_amount, business_amount from sales where id = (select id from sale_ids where k = 'C') $$,
  $$ values (0, 25000, 0, 25000, 15000, 10000) $$,
  'REQ-025.4 ejemplo C: corte gratis → total 0, comisión 15.000 sobre el precio de lista');
select is((select status::text from loyalty_cards where id = (select id from card_c)), 'redeemed', 'REQ-019.4 la tarjeta queda canjeada');
select is((select redeemed_sale_id from loyalty_cards where id = (select id from card_c)), (select id from sale_ids where k = 'C'),
  'REQ-019.4 el canje apunta a la venta');
select is((select loyalty_card_id from sales where id = (select id from sale_ids where k = 'C')), (select id from card_c),
  'REQ-019.4 la venta guarda la tarjeta canjeada');
select is((select stamps from loyalty_cards where customer_id = (select customer_id from tickets where id = (select id from t_c)) and status = 'active'), 0,
  'REQ-019.4 se abre una tarjeta nueva en cero');
select is((select is_reward from sale_items where sale_id = (select id from sale_ids where k = 'C')), true, 'REQ-019.4 la línea queda marcada como premio');
select _as((select juan_u from ctx));
select throws_ok($$ select register_sale((select biz from ctx), _done('+573005620004', (select juan from ctx)), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx), 25000, true)), '[]'::jsonb) $$,
  'P0004', null, 'REQ-019.4 sin premio disponible no se aplica');
select throws_ok($$ select register_sale((select biz from ctx), _done('+573005620005', (select juan from ctx)), (select juan from ctx),
    jsonb_build_array(_svc((select barba from ctx), 15000, true)), '[]'::jsonb) $$,
  'P0004', null, 'REQ-019.4 el premio es el servicio configurado (Corte)');

-- ------------------------------------------------------------- Ejemplo D (redondeo) ----
insert into services (business_id, name, duration_min, price, sort_order) values
  ((select biz from ctx), 'Especial 12500', 20, 12500, 90), ((select biz from ctx), 'Especial 9999', 20, 9999, 91),
  ((select biz from ctx), 'Especial 7500', 20, 7500, 92);
select set_config('request.jwt.claims', '', true);
select _as((select owner_u from ctx));
select is((register_sale((select biz from ctx), null, (select luis from ctx),
    jsonb_build_array(_svc((select id from services where name = 'Especial 12500'))), _pay('cash', 12500))).commission_amount, 4125,
  'REQ-025.2 ejemplo D: $ 12.500 al 33 % → 4.125');
update barbers set commission_pct = 45 where id = (select luis from ctx);
select is((register_sale((select biz from ctx), null, (select luis from ctx),
    jsonb_build_array(_svc((select id from services where name = 'Especial 7500'))), _pay('cash', 7500))).commission_amount, 3375,
  'REQ-025.2 ejemplo D: $ 7.500 al 45 % → 3.375');
select is((register_sale((select biz from ctx), null, (select mateo from ctx),
    jsonb_build_array(_svc((select id from services where name = 'Especial 9999'))), _pay('cash', 9999))).commission_amount, 5000,
  'REQ-025.2 ejemplo D: $ 9.999 al 50 % → 4.999,5 → 5.000');
select is((select new_pct from commission_changes where barber_id = (select luis from ctx) order by at desc, id desc limit 1), 45,
  'REQ-025.3 el cambio de porcentaje aplica a las ventas siguientes');
select is((select commission_pct from sales where barber_id = (select luis from ctx) order by created_at limit 1), 33,
  'REQ-025.3 la venta anterior conserva su porcentaje');

-- --------------------------------------------- REQ-023.4 venta sin turno · REQ-024.3 productos ----
select _as((select juan_u from ctx));
select lives_ok($$
  insert into sale_ids select 'SIN_TURNO', (register_sale((select biz from ctx), null, (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx))), _pay('card', 25000))).id
$$, 'REQ-023.4 el barbero registra un cobro sin turno');
select is((select ticket_id from sales where id = (select id from sale_ids where k = 'SIN_TURNO')), null, 'REQ-023.4 la venta sin turno no tiene turno');
select _as((select owner_u from ctx));
select lives_ok($$
  insert into sale_ids select 'PROD', (register_sale((select biz from ctx), null, null,
    jsonb_build_array(_prod((select gaseosa from ctx), 2)), _pay('cash', 8000))).id
$$, 'REQ-024.2 el dueño registra una venta solo de productos');
select results_eq(
  $$ select barber_id, total, commission_pct, commission_amount from sales where id = (select id from sale_ids where k = 'PROD') $$,
  $$ values (null::uuid, 8000, 0, 0) $$, 'REQ-024.3 productos sin barbero y sin comisión');
select _as((select juan_u from ctx));
select is((register_sale((select biz from ctx), null, null,
    jsonb_build_array(_prod((select gaseosa from ctx))), _pay('cash', 4000))).barber_id, (select juan from ctx),
  'REQ-024.2 si la vende un barbero, queda a su nombre (sin comisión)');
select _as((select owner_u from ctx));
select throws_ok($$ select register_sale((select biz from ctx), null, null,
    jsonb_build_array(_svc((select corte from ctx))), _pay('cash', 25000)) $$,
  'P0004', null, 'REQ-023.4 un servicio necesita barbero');

-- ------------------------------------------------- REQ-023.7 quién registra · PA-13 descuentos ----
select _as((select juan_u from ctx));
select throws_ok($$ select register_sale((select biz from ctx), null, (select pedro from ctx),
    jsonb_build_array(_svc((select corte from ctx))), _pay('cash', 25000)) $$,
  '42501', null, 'REQ-023.7 el barbero no registra cobros de otro barbero');
select throws_ok($$ select register_sale((select biz from ctx), _done('+573005620006', (select pedro from ctx)), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx))), _pay('cash', 25000)) $$,
  '42501', null, 'REQ-023.7 el barbero no cobra el turno de otro barbero');
select _as((select juan_u from ctx));
select throws_ok($$ select register_sale((select biz from ctx), null, (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx), 5000, false, 'Amigo')), _pay('cash', 20000)) $$,
  'P0004', null, 'REQ-023.2 / PA-13 el barbero no da descuentos (salvo el premio)');
select _as((select owner_u from ctx));
select throws_ok($$ select register_sale((select biz from ctx), null, (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx), 5000)), _pay('cash', 20000)) $$,
  'P0004', null, 'REQ-023.2 un descuento exige motivo');
select results_eq($$
  select services_total, commission_base, commission_amount from register_sale((select biz from ctx), null, (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx), 5000, false, 'Cliente frecuente')), _pay('cash', 20000))
$$, $$ values (20000, 20000, 12000) $$, 'REQ-023.2 el dueño descuenta con motivo; el descuento reduce la base (PA-18)');
select is((select discount_reason from sale_items where discount = 5000 order by id desc limit 1), 'Cliente frecuente', 'REQ-023.2 guarda el motivo');
select throws_ok($$ select register_sale((select biz from ctx), null, (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx))), _pay('cash', 20000)) $$,
  'P0004', null, 'REQ-023.3 si el pago no cuadra con el total, no se registra');
select throws_ok($$ select register_sale((select biz from ctx), null, (select juan from ctx), '[]'::jsonb, '[]'::jsonb) $$,
  'P0004', null, 'REQ-023.3 una venta sin líneas no se registra');
select set_config('request.jwt.claims', '', true);
select join_queue('la-33', 'En Espera', '+573005620009', (select corte from ctx), (select juan from ctx), 1);
select throws_ok($$ select register_sale((select biz from ctx), (select id from tickets where customer_phone_e164 = '+573005620009'), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx))), _pay('cash', 25000)) $$,
  'P0004', null, 'REQ-023.1 solo se cobra un turno terminado');

-- ------------------------------------------------------------- REQ-026.1 void_sale ----
select _as((select juan_u from ctx));
select throws_ok($$ select void_sale((select id from sale_ids where k = 'C'), 'Error') $$, '42501', null,
  'REQ-026.1 solo el dueño anula');
select _as((select owner_u from ctx));
select throws_ok($$ select void_sale((select id from sale_ids where k = 'C'), '  ') $$, 'P0004', null, 'REQ-026.1 anular exige motivo');
select lives_ok($$ select void_sale((select id from sale_ids where k = 'C'), 'Se aplicó por error') $$, 'REQ-026.1 el dueño anula con motivo');
select results_eq($$ select status::text, voided_reason, voided_by from sales where id = (select id from sale_ids where k = 'C') $$,
  $$ values ('voided'::text, 'Se aplicó por error'::text, 'a0000000-0000-4000-8000-000000000001'::uuid) $$,
  'REQ-026.1 queda anulada con motivo y quién (no se borra)');
select is((select payment_status::text from tickets where id = (select id from t_c)), 'pending',
  'REQ-026.1 el turno vuelve a "cobro pendiente" para registrarlo bien');
select is((select status::text from loyalty_cards where id = (select id from card_c)), 'completed',
  'REQ-026.1 anular devuelve el premio (la tarjeta nueva no tenía sellos)');
select lives_ok($$ select register_sale((select biz from ctx), (select id from t_c), (select juan from ctx),
    jsonb_build_array(_svc((select corte from ctx), 25000, true)), '[]'::jsonb) $$,
  'REQ-026.1 se puede volver a cobrar el turno después de anular');

select set_config('request.jwt.claims', '', true);
select * from finish();
rollback;
