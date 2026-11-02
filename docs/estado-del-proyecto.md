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

| Hito                     | Tareas      | Estado                                                                  |
| ------------------------ | ----------- | ----------------------------------------------------------------------- |
| H0 Cimientos             | T-001…T-010 | T-001–009 `[x]`; T-010 `[~]` (CI y E2E en verde; falta proteger `main`) |
| H1 Fila virtual          | T-011…T-030 | **aprobado** (ADR-017); pasillo e instalación hechos (ADR-021)          |
| H2 Clientes y fidelidad  | T-031…T-039 | **aprobado** (ADR-017)                                                  |
| H3 Caja y comisiones     | T-040…T-050 | **aprobado** (ADR-020); pasillo con el dueño hecho (ADR-021)            |
| H4 Servicios por barbero | T-051…T-057 | **aprobado** (ADR-024); PRs #4–#10 en `main`                            |

### Hito 5 — experiencia del cliente (**aprobado**, ADR-026, 2026-11-01)

- T-058 `[x]` (2026-10-29): migraciones `0033_customer_experience` y `0034_birthday_template`
  (columnas de reseña, cumpleaños, cortesía y fotos; `barber_photos` con límite de 12; bucket
  `media` de Storage; funciones nuevas). **En producción** desde el 2026-10-30 (PR #13, `supabase
db push` y `vercel --prod` desde `main`). Sin pantallas todavía: nada cambia para el cliente
  hasta T-059…T-062. pgTAP 610 · unitarias 96 · integración 36.
- T-059 `[x]` (2026-10-30): reseña en Google. Campo en `/admin/negocio` y botón en "Mi turno" al
  terminar. Sin migración propia; usa `google_review_url` de 0033. **En producción** desde el
  2026-10-30.
- T-060 `[x]` (2026-10-30): cumpleaños en la ficha y en el formulario de turno, "Cumplen esta
  semana" en `/admin/recordar`, plantilla en `/admin/mensajes`. Migración `0035_merge_customers_birthday`
  (fusionar fichas conserva el cumpleaños). **En producción** desde el 2026-10-30.
  Aviso de Filo: versión 2 publicada el 2026-10-30 con el texto por defecto que menciona el
  cumpleaños (REQ-037.6); los clientes que vuelvan a tomar turno deben aceptarla (REQ-002.5).
- T-061 `[x]` (2026-10-30): "A la venta", "De cortesía" y foto en `/admin/productos`; "Lo que
  vendemos" en la portada; "Bebida de cortesía" en el formulario y en "Mi turno"; línea con
  "Servida ✓" en las filas del barbero y del dueño; la caja lista solo lo que está a la venta. Sin
  migración. **En producción** desde el 2026-11-01. En Filo los productos existentes
  siguen a la venta y no se ofrece bebida hasta marcar alguno "De cortesía".
- T-062 `[x]` (2026-10-30): fotos de cortes en `/app/mis-fotos` y `/admin/barberos`, "Ver cortes" en
  el formulario. Sin migración. PR #21 fusionado sin esperar E2E ni Lighthouse (`main` no está
  protegida: `gh pr merge --auto` fusiona de una); hay que mirar la corrida de CI en `main`.
  **En producción** desde el 2026-11-01, junto con T-061 y el arreglo de `.btn-*` (PR #20).
- T-063 `[x]` (2026-11-01, aprobado por Henry): `pnpm trace --hito=5` sin huecos. CI de `main` verde, desplegado el 2026-11-01, prueba en la barbería
  hecha y Hito 5 aprobado (ADR-026).
- T-062 `[x]` (2026-10-30): "Mis fotos" del barbero (`/app/mis-fotos`), "Fotos de cortes" en cada
  tarjeta de `/admin/barberos` y "Ver cortes" en el formulario de turno. Hasta 12 por barbero, con
  confirmación de permiso foto por foto. Sin migración. **En producción** desde el
  2026-11-01. Sigue T-063 (validación del Hito 5).

### Hito 6 — aviso automático por WhatsApp (en construcción, ADR-027)

- T-064 `[x]` (2026-11-01): migración `0036_whatsapp_notifications` (columnas de negocio y ficha,
  `ticket_notifications`, `join_queue` con casilla, baja, `claim_notification`, tope de 3.000 al mes,
  estados y contadores). En producción (ver abajo).
  Viene apagada y sin pantallas, así que nada cambia para el cliente. pgTAP 704 · unitarias 130 ·
  integración 58.
- T-065 `[x]` (2026-11-01): `pickNotifications` decide qué avisos tocan y `CloudApiChannel` los envía
  a Meta. Sin migración y sin uso todavía: nada llama este código hasta T-066, así que nada cambia
  para el cliente. Falta confirmar la versión de la Graph API (`v26.0`) en T-069. unitarias 168 · integración 58.
- T-066 `[x]` (2026-11-01): `dispatchQueueNotifications` y `afterQueueChange` en toda acción de la
  fila, `skip_two_left` al tomar turno y en turno manual, y autocorrección de `claimed` vencidos.
  Migración `0037_notification_queue` (lecturas, solo service_role). Sin las variables `WHATSAPP_*` el
  envío no corre ni consulta la base, y si `0036` falta, marcar el turno falla sin afectarlo: desplegar
  este código antes de migrar no cambia nada para el cliente. Limitaciones conocidas en la nota de
  T-066. pgTAP 721 · unitarias 201 · integración 78.
- T-067 `[x]` (2026-11-01): webhook de Meta en `/api/whatsapp/webhook`: firma, estados, "PARAR" y
  respuesta automática una vez cada 24 h; el contenido de los mensajes no se guarda. ADR-028: con un
  número compartido, "PARAR" da de baja en todos los negocios. Migración `0038_whatsapp_inbound`.
  Sin las variables `WHATSAPP_*` la ruta responde 401 o 403 y nada cambia para el cliente. No se ha
  probado con eventos reales de Meta: queda para T-069. pgTAP 745 · unitarias 244 · integración 95.
- Migraciones del Hito 6: `0036`, `0037` y `0038` **en producción** desde el 2026-11-01 (`supabase db
push`, pedido por Henry). Verificado: `anon` no ejecuta ninguna función, el personal no ejecuta las
  de `service_role`, `ticket_notifications` con RLS forzada, ningún negocio con el aviso activo y 0
  avisos registrados. El código de T-064…T-067 está desplegado desde el 2026-11-01 (`vercel deploy
--prod` desde `main`, hecho por Henry): el webhook responde 403 sin token y 401 sin firma.
- T-068 `[x]` (2026-11-01): pantallas del aviso: casilla o línea en el formulario de turno, baja en "Mi
  turno", textos y contadores en `/admin/mensajes`, interruptor y número de contacto en
  `/admin/negocio`, y párrafo de WhatsApp en el aviso por defecto. Migración `0039_whatsapp_screens`
  (solo lecturas y un texto). **En producción** desde el 2026-11-02: PR #30 fusionado, `0039`
  aplicada con `supabase db push` (simulación antes: solo `0039`) y código desplegado por Henry.
  Verificado: `/filo/turno` sin casilla ni línea de WhatsApp. Ningún negocio tiene el aviso activo. Los E2E usan
  `WHATSAPP_FAKE_CHANNEL=1`, que se ignora en Vercel. Ojo: con las credenciales en Vercel, todo dueño
  verá el interruptor. Sigue T-069. pgTAP 762 · unitarias 263 · integración 102.
- T-069 `[ ]` (2026-11-02, parte de código hecha): `pnpm trace --hito=6` sin huecos (205 criterios, 0
  sin prueba) y la prueba de NFR-009 cubre los hitos 0 a 6. Un `--hito` desconocido ahora falla en
  vez de pasar sin revisar nada. Sin migración ni cambios en la app. unitarias 264.

#### Checklist de Henry para cerrar T-069 (Hito 6)

Pasos de `docs/guia-whatsapp-meta.md`, en orden. Ninguno lo puede hacer el agente.

- [ ] SIM nueva activa, que recibe SMS y sin WhatsApp instalado (§1).
- [ ] Portafolio en Meta y verificación del negocio iniciada y aprobada (§2).
- [ ] App de WhatsApp creada y número real agregado, con nombre visible aprobado y PIN de dos pasos
      guardado (§3 y §4).
- [ ] Tarjeta en la cuenta de WhatsApp (§5).
- [ ] Tarifa del mensaje de utilidad en COP confirmada en la tabla oficial de Meta y anotada aquí
      (§5; esperamos unos $3).
- [ ] Plantillas `turno_faltan_dos` y `turno_te_llaman` aprobadas como **Utilidad**, idioma `es` sin
      variante regional (§6).
- [ ] Las cuatro variables `WHATSAPP_*` en Vercel, producción, y un despliegue nuevo para que las tome
      (§7). Desde ese momento todo dueño ve el interruptor en `/admin/negocio`: solo se enciende en Filo
      (ADR-027).
- [ ] Webhook apuntando a `/api/whatsapp/webhook` y suscrito a `messages` (§8). El código ya está en
      producción.
- [x] Versión de la Graph API: `v26.0`, constante `GRAPH_API_URL` en
      `src/lib/notifications/cloud-api.ts`. Confirmada el 2026-11-02 en el registro de cambios
      oficial de Meta (publicada el 2026-07-29, la más reciente). El primer envío al número de prueba
      lo comprueba de punta a punta.
- [ ] Versión nueva del aviso de privacidad, la que menciona WhatsApp, publicada en Filo desde
      `/admin/privacidad` (§9).
- [ ] Número de la barbería guardado y aviso encendido **solo en Filo** (§9).
- [ ] Prueba real en la barbería: turno con la casilla marcada, llega "faltan 2", llega "te llaman" y
      responder "PARAR" da de baja (§9).
- [ ] ADR de aprobación del Hito 6 (ADR-029) y T-069 marcada `[x]`.

### Hito 4 — servicios por barbero (2026-10-28)

- Origen: Filo (`/filo`, creado en producción el 2026-10-28 con `supabase/data/filo.sql`) tiene
  4 sillas de hombre, 1 de mujer y manicure aparte. Grill → REQ-035 (13 CA) y ADR-023, aprobados.
  Q16: "Hoy no hay quién lo haga" solo aplica si ya hay alguien presente.
- Migraciones nuevas: `0030_barber_services`, `0031_queue_by_service`, `0032_estimate_by_service`.
  **En producción** (toda la cadena fusionada en `main`). Con
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
- `.btn-*` pasaron a `@layer components` en `globals.css` (2026-10-30): sin capa, su `w-full` les
  ganaba a las utilidades y en "Cobro pendiente" el nombre del cliente medía 0 px. Ahora sí aplican
  `w-auto`, `w-12`, `px-0` y `bg-warn` ("No llegó" tras la gracia sale en ámbar). `.input` sigue sin
  capa: `min-h-24`, `min-h-64`, `py-2` y `text-sm` no le aplican; al moverla, `text-sm` en
  `PrivacyForm` bajaría de 16 px el campo (NFR-008).

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
