begin;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000073d1', 'dueno-ext@test.local');
select auth.test_login('00000000-0000-0000-0000-0000000073d1');
select create_business('Barbería Ext', 'barberia-ext');
select auth.test_logout();

prepare ins(text) as
  insert into barbers (business_id, display_name, phone_e164, commission_pct)
  select id, 'Pedro', $1, 50 from businesses where slug = 'barberia-ext';

select lives_ok('execute ins(''+5491123456789'')',
  'REQ-081.2 acepta un celular de Argentina en E.164');
select lives_ok('execute ins(''+13055550101'')',
  'REQ-081.2 acepta otro E.164 de 11 dígitos');
select lives_ok('execute ins(''+573001234567'')',
  'REQ-081.2 un celular colombiano sigue entrando');
select throws_ok('execute ins(''+576041234567'')', '23514', null,
  'REQ-081.2 un +57 debe cumplir la regla colombiana');
select throws_ok('execute ins(''5491123456789'')', '23514', null,
  'REQ-081.2 rechaza un número sin +');
select throws_ok('execute ins(''+54 9 11 2345'')', '23514', null,
  'REQ-081.2 rechaza espacios y letras: solo E.164');

select * from finish();
rollback;
