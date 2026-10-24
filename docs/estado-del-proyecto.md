# Estado del proyecto — traspaso (2026-10-24)

Este documento resume la conversación en la que se construyó todo hasta aquí, para que cualquier
persona o agente retome sin perder contexto. La fuente de verdad sigue siendo `specs/`.

## Cronología

1. Fase 0 y 1: se redactaron `constitution.md` y `requirements.md` (34 REQ, 144 criterios, 13 NFR,
   22 casos borde, 27 preguntas abiertas). Henry aprobó todo y resolvió las preguntas con el valor
   por defecto propuesto (ADR-007).
2. Fase 2 y 3: `design.md` y `tasks.md` (50 tareas en 4 hitos). Aprobados.
3. Fase 4: implementación tarea a tarea, con pruebas primero. 27 commits.

## Hecho

| Hito                    | Tareas      | Estado                                                                            |
| ----------------------- | ----------- | --------------------------------------------------------------------------------- |
| H0 Cimientos            | T-001…T-010 | T-001–005, 009 `[x]`; T-006, 007, 008, 010 `[~]` (E2E pendiente)                  |
| H1 Fila virtual         | T-011…T-030 | T-011–017 `[x]`; T-018–030 `[~]` (E2E/Lighthouse pendiente). Trazabilidad 144/144 |
| H2 Clientes y fidelidad | T-031…T-039 | T-031, T-032 `[x]`; **siguiente T-033**                                           |
| H3 Caja y comisiones    | T-040…T-050 | sin empezar                                                                       |

Pruebas en verde en el entorno de construcción: 224 pgTAP · 38 unitarias · 20 integración.
E2E escritos (Playwright, Pixel 7 + iPhone 13): 10 archivos, ~50 casos, pendientes de ejecutar.

### Migraciones (`supabase/migrations/`)

0001 extensiones · 0002 núcleo (negocio, horario, membresías, barberos, servicios, productos,
plantillas, aviso) · 0003 RLS núcleo · 0004 invitaciones · 0005 turnos/eventos/rate limit ·
0006 máquina de estados (`transition_ticket`) · 0007 operaciones (`call_next` con SKIP LOCKED,
`set_barber_status`, `add_manual_ticket`, `reorder_ticket`) · 0008 funciones públicas + pg_cron ·
0009 broadcast realtime · 0010 aviso WhatsApp · 0011 pantalla TV · 0012 barbero solo llama al
primero · 0013 clientes, fidelidad, recordatorios.

### Pantallas

Cliente: `/[slug]`, `/[slug]/turno`, `/t/[token]`, `/[slug]/privacidad`, `/[slug]/pantalla?k=`.
Personal: `/entrar`, `/invitacion/[token]`, `/crear-negocio` (3 pasos), `/app/fila`,
`/admin/{fila,servicios,productos,barberos,horario,qr,mensajes,negocio,privacidad}`.
Pendientes (H2/H3): `/app/clientes`, `/admin/fidelidad`, `/admin/recordar`, `/admin/caja`,
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

## Pendientes externos (los tenía que resolver Henry; verificar estado)

1. **Supabase**: proyecto `uucjmxdssnmvznibrafc` (URL `https://uucjmxdssnmvznibrafc.supabase.co`).
   Aplicar migraciones (`supabase link` + `supabase db push`), `pnpm seed:users`, `seed.sql`.
   Desactivar "Confirm email" en Auth (los barberos usan correos alias).
2. **GitHub**: repo `henrygarzon089/TurnOS` estaba vacío; subir el bundle/clon.
3. **Vercel**: importar el repo en la cuenta personal de Henry con `NEXT_PUBLIC_SUPABASE_URL`,
   `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_APP_URL`.
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
