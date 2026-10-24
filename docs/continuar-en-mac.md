# Continuar la construcción desde tu Mac

## 1. Bajar el repositorio

Descarga `turnos-main.bundle` del chat (es el repo git completo) y en la terminal:

```bash
cd ~/Projects
git clone turnos-main.bundle TurnOS
cd TurnOS
git remote set-url origin https://github.com/henrygarzon089/TurnOS.git
git push -u origin main
pnpm install
cp .env.example .env.local   # y completa las llaves de tu proyecto de Supabase
```

Si más adelante recibes otro bundle con commits nuevos: `git pull turnos-main.bundle main && git push`.

## 2. Base de datos local (con Docker, como ya lo usas)

```bash
supabase start            # levanta Postgres + Auth + Realtime locales con pgtap y pg_cron
supabase db reset         # aplica supabase/migrations/*.sql y supabase/seed.sql
pnpm db:test              # pgTAP  (ajusta PG_PORT=57322 si usas el Postgres de supabase start)
```

> El shim `supabase/local/0000_supabase_shim.sql` **no** se aplica con `supabase start`: ahí
> `auth.uid()` y `realtime.send` ya existen. Solo lo usa `scripts/db-local.sh` cuando no hay Docker.

Para `pnpm db:test` y `pnpm test:integration` contra el Postgres de `supabase start`:

```bash
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:57322/postgres
PG_PORT=57322 pg_prove -h 127.0.0.1 -p 57322 -U postgres -d postgres supabase/tests/*.sql
pnpm test:integration
```

## 3. Proyecto real de Supabase (uucjmxdssnmvznibrafc)

```bash
supabase login
supabase link --project-ref uucjmxdssnmvznibrafc
supabase db push                       # aplica las 13 migraciones
pnpm seed:users                        # crea dueño + 5 barberos en Auth (usa .env.local)
psql "$SUPABASE_DB_URL" -f supabase/seed.sql   # cadena de conexión del dashboard → Database → Connect
```

Credenciales del seed: dueño `dueno@la33.test` / `turnos123`; barberos celular `300 100 0001`…`0005`
con PIN `111111`…`555555`. Fila pública: `/la-33`.

En _Authentication → Providers → Email_ desactiva "Confirm email" (los barberos usan correos alias).

## 4. Vercel

Importa el repo `henrygarzon089/TurnOS` en tu cuenta personal y define
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` y
`NEXT_PUBLIC_APP_URL` (la URL del despliegue, sin barra final). Cada push a `main` despliega.

## 5. Probar y seguir construyendo

```bash
pnpm dev                 # http://localhost:3000 — desde el celular: http://<IP-de-tu-Mac>:3000
pnpm test                # unitarias
pnpm test:e2e            # Playwright móvil (necesita el proyecto de Supabase en .env.local)
pnpm trace               # regenera specs/traceability.md
```

Para continuar con Claude Code en tu Mac, abre la carpeta y dile:

> Lee `specs/constitution.md`, `specs/requirements.md`, `specs/design.md`, `specs/decisions.md`
> y `specs/tasks.md`. Seguimos con Spec-Driven Development: implementa la siguiente tarea
> pendiente de `tasks.md` (T-033), primero las pruebas, luego el código; márcala al terminar y
> dime cómo probarla desde el celular. Si la especificación está incompleta, detente y propón el
> cambio antes de seguir.

Las tareas marcadas `[~]` ya tienen código y pruebas escritas; les falta correr los E2E contra el
proyecto remoto para pasar a `[x]`.
