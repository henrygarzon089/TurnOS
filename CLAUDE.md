# TurnOS — guía para Claude Code

Lee esto primero. Es el contexto que necesitas para continuar el proyecto exactamente como se venía
construyendo. El resto del contexto vive en `specs/` y en `docs/estado-del-proyecto.md`.

## Qué es

TurnOS: fila virtual con QR, clientes/fidelidad y caja/comisiones para negocios de servicios de
barrio en Colombia. Primer cliente: una barbería en Sabaneta (5 sillas, barberos independientes a
comisión, venta de helados y bebidas). Dueño del producto: Henry Garzón.

## Método: Spec-Driven Development (no negociable)

1. `specs/constitution.md` → principios. `specs/requirements.md` → REQ-NNN con criterios
   `REQ-NNN.n` (EARS). `specs/design.md` → arquitectura, datos, RLS, estados, algoritmos.
   `specs/tasks.md` → tareas T-NNN por hito. `specs/decisions.md` → ADR-NNN.
2. **La especificación es la fuente de verdad.** Si el código y la spec no coinciden, se corrige uno
   de los dos de forma explícita (nota en `tasks.md`/`design.md` + ADR si cambia el diseño). Nunca
   en silencio.
3. **Una tarea a la vez, en orden.** Para cada tarea: primero las pruebas (derivadas de los CA),
   luego el código. Al terminar: marcar `[x]` en `tasks.md` (con nota si hubo desvío), commit
   `T-NNN: …`, y decirle a Henry cómo probarla desde el celular.
4. Si descubres que la spec está incompleta o incorrecta: **detente**, propón el cambio en
   `requirements.md` o `design.md` y espera aprobación.
5. Cada hito cierra con `pnpm trace` (matriz REQ → tareas → pruebas → estado) sin huecos.

Las pruebas llevan el CA en el nombre: `it('REQ-003.5 …')`, pgTAP `'REQ-003.5 …'`.
`scripts/traceability.ts` las encuentra así. `--hito=N` falla si falta alguna.

## Estado actual (2026-10-24)

- Hito 0 y Hito 1: construidos. Trazabilidad Hito 1: 144/144 CA con prueba.
- Hito 2: T-031 y T-032 hechas. **Siguiente: T-033** (lista y ficha de cliente).
- Tareas `[~]`: código y pruebas listos; falta correr E2E contra el proyecto remoto de Supabase.
- Ver `docs/estado-del-proyecto.md` para el detalle y los pendientes externos.

## Stack y convenciones

- Next.js 16 (App Router, `src/proxy.ts` en vez de middleware, `cacheComponents: false`),
  TypeScript, Tailwind 4, Supabase (Postgres, Auth, Realtime), pnpm, Vitest, Playwright, pgTAP.
- Identificadores/código en inglés; **toda la UI en español colombiano**. `pnpm lint:texts` falla
  si hay texto visible en inglés.
- Dinero: `integer` COP, `formatCOP`/`parseCOP` (`src/lib/domain/money.ts`). Nunca `float`.
- Tiempo: `America/Bogota`, helpers en `src/lib/domain/time.ts`; `business_day_bogota()` en SQL.
- Celulares: E.164 `+573XXXXXXXXX`, `normalizePhoneCO`.
- Multi-tenant: todas las tablas con `business_id` + RLS forzada. `anon` no tiene acceso: las
  páginas públicas usan server actions con `service_role` → funciones SQL (`ADR-009`).
- Tiempo real: canal Broadcast `queue:<business_id>` con `queue_changed` y relectura (`ADR-008`).
- Lógica de negocio en funciones SQL `security definer` (`transition_ticket`, `call_next`,
  `join_queue`, `register_sale`…), probadas con pgTAP. Lógica pura en `src/lib/domain/`.
- Server actions: `src/lib/actions/{auth,admin,queue,public,customers,cash}.ts`.
- Gateway (`src/lib/db/gateway.ts`): las acciones públicas se prueban contra Postgres local con
  `tests/integration/pg-gateway.ts`.
- Estilos: tokens en `globals.css` (`bg-accent`, `text-muted`…), botones `.btn-primary` ≥ 48 px.

## Comandos

```bash
pnpm dev · pnpm lint · pnpm typecheck · pnpm lint:texts · pnpm test · pnpm test:integration
pnpm db:local   # Postgres local SIN Docker (scripts/db-local.sh, shim de Supabase, ADR-015)
pnpm db:test    # pgTAP
supabase start && supabase db reset   # alternativa CON Docker (no aplica el shim)
pnpm test:e2e   # Playwright móvil; necesita proyecto de Supabase en .env.local
pnpm trace      # regenera specs/traceability.md
```

## Cosas que ya se decidieron (no reabrir sin ADR)

Ver `specs/decisions.md` (ADR-001…ADR-015). Resumen: barbero entra con celular + PIN de 6 dígitos
(cuenta alias `<cel>@barberos.turnos.local`); un solo servicio por turno; el barbero solo llama al
primero de su fila, el dueño sí puede saltar/reordenar; toda la plata entra al negocio y el negocio
liquida comisiones; el porcentaje es la parte del barbero sobre servicios después de descuento;
premio de fidelidad: comisión sobre precio de lista, la asume el negocio; cierres de caja
inmutables, reabrir solo el dueño con motivo.

## Seed y credenciales de prueba

Barbería La 33 (`/la-33`). Dueño `dueno@la33.test` / `turnos123`. Barberos: celular `300 100 0001`
a `0005`, PIN `111111` a `555555`. 30 clientes con historial, fidelidad activa (10 cortes).
En un proyecto real: `pnpm seed:users` crea los usuarios de Auth antes de aplicar `supabase/seed.sql`.
