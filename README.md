# TurnOS

Fila virtual, clientes y caja para negocios de servicios de barrio en Colombia. Primer cliente:
una barbería en Sabaneta.

El proyecto se construye con **Spec-Driven Development**: la carpeta [`specs/`](./specs) es la
fuente de verdad (`constitution.md` → `requirements.md` → `design.md` → `tasks.md` →
`decisions.md`). Si el código y la especificación no coinciden, se corrige uno de los dos de forma
explícita.

## Stack

Next.js (App Router) + TypeScript + Tailwind · Supabase (Postgres, Auth, Realtime) · Vercel ·
PWA mobile-first · 100 % en español, COP sin decimales, `America/Bogota`.

## Requisitos

- Node 22 y pnpm 10.
- Postgres 16 con las extensiones `pgtap`, `pg_trgm` y `pg_cron` (para la base local de pruebas),
  **o** Docker + Supabase CLI (`supabase start`).

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | servidor de desarrollo en http://localhost:3000 |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | calidad de código |
| `pnpm test` | pruebas unitarias (Vitest) |
| `pnpm test:integration` | pruebas de integración contra la base local |
| `pnpm db:local` | levanta/reinicia Postgres local con shim de Supabase + migraciones + seed |
| `pnpm db:test` | pruebas pgTAP de las migraciones |
| `pnpm build` | build de producción |

## Variables de entorno

Copia `.env.example` a `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor.

## Cómo probar desde el celular

Con `pnpm dev` corriendo, abre `http://<IP-de-tu-computador>:3000` desde el celular en la misma
red Wi-Fi, o usa el despliegue de Vercel. Cada tarea en `specs/tasks.md` indica, al marcarse
terminada, qué probar.
