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

- **MVP completo**: Hitos 0–3 aprobados por Henry (ADR-017, ADR-020) y en producción. Matriz: 144 CA,
  0 sin prueba. Prueba de pasillo e instalación hechas (ADR-021). Abierta solo T-010 (E2E en CI,
  proteger `main`).
- Producción: https://turnos-smoky-nine.vercel.app (Vercel `henry-garzons-projects/turnos` +
  Supabase `uucjmxdssnmvznibrafc`). CI en GitHub `henrygarzon089/TurnOS`.
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
- Server actions: `src/lib/actions/{auth,admin,queue,public,customers,cash}.ts`. Caja: `register_sale`,
  `void_sale`, `cash_day_summary`, `close_cash_day`, `weekly_summary` (migraciones 0021–0027).
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

Ver `specs/decisions.md` (ADR-001…ADR-021). Resumen: barbero entra con celular + PIN de 6 dígitos
(cuenta alias `<cel>@barberos.turnos.local`); un solo servicio por turno; el barbero solo llama al
primero de su fila, el dueño sí puede saltar/reordenar; toda la plata entra al negocio y el negocio
liquida comisiones; el porcentaje es la parte del barbero sobre servicios después de descuento;
premio de fidelidad: comisión sobre precio de lista, la asume el negocio; cierres de caja
inmutables, reabrir solo el dueño con motivo.

## Seed y credenciales de prueba

Barbería La 33 (`/la-33`). Dueño `dueno@la33.test` / `turnos123`. Barberos: celular `300 100 0001`
a `0005`, PIN `111111` a `555555`. 30 clientes con historial, fidelidad activa (10 cortes).
En un proyecto real: `pnpm seed:users` crea los usuarios de Auth antes de aplicar `supabase/seed.sql`.

<!-- agent-kit:start -->
## Seguridad
- Nunca leer, imprimir ni pegar `.env*`, llaves, tokens, dumps de BD ni datos reales de clientes (barberos, clientes de la fila, PINs). `.claude/settings.json` bloquea la lectura de `.env*`.
- Comandos destructivos (`rm -rf`, `git push --force`, migraciones, SQL en producción, deploys a prod) requieren confirmación explícita de Henry.
- Supabase/Vercel: solo branches y previews desde el agente. Producción la ejecuta Henry.

## Git
- Sin atribución de IA en commits, PRs ni issues. Staging por rutas explícitas; nunca `git add -A`.
- Una sesión = una tarea = una rama/PR.

## Documentación (dónde vive cada cosa en este repo)
- Estado: `docs/estado-del-proyecto.md` (es el ESTADO de este repo). Actualízalo al cerrar cada sesión.
- Decisiones: `specs/decisions.md` (ADR-NNN). Requisitos y tareas: `specs/requirements.md`, `specs/tasks.md`.
- Glosario: `CONTEXT.md`. Términos del dominio (fila, turno, barbero, dueño, cierre de caja, liquidación…).
<!-- agent-kit:end -->

<!-- skills-flow:start -->
## Flujo de skills

Propón la skill en el momento indicado; si Henry dice que no, sigue sin ella. El método SDD de este repo manda: las skills lo apoyan, no lo reemplazan.

| Fase | Skill | Cuándo proponerla |
|---|---|---|
| Idea / decisión | `/abogado-del-diablo` | Antes de un ADR nuevo o una decisión cara (precios, pagos, datos de clientes) |
| Diseño | `/grill-with-docs` | Requisito nuevo o ambiguo, antes de escribirlo en `specs/requirements.md` |
| Construcción | `/tdd` | Cada tarea de `specs/tasks.md`, test primero |
| Construcción | `/caveman` | Sesiones largas de código; apagar para grills, reviews y textos para el cliente |
| Bugs | `/diagnosing-bugs` | Tras dos intentos fallidos con un bug |
| Revisión | `/code-review` | Antes de abrir o fusionar un PR |
| Cierre | `/handoff` | Al terminar: `docs/estado-del-proyecto.md` al día |
| Cualquiera | `/wait-what` | Si Henry no entendió una respuesta |
<!-- skills-flow:end -->
