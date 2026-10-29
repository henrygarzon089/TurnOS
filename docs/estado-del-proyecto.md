# Estado del proyecto — traspaso (2026-10-28)

Este documento resume la conversación en la que se construyó todo hasta aquí, para que cualquier
persona o agente retome sin perder contexto. La fuente de verdad sigue siendo `specs/`.

## Cronología

1. Fase 0 y 1: se redactaron `constitution.md` y `requirements.md` (34 REQ, 144 criterios, 13 NFR,
   22 casos borde, 27 preguntas abiertas). Henry aprobó todo y resolvió las preguntas con el valor
   por defecto propuesto (ADR-007).
2. Fase 2 y 3: `design.md` y `tasks.md` (50 tareas en 4 hitos). Aprobados.
3. Fase 4: implementación tarea a tarea, con pruebas primero. 27 commits.

## Hecho

| Hito                     | Tareas      | Estado                                                                     |
| ------------------------ | ----------- | -------------------------------------------------------------------------- |
| H0 Cimientos             | T-001…T-010 | T-001–009 `[x]`; T-010 `[~]` (CI verde; falta E2E en CI y proteger `main`) |
| H1 Fila virtual          | T-011…T-030 | **aprobado** (ADR-017); pasillo e instalación hechos (ADR-021)             |
| H2 Clientes y fidelidad  | T-031…T-039 | **aprobado** (ADR-017)                                                     |
| H3 Caja y comisiones     | T-040…T-050 | **aprobado** (ADR-020); pasillo con el dueño hecho (ADR-021)               |
| H4 Servicios por barbero | T-051…T-057 | T-051–056 `[x]` (PRs #4–#9); T-057 `[~]` (falta aprobación de Henry)       |

### Hito 4 — servicios por barbero (2026-10-28)

- Origen: Filo (`/filo`, creado en producción el 2026-10-28 con `supabase/data/filo.sql`) tiene
  4 sillas de hombre, 1 de mujer y manicure aparte. Grill → REQ-035 (13 CA) y ADR-023, aprobados.
  Q16: "Hoy no hay quién lo haga" solo aplica si ya hay alguien presente.
- Migraciones nuevas: `0030_barber_services`, `0031_queue_by_service`, `0032_estimate_by_service`.
  **No están en producción**: se aplican con `supabase db push` cuando se fusione la cadena. Con
  todos haciendo todo (estado inicial) no cambia nada visible.
- PRs en cadena: #5 T-052 → #6 T-053 → #7 T-054 → #8 T-055 → #9 T-056 (cada uno sobre el anterior);
  #2, #3 y #4 ya fusionados en `main`.
- Pruebas (Mac): pgTAP 517 · unitarias 96 · integración 36 · E2E nuevos 16/16; suite E2E completa
  166/174 (las 8 fallas no son de REQ-035: invitación con la IP de `.env.local`, inicios de sesión
  lentos y `barber-flow` intermitente en WebKit con `pnpm dev`). `pnpm trace --hito=4` sin huecos.
- **Ojo**: `.env.local` apunta a producción. Los E2E en la Mac se corren contra el Supabase local
  con las variables de `supabase status` (no con `.env.local`), y siempre con `--workers=1`.
- Pendiente para Filo: cuando lleguen los barberos, desmarcar en **Barberos** los servicios de mujer
  a Stiven y Andrés y dejarle a la estilista solo los suyos; la persona de manicure se crea como
  barbero con solo manicure/pedicure (y se activan esos servicios).

Pruebas en verde (Mac, 2026-10-24): 303 pgTAP · 58 unitarias · 27 integración · E2E de H2 32/32 (Pixel 7 + iPhone 13,
corrida conjunta). Trazabilidad Hito 2: 0 CA sin prueba (`pnpm trace --hito=2`).
E2E de H0/H1 (2026-10-24): 90/90 en verde (10 specs × Pixel 7 + iPhone 13) contra `supabase start`,
`--workers=1`. `tests/e2e/global-setup.ts` deja La 33 abierta 00:00–23:59 (no se restaura; `supabase
db reset` vuelve al horario del seed) y `resetQueue()` vacía la fila, borra los contadores `ip:*` de
`rate_limits` y deja presentes a los barberos antes de cada prueba. No correr dos suites de
Playwright a la vez contra la misma base: se cancelan los turnos entre sí.
Arreglos de la app que salieron al correrlos: 0020 (cierre + 60 min daba la vuelta a medianoche) y
`reload` de BarberQueue/OwnerQueue (sin red tumbaba la página, REQ-011.3).
Tras `supabase db reset`, `supabase/seed-local-auth.sql` (en `config.toml`) deja listos los usuarios de
Auth del seed; `pnpm db:seed-auth` lo reaplica a mano.

### Migraciones (`supabase/migrations/`)

0001 extensiones · 0002 núcleo (negocio, horario, membresías, barberos, servicios, productos,
plantillas, aviso) · 0003 RLS núcleo · 0004 invitaciones · 0005 turnos/eventos/rate limit ·
0006 máquina de estados (`transition_ticket`) · 0007 operaciones (`call_next` con SKIP LOCKED,
`set_barber_status`, `add_manual_ticket`, `reorder_ticket`) · 0008 funciones públicas + pg_cron ·
0009 broadcast realtime · 0010 aviso WhatsApp · 0011 pantalla TV · 0012 barbero solo llama al
primero · 0013 clientes, fidelidad, recordatorios · 0014 fusión de fichas y clientes del barbero
(ADR-016) · 0015 supresión · 0017 progreso de fidelidad · 0018 inactivos en días del negocio ·
0019 barbero preferido.

### Pantallas

Cliente: `/[slug]`, `/[slug]/turno`, `/t/[token]`, `/[slug]/privacidad`, `/[slug]/pantalla?k=`.
Personal: `/entrar`, `/invitacion/[token]`, `/crear-negocio` (3 pasos), `/app/fila`,
`/admin/{fila,servicios,productos,barberos,horario,qr,mensajes,negocio,privacidad}`.
Personal (H2): `/app/clientes`, `/app/clientes/[id]`, `/admin/fidelidad`, `/admin/recordar`.
Hito 3: `/admin/caja` (+ `/admin/caja/[fecha]`), `/admin/semana`, `/app/mis-numeros`, panel de cobro.
Pendientes (H3): `/admin/caja`,
`/admin/semana`, `/app/mis-numeros`.

## Desvíos registrados respecto a la spec (todos explícitos)

- Next.js 16: `middleware.ts` → `src/proxy.ts`; `cacheComponents` desactivado.
- Sin Docker en el entorno de construcción → Postgres local + shim (ADR-015). En la Mac con Docker,
  `supabase start` funciona igual con las mismas migraciones (el shim no se aplica ahí).
- `design.md` §4: la posición del ejemplo T3 era 1 y la fórmula da 2 (corregido en T-016).
- T-009 (seed) se hizo antes de T-006–008 (no dependía de ellas). El seed crece por tarea.
- 0010 `mark_ticket_notified`: el barbero no tiene update directo sobre `tickets`.
- 0012: REQ-007.8 se refuerza en la base (antes solo en UI).
- 0013 renumeró las migraciones previstas en `tasks.md` (0011 → 0013); los nombres en tasks.md
  son indicativos.
- 0002 `gen_public_token()` fija `search_path = public, extensions`: en Supabase real `pgcrypto`
  vive en `extensions` y las funciones `security definer` con `search_path = public` no
  encontraban `gen_random_bytes` (falló el seed con `supabase start`; el shim no lo detectaba).
  Se editó la migración porque aún no se había aplicado a ningún proyecto remoto.
- Mac de Henry: `supabase/config.toml` usa los puertos 573xx (543xx ocupados por otro proyecto);
  `next.config.ts` permite `allowedDevOrigins` de la red local para probar desde el celular.

## Pendientes externos (los tenía que resolver Henry; verificar estado)

1. **Supabase** — hecho 2026-10-24: proyecto `uucjmxdssnmvznibrafc` enlazado con el CLI;
   `supabase db push --include-seed` aplicó 0001–0020 (sin 0016: es solo una prueba) y el seed
   (`seed.sql` + `seed-local-auth.sql`, ver nota en ese archivo). Login del dueño y del barbero
   verificado contra la nube con la llave pública; `anon` no lee tablas. **Pendiente (Henry)**:
   en Auth → Providers → Email desactivar "Confirm email" si se van a registrar dueños nuevos
   desde la app; cambiar las contraseñas de prueba antes de usarlo con clientes reales.
2. **GitHub** — hecho 2026-10-24: `main` en `henrygarzon089/TurnOS`. CI arreglado (workflow
   inválido, `next typegen`, base de pruebas con `scripts/ci-db.sh`).
3. **Vercel** — hecho 2026-10-24: proyecto `turnos` en la cuenta personal
   (`henry-garzons-projects`), producción en **https://turnos-smoky-nine.vercel.app**
   (`/salud` → `{ok:true, db:true}`). Variables en producción y preview:
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (sensible), `NEXT_PUBLIC_APP_URL`. **Pendiente (Henry)**: conectar el repo de GitHub en
   Vercel (Settings → Git; el CLI no pudo: la app de Vercel no tiene acceso al repo) para que cada
   push a `main` despliegue solo. Mientras tanto: `vercel deploy --prod --scope henry-garzons-projects`.
4. Correr `pnpm test:e2e` (y `E2E_SCREEN_KEY=<businesses.screen_key>` para la pantalla TV) y
   Lighthouse (`lighthouserc.json`) → pasar las `[~]` a `[x]` → T-030 demo con Henry → cerrar H1.
5. CI (`.github/workflows/ci.yml`) nunca ha corrido: validar en el primer push.

## Cómo seguir (prompt sugerido para Claude Code)

> Lee `CLAUDE.md`, `specs/` y `docs/estado-del-proyecto.md`. Continúa con Spec-Driven Development:
> implementa T-033 de `specs/tasks.md` (primero pruebas, luego código), márcala, haz commit
> `T-033: …` y dime cómo probarla desde el celular. Si la spec está incompleta, detente y propón el
> cambio antes de seguir. No reabras decisiones de `decisions.md` sin un ADR nuevo.

## Notas de diseño útiles al implementar H2/H3

- `loyalty_cards.redeemed_sale_id` espera FK a `sales` (T-040). `redeem_loyalty_card(card, sale)`
  ya existe para que `register_sale` lo invoque (REQ-019.4).
- `tickets.payment_status` pasa a `pending` al terminar; `register_sale` debe ponerlo `paid`.
- `barber_status_events` es la fuente de minutos en servicio para ocupación (REQ-028.2).
- Fórmulas de comisión y cierre con ejemplos numéricos exactos en `design.md` §5: las pruebas de
  T-041 y T-046 deben reproducirlos tal cual.
- Barberos y dueño distinguen actor en `transition_ticket` (`'barber'` / `'owner'`); el GUC
  `turnos.from_call_next` permite a `call_next` saltar la regla "solo el primero".
- Triggers internos que actualizan `customers` usan el GUC `turnos.internal = '1'` para pasar el
  trigger que restringe al barbero.
