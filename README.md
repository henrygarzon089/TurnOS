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

| Comando                                        | Qué hace                                                                  |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                     | servidor de desarrollo en http://localhost:3000                           |
| `pnpm lint` / `pnpm typecheck` / `pnpm format` | calidad de código                                                         |
| `pnpm test`                                    | pruebas unitarias (Vitest)                                                |
| `pnpm test:integration`                        | pruebas de integración contra la base local                               |
| `pnpm db:local`                                | levanta/reinicia Postgres local con shim de Supabase + migraciones + seed |
| `pnpm db:test`                                 | pruebas pgTAP de las migraciones                                          |
| `scripts/ci-db.sh up` / `test` / `down`        | base de pruebas en Docker (Postgres 16 + shim), la misma del CI           |
| `pnpm build`                                   | build de producción                                                       |
| `pnpm lighthouse`                              | Lighthouse móvil de /[slug], /t/[token] y /app/fila (ver abajo)           |

## Variables de entorno

Copia `.env.example` a `.env.local`. `SUPABASE_SERVICE_ROLE_KEY` solo se usa en el servidor.

## Cómo probar desde el celular

Con `pnpm dev` corriendo, abre `http://<IP-de-tu-computador>:3000` desde el celular en la misma
red Wi-Fi, o usa el despliegue de Vercel. Cada tarea en `specs/tasks.md` indica, al marcarse
terminada, qué probar.

## Rendimiento (NFR-001, T-029)

```bash
pnpm build && pnpm start -p 3100            # en una terminal
LH_BASE_URL=http://localhost:3100 pnpm lighthouse
```

Falla si alguna pantalla baja de 80 en rendimiento o de 90 en accesibilidad. Medición del
2026-10-24 en la Mac contra `supabase start`: portada 97/100 (LCP 2,6 s), Mi turno 98/100
(LCP 2,1 s), Mi fila 96/100 (LCP 2,6 s).

## Instalar como app (REQ-032.1) — verificación manual

Cada barbería se instala con **su nombre** (PA-22; se cambia en Administración → Negocio →
"Nombre de la app en el celular del cliente"). La app del personal se instala como **TurnOS**.
Requiere HTTPS (el despliegue de Vercel); en `http://<IP>:3000` Android solo crea un acceso
directo.

**Android (Chrome)**

1. Abre `https://<tu-dominio>/la-33`.
2. Menú ⋮ → **Instalar app** (o el aviso "Agregar a la pantalla principal").
3. Verifica: el ícono dice "Barbería La…" y al abrirlo no se ve la barra del navegador; abre la
   fila de la barbería.

**iPhone (Safari)**

1. Abre `https://<tu-dominio>/la-33` en Safari.
2. Botón Compartir → **Agregar a inicio**. El nombre propuesto es el de la barbería.
3. Verifica: abre a pantalla completa, en la fila de la barbería.

**Personal**: repite con `https://<tu-dominio>/entrar`; se instala como "TurnOS" y abre en
`/app`.

| Fecha      | Dispositivo      | Resultado                                  | Quién |
| ---------- | ---------------- | ------------------------------------------ | ----- |
| 2026-10-25 | Android (Chrome) | Se instala y abre la fila de la barbería ✓ | Henry |
| 2026-10-25 | iPhone (Safari)  | Se instala y abre la fila de la barbería ✓ | Henry |
