-- 0001 · Extensiones (T-002)
-- pgcrypto: gen_random_bytes para tokens públicos (NFR-004)
-- pg_trgm:  búsqueda de clientes por nombre (REQ-018.3)
-- pg_cron:  cierre automático de la fila (REQ-014, ADR-014)
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;
create extension if not exists pg_cron;
