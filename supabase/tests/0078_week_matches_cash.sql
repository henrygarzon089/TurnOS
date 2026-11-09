-- T-180 · Semana como el tablero (REQ-078.32, ADR-053) · design.md §22.8 "Semana (T-180)".
-- Las cifras de arriba de Semana salen de weekly_summary y DEBEN cuadrar con la caja de cada día
-- (cash_day_summary de lunes a domingo): Ingresos = suma de los totales; Comisiones = suma de las
-- comisiones de servicios y de productos de cada barbero; Queda al negocio = Ingresos − Comisiones.
begin;
select plan(6);

create temp table ctx as
select z.id as biz,
       'a0000000-0000-4000-8000-000000000001'::uuid as owner_u,
       business_day_bogota(now()) - (extract(isodow from business_day_bogota(now()))::int - 1) as wk,
       (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
       (select id from products p where p.business_id = z.id and p.name = 'Gaseosa') as gaseosa,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
       (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro
from businesses z where z.slug = 'la-33';
grant select on ctx to public;

-- Ventas propias de hoy (la prueba no depende de lo que traiga el seed): dos barberos y un producto
select register_sale((select biz from ctx), null, (select juan from ctx),
  jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1),
                    jsonb_build_object('kind', 'product', 'ref_id', (select gaseosa from ctx), 'qty', 1)),
  '[{"method": "cash", "amount": 29000}]'::jsonb);
select register_sale((select biz from ctx), null, (select pedro from ctx),
  jsonb_build_array(jsonb_build_object('kind', 'service', 'ref_id', (select corte from ctx), 'qty', 1)),
  '[{"method": "nequi", "amount": 25000}]'::jsonb);

select auth.test_login((select owner_u from ctx));

create temp table res (wk date, week jsonb, days jsonb[]);
grant all on res to public;
-- Esta semana (con las ventas de arriba) y la anterior
insert into res
select w, weekly_summary((select biz from ctx), w),
       array(select cash_day_summary((select biz from ctx), w + d) from generate_series(0, 6) d order by d)
from unnest(array[(select wk from ctx), (select wk from ctx) - 7]) w;

-- Suma de un campo de los barberos de los 7 cierres
create function pg_temp.days_barbers(p_days jsonb[], p_field text) returns bigint language sql as $$
  select coalesce(sum((b ->> p_field)::int), 0)
  from unnest(p_days) d, jsonb_array_elements(d -> 'barbers') b
$$;
create function pg_temp.days_total(p_days jsonb[]) returns bigint language sql as $$
  select coalesce(sum((d ->> 'total')::int), 0) from unnest(p_days) d
$$;
create function pg_temp.week_commissions(p_week jsonb) returns bigint language sql as $$
  select coalesce(sum((b ->> 'commission')::int), 0) + (p_week ->> 'productCommission')::int
  from jsonb_array_elements(p_week -> 'barbers') b
$$;

select ok((select (week ->> 'sold')::int >= 54000 from res where wk = (select wk from ctx)),
          'REQ-078.32 la semana tiene ventas (la prueba no es vacía)');

select is((select (week ->> 'sold')::bigint from res where wk = (select wk from ctx)),
          (select pg_temp.days_total(days) from res where wk = (select wk from ctx)),
          'REQ-078.32 Ingresos de la semana = suma del total de la caja de cada día');
select is((select (week ->> 'sold')::bigint from res where wk = (select wk from ctx) - 7),
          (select pg_temp.days_total(days) from res where wk = (select wk from ctx) - 7),
          'REQ-078.32 Ingresos de la semana anterior = suma de la caja de cada día');

select is((select pg_temp.week_commissions(week) from res where wk = (select wk from ctx)),
          (select pg_temp.days_barbers(days, 'commission') + pg_temp.days_barbers(days, 'productCommission')
           from res where wk = (select wk from ctx)),
          'REQ-078.32 Comisiones de la semana = comisiones de servicios y productos de la caja de cada día');
select is((select pg_temp.week_commissions(week) from res where wk = (select wk from ctx) - 7),
          (select pg_temp.days_barbers(days, 'commission') + pg_temp.days_barbers(days, 'productCommission')
           from res where wk = (select wk from ctx) - 7),
          'REQ-078.32 Comisiones de la semana anterior = las de la caja de cada día');

-- A pagar de cada barbero = suma de su "toPay" de la caja de cada día
select is((select coalesce(sum((b ->> 'toPay')::int), 0) from res, jsonb_array_elements(week -> 'barbers') b
           where wk = (select wk from ctx) - 7),
          (select pg_temp.days_barbers(days, 'toPay') from res where wk = (select wk from ctx) - 7),
          'REQ-078.32 A pagar de la semana = suma del A pagar de la caja de cada día');

select * from finish();
rollback;
