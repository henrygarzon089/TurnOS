-- Las pruebas pgTAP corren sobre la base ya sembrada por scripts/db-local.sh.
begin;
select plan(8);

select is((select count(*)::int from businesses where slug = 'la-33'), 1,
  'REQ-034.1 existe Barbería La 33');
select is((select count(*)::int from barbers b join businesses z on z.id = b.business_id where z.slug = 'la-33'),
  5, 'REQ-034.1 5 barberos');
select is((select count(distinct commission_pct)::int from barbers b join businesses z on z.id = b.business_id where z.slug = 'la-33'),
  3, 'REQ-034.1 comisiones distintas (50/60/70)');
select is((select count(*)::int from memberships m join businesses z on z.id = m.business_id where z.slug = 'la-33' and m.role = 'barber'),
  5, 'REQ-034.1 cada barbero tiene acceso');
select is((select count(*)::int from services s join businesses z on z.id = s.business_id where z.slug = 'la-33'),
  6, 'REQ-034.1 servicios con precios en COP');
select is((select price from services s join businesses z on z.id = s.business_id where z.slug = 'la-33' and s.name = 'Corte'),
  25000, 'REQ-034.1 Corte = $ 25.000');
select is((select count(*)::int from products p join businesses z on z.id = p.business_id where z.slug = 'la-33'),
  4, 'REQ-034.1 productos (helados y bebidas)');
select is((select count(*)::int from business_hours h join businesses z on z.id = h.business_id where z.slug = 'la-33' and not h.is_closed),
  7, 'PA-26 abre los 7 días');

select * from finish();
rollback;
