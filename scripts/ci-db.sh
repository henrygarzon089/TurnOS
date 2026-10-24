#!/usr/bin/env bash
# Postgres 16 de pruebas en Docker con pgTAP + pg_cron + el shim de Supabase (ADR-015).
# Lo usa el CI y sirve en cualquier máquina con Docker (sin Postgres instalado):
#
#   scripts/ci-db.sh up      # crea el contenedor, aplica shim + migraciones + seed
#   scripts/ci-db.sh test    # pgTAP (supabase/tests)
#   scripts/ci-db.sh down
#
# Variables: CI_DB_NAME (turnos-ci-db), CI_DB_PORT (54329). Base: postgres.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NAME="${CI_DB_NAME:-turnos-ci-db}"
PORT="${CI_DB_PORT:-54329}"
P=(docker exec -i "$NAME" psql -v ON_ERROR_STOP=1 -q -U postgres -d postgres)

wait_ready() { until docker exec "$NAME" pg_isready -q -U postgres 2>/dev/null; do sleep 1; done; }

up() {
  docker rm -f "$NAME" >/dev/null 2>&1 || true
  docker run -d --name "$NAME" -e POSTGRES_PASSWORD=postgres -p "127.0.0.1:$PORT:5432" postgres:16 >/dev/null
  wait_ready
  docker exec "$NAME" bash -c "apt-get update -qq >/dev/null && DEBIAN_FRONTEND=noninteractive \
    apt-get install -y -qq postgresql-16-pgtap postgresql-16-cron libtap-parser-sourcehandler-pgtap-perl >/dev/null"
  "${P[@]}" -c "alter system set shared_preload_libraries = 'pg_cron'" -c "alter system set timezone = 'UTC'"
  docker restart "$NAME" >/dev/null
  wait_ready
  echo "→ Shim de Supabase (solo pruebas)"
  "${P[@]}" < "$ROOT/supabase/local/0000_supabase_shim.sql"
  for m in "$ROOT"/supabase/migrations/*.sql; do
    echo "→ $(basename "$m")"
    "${P[@]}" < "$m"
  done
  echo "→ Seed"
  "${P[@]}" < "$ROOT/supabase/seed.sql"
  "${P[@]}" -c "create extension if not exists pgtap;"
  echo "✓ postgres://postgres:postgres@127.0.0.1:$PORT/postgres"
}

test_db() {
  docker exec "$NAME" rm -rf /tmp/t
  docker exec "$NAME" mkdir /tmp/t
  for f in "$ROOT"/supabase/tests/*.sql; do docker cp -q "$f" "$NAME:/tmp/t/"; done
  docker exec "$NAME" bash -c "pg_prove -U postgres -d postgres /tmp/t/*.sql"
}

case "${1:-up}" in
  up) up ;;
  test) test_db ;;
  down) docker rm -f "$NAME" >/dev/null ;;
  *) echo "uso: $0 {up|test|down}"; exit 1 ;;
esac
