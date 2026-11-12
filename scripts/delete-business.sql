-- ============================================================================
-- Borrar un negocio completo por su enlace (slug). T-190 · REQ-080.3, REQ-080.4 · design.md §23.6
--
-- Uso (lo corre Henry; guía paso a paso en docs/guia-borrar-negocio.md):
--
--   1) Simulación: imprime cuántas filas borraría por tabla y NO borra nada.
--      psql "<cadena de conexión>" -v slug=filo -f scripts/delete-business.sql
--
--   2) Borrado: solo si confirm es EXACTAMENTE igual al slug.
--      psql "<cadena de conexión>" -v slug=filo -v confirm=filo -f scripts/delete-business.sql
--
-- Qué hace con confirmación, en UNA transacción (si algo falla, no se borra nada):
--   * guarda las cuentas del personal del negocio (memberships);
--   * apaga, solo dentro de la transacción, los disparadores de usuario de las tablas del negocio
--     y los vuelve a encender antes de terminar. Las migraciones no cambian. Hace falta porque
--     stock_movements_guard es `before delete` y frena el borrado, y porque las guardas
--     `before update` (sales_guard, cash_closures_guard…) pueden saltar cuando un
--     `on delete set null` (cliente → venta) toca una fila antes de que la cascada la borre;
--   * borra las filas de las tablas con business_id a las que no llega ningún `on delete cascade`
--     desde businesses (hoy: inventory_usage, stock_count_lines, stock_counts y stock_movements,
--     cuyas llaves son `no action`), y después `delete from businesses`, que borra el resto en
--     cascada;
--   * revisa que no quede ni una fila del negocio en ninguna tabla con business_id;
--   * borra de auth.users las cuentas guardadas que no tengan membresía ni barbero en otro negocio.
--
-- Las tablas se descubren del catálogo (toda tabla con columna business_id), no de una lista a
-- mano: una tabla nueva entra sola en los conteos y en la revisión final.
--
-- Los archivos de Storage (buckets media y cleaning, carpeta <id del negocio>/) NO se borran con
-- SQL: el script los lista para borrarlos desde el panel de Supabase.
--
-- Requisitos: psql con conexión directa o "session pooler" (puerto 5432), porque las funciones
-- son temporales (pg_temp) y viven solo en esta sesión. Con el pooler de transacciones (6543) no
-- funciona. El rol debe saltarse RLS (postgres o superusuario) y ser dueño de las tablas.
--
-- Pruebas: supabase/tests/delete_business.sql incluye este archivo con `\set define_only 1`, que
-- solo define las funciones, y prueba esas mismas funciones.
-- ============================================================================

\set ON_ERROR_STOP on
\set QUIET on

-- ------------------------------------------------------------------ funciones (pg_temp) ----

-- El conteo y el borrado leen tablas con RLS forzada: sin saltarse RLS verían 0 filas y el
-- borrado "no encontraría nada". Se aborta antes de imprimir conteos engañosos.
create or replace function pg_temp.tb_check_role() returns void
language plpgsql as $fn$
begin
  if not exists (select 1 from pg_roles where rolname = current_user and (rolsuper or rolbypassrls)) then
    raise exception 'El rol % no se salta RLS: los conteos saldrían en 0. Conéctate como postgres.', current_user;
  end if;
end $fn$;

-- Toda tabla con columna business_id, y si le llega un `on delete cascade` desde businesses
-- (directo o a través de otra tabla en cascada).
create or replace function pg_temp.tb_business_tables()
returns table (tabla regclass, en_cascada boolean)
language sql stable as $fn$
  with recursive tablas as (
    select c.oid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    join pg_attribute a on a.attrelid = c.oid and a.attname = 'business_id' and not a.attisdropped
    where c.relkind in ('r', 'p') and not c.relispartition
      and n.nspname not in ('pg_catalog', 'information_schema') and n.nspname not like 'pg\_%'
  ), cascada as (
    select k.conrelid as rel from pg_constraint k
    where k.contype = 'f' and k.confdeltype = 'c' and k.confrelid = 'public.businesses'::regclass
    union
    select k.conrelid from pg_constraint k join cascada p on k.confrelid = p.rel
    where k.contype = 'f' and k.confdeltype = 'c'
  )
  select t.oid::regclass, exists (select 1 from cascada c where c.rel = t.oid)
  from tablas t
  order by t.oid::regclass::text
$fn$;

create or replace function pg_temp.tb_find_business(p_slug text) returns uuid
language plpgsql as $fn$
declare
  v_id uuid;
begin
  if p_slug is null or p_slug = '' then
    raise exception 'Falta el enlace del negocio (-v slug=...). No se borró nada.';
  end if;
  select id into v_id from public.businesses where slug = p_slug;
  if v_id is null then
    raise exception 'No existe un negocio con el enlace "%". No se borró nada.', p_slug;
  end if;
  return v_id;
end $fn$;

-- Cuentas del personal del negocio y si se borran (no tienen membresía ni barbero en otro negocio).
create or replace function pg_temp.tb_staff_accounts(p_business_id uuid)
returns table (user_id uuid, email text, se_borra boolean)
language sql stable as $fn$
  select u.id, u.email::text,
         not exists (select 1 from public.memberships m where m.user_id = u.id and m.business_id <> p_business_id)
         and not exists (select 1 from public.barbers b where b.user_id = u.id and b.business_id <> p_business_id)
  from auth.users u
  where u.id in (select m.user_id from public.memberships m where m.business_id = p_business_id)
  order by u.email
$fn$;

-- REQ-080.4 cuántas filas borraría por tabla (y las cuentas del personal que se borrarían).
create or replace function pg_temp.tb_business_counts(p_business_id uuid)
returns table (tabla text, filas bigint)
language plpgsql as $fn$
declare
  r record;
begin
  perform pg_temp.tb_check_role();
  tabla := 'public.businesses';
  select count(*) into filas from public.businesses where id = p_business_id;
  return next;
  for r in select * from pg_temp.tb_business_tables() loop
    tabla := r.tabla::text;
    execute format('select count(*) from %s where business_id = $1', r.tabla) into filas using p_business_id;
    return next;
  end loop;
  tabla := 'auth.users (cuentas del personal que se borran)';
  select count(*) into filas from pg_temp.tb_staff_accounts(p_business_id) s where s.se_borra;
  return next;
end $fn$;

-- Archivos del negocio en Storage: rutas <id del negocio>/... (media: 0033, cleaning: 0057).
create or replace function pg_temp.tb_storage_objects(p_business_id uuid)
returns table (bucket text, archivo text)
language sql stable as $fn$
  select o.bucket_id::text, o.name::text
  from storage.objects o
  where o.bucket_id in ('media', 'cleaning') and o.name like p_business_id::text || '/%'
  order by 1, 2
$fn$;

-- REQ-080.3 el borrado. Debe correr dentro de una transacción (el script abre una).
create or replace function pg_temp.tb_delete_business(p_slug text, p_confirm text)
returns table (tabla text, filas bigint)
language plpgsql as $fn$
declare
  v_id uuid;
  v_users uuid[];
  v_before jsonb := '{}';
  v_trg record;
  v_off text[] := '{}';
  r record;
  v_n bigint;
  v_pending int;
  v_progress boolean;
  v_err text;
begin
  -- REQ-080.4 sin la confirmación exacta no se borra nada
  if p_slug is null or p_confirm is null or p_confirm <> p_slug then
    raise exception 'Sin confirmación: confirm debe ser exactamente "%". No se borró nada.', p_slug;
  end if;
  perform pg_temp.tb_check_role();
  v_id := pg_temp.tb_find_business(p_slug);
  perform 1 from public.businesses where id = v_id for update;

  -- conteos de antes (para el informe) y cuentas del personal que se borran
  for r in select * from pg_temp.tb_business_counts(v_id) loop
    v_before := v_before || jsonb_build_object(r.tabla, r.filas);
  end loop;
  select coalesce(array_agg(s.user_id), '{}') into v_users from pg_temp.tb_staff_accounts(v_id) s where s.se_borra;

  -- Disparadores de usuario apagados solo en esta transacción: guardas de inmutabilidad
  -- (stock_movements_guard `before delete`; sales_guard y compañía `before update`, que saltan
  -- con los `on delete set null`), avisos en tiempo real y ganchos de inventario. Las llaves
  -- foráneas son disparadores internos y siguen activas.
  for v_trg in
    select t.tgrelid::regclass as rel, t.tgname, t.tgenabled
    from pg_trigger t
    where not t.tgisinternal and t.tgenabled <> 'D'
      and (t.tgrelid in (select b.tabla from pg_temp.tb_business_tables() b)
           or t.tgrelid = 'public.businesses'::regclass)
    order by 1, 2
  loop
    execute format('alter table %s disable trigger %I', v_trg.rel, v_trg.tgname);
    -- se vuelven a encender en su modo original: O (normal), A (always) o R (replica)
    v_off := v_off || format('alter table %s enable %s trigger %I', v_trg.rel,
      case v_trg.tgenabled when 'A' then 'always' when 'R' then 'replica' else '' end, v_trg.tgname);
  end loop;

  -- Tablas a las que no llega la cascada (sus llaves son `no action` hacia otras tablas del
  -- negocio). Se borran primero; si una falla por llave foránea, se reintenta en otra vuelta.
  loop
    v_pending := 0;
    v_progress := false;
    for r in select b.tabla from pg_temp.tb_business_tables() b where not b.en_cascada loop
      execute format('select count(*) from %s where business_id = $1', r.tabla) into v_n using v_id;
      continue when v_n = 0;
      begin
        execute format('delete from %s where business_id = $1', r.tabla) using v_id;
        v_progress := true;
      exception when foreign_key_violation then
        v_pending := v_pending + 1;
        v_err := sqlerrm;
      end;
    end loop;
    exit when v_pending = 0;
    if not v_progress then
      raise exception 'No se pudieron borrar las tablas sin cascada: %', v_err;
    end if;
  end loop;

  -- El resto (y el negocio) en cascada, en una sola sentencia: así los ciclos entre tablas
  -- (turno ↔ cita, venta ↔ tarjeta de fidelidad) se revisan al final de la sentencia.
  delete from public.businesses where id = v_id;

  -- Nada del negocio puede quedar
  for r in select b.tabla from pg_temp.tb_business_tables() b loop
    execute format('select count(*) from %s where business_id = $1', r.tabla) into v_n using v_id;
    if v_n > 0 then
      raise exception 'Quedaron % filas en % después del borrado. Se deshace todo.', v_n, r.tabla;
    end if;
  end loop;

  -- Disparadores encendidos otra vez, como estaban
  for i in 1 .. coalesce(array_length(v_off, 1), 0) loop
    execute v_off[i];
  end loop;

  -- Cuentas del personal sin otro negocio (memberships se va en cascada desde auth.users)
  delete from auth.users u where u.id = any (v_users)
    and not exists (select 1 from public.memberships m where m.user_id = u.id)
    and not exists (select 1 from public.barbers b where b.user_id = u.id);
  get diagnostics v_n = row_count;

  for r in select key, value from jsonb_each(v_before) loop
    tabla := r.key;
    filas := case when r.key like 'auth.users%' then v_n else r.value::bigint end;
    continue when filas = 0;
    return next;
  end loop;
end $fn$;

-- --------------------------------------------------------------------------- ejecución ----
\if :{?define_only}
\else
  \if :{?slug}
  \else
    \echo 'Falta el enlace del negocio: agrega -v slug=<enlace> (por ejemplo -v slug=filo).'
    select pg_temp.tb_find_business(null);
  \endif
  \if :{?confirm}
  \else
    \set confirm ''
  \endif

  \pset footer off
  select pg_temp.tb_find_business(:'slug') as business_id \gset
  \echo
  \echo 'Negocio:' :slug '· id:' :business_id
  \echo
  \echo 'Filas del negocio por tabla (esto es lo que se borraría):'
  select tabla as "Tabla", filas as "Filas"
  from pg_temp.tb_business_counts(:'business_id') order by (filas = 0), tabla;

  \echo 'Cuentas del personal ("Se borra" = f: tiene otro negocio y se conserva):'
  select email as "Correo", se_borra as "Se borra" from pg_temp.tb_staff_accounts(:'business_id');

  select (:'confirm' = :'slug') as tb_confirmed \gset
  \if :tb_confirmed
    \echo 'CONFIRMADO: borrando el negocio' :slug '...'
    begin;
    select tabla as "Tabla", filas as "Filas borradas" from pg_temp.tb_delete_business(:'slug', :'confirm')
    order by tabla;
    commit;
    \echo 'Listo: el negocio' :slug 'y sus cuentas del personal se borraron.'
  \else
    \echo
    \echo 'SIMULACIÓN: no se borró nada. Para borrar, repite el comando agregando -v confirm=':slug
  \endif

  \echo
  \echo 'Archivos en Storage (se borran desde el panel: Storage > bucket > carpeta' :business_id '):'
  select bucket as "Bucket", archivo as "Archivo" from pg_temp.tb_storage_objects(:'business_id');
\endif
