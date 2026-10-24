#!/usr/bin/env bash
# Postgres local de pruebas sin Docker (decisions.md ADR-015).
#
#   scripts/db-local.sh start   # inicia el clúster (lo crea si no existe)
#   scripts/db-local.sh reset   # recrea la base: shim + migraciones + seed   (por defecto)
#   scripts/db-local.sh test    # corre las pruebas pgTAP de supabase/tests
#   scripts/db-local.sh stop
#
# Variables: PG_BIN (por defecto /usr/lib/postgresql/16/bin), PG_PORT (54329), PG_DB (turnos)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PG_BIN="${PG_BIN:-/usr/lib/postgresql/16/bin}"
PG_PORT="${PG_PORT:-54329}"
PG_DB="${PG_DB:-turnos}"
PG_DIR="$ROOT/.pg"
DATA="$PG_DIR/data"
SOCK="$PG_DIR"
export PGPASSWORD=postgres

# Postgres no corre como root: si somos root, delegamos en el usuario "postgres".
run_as_pg() {
  if [ "$(id -u)" = "0" ]; then
    runuser -u postgres -- "$@"
  else
    "$@"
  fi
}

psql_db() { psql -v ON_ERROR_STOP=1 -h 127.0.0.1 -p "$PG_PORT" -U postgres "$@"; }

ensure_cluster() {
  mkdir -p "$PG_DIR"
  [ "$(id -u)" = "0" ] && chown -R postgres:postgres "$PG_DIR"
  if [ ! -f "$DATA/PG_VERSION" ]; then
    echo "→ initdb en $DATA"
    run_as_pg "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust --encoding=UTF8 --locale=C.UTF-8 >/dev/null
    cat >> "$DATA/postgresql.conf" <<EOF
port = $PG_PORT
listen_addresses = '127.0.0.1'
unix_socket_directories = '$SOCK'
shared_preload_libraries = 'pg_cron'
cron.database_name = '$PG_DB'
timezone = 'UTC'
log_min_messages = warning
EOF
  fi
}

start() {
  ensure_cluster
  if run_as_pg "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
    echo "→ Postgres ya está corriendo en el puerto $PG_PORT"
  else
    run_as_pg "$PG_BIN/pg_ctl" -D "$DATA" -l "$PG_DIR/postgres.log" -w start >/dev/null
    echo "→ Postgres iniciado en el puerto $PG_PORT"
  fi
}

stop() {
  if [ -f "$DATA/PG_VERSION" ]; then
    run_as_pg "$PG_BIN/pg_ctl" -D "$DATA" -m fast stop >/dev/null 2>&1 || true
    echo "→ Postgres detenido"
  fi
}

reset() {
  start
  echo "→ Recreando base $PG_DB"
  psql_db -d postgres -q -c "drop database if exists $PG_DB with (force);" -c "create database $PG_DB;"
  echo "→ Shim de Supabase (solo local)"
  psql_db -d "$PG_DB" -q -f "$ROOT/supabase/local/0000_supabase_shim.sql"
  for m in "$ROOT"/supabase/migrations/*.sql; do
    [ -e "$m" ] || continue
    echo "→ Migración $(basename "$m")"
    psql_db -d "$PG_DB" -q -f "$m"
  done
  if [ -s "$ROOT/supabase/seed.sql" ]; then
    echo "→ Seed"
    psql_db -d "$PG_DB" -q -f "$ROOT/supabase/seed.sql"
  fi
  echo "✓ Base lista: postgres://postgres:postgres@127.0.0.1:$PG_PORT/$PG_DB"
}

test_db() {
  start
  psql_db -d "$PG_DB" -q -c "create extension if not exists pgtap;"
  pg_prove -h 127.0.0.1 -p "$PG_PORT" -U postgres -d "$PG_DB" "$ROOT"/supabase/tests/*.sql
}

case "${1:-reset}" in
  start) start ;;
  stop) stop ;;
  reset) reset ;;
  test) test_db ;;
  *) echo "uso: $0 {start|stop|reset|test}"; exit 1 ;;
esac
