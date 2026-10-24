begin;
select plan(4);

select has_extension('pgcrypto', 'T-002 pgcrypto instalada');
select has_extension('pg_trgm', 'T-002 pg_trgm instalada');
select has_extension('pg_cron', 'T-002 pg_cron instalada');
select has_function('auth', 'uid', 'T-002 auth.uid() disponible (shim o Supabase)');

select * from finish();
rollback;
