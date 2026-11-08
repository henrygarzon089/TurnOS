# Estado del proyecto — traspaso (2026-11-07)

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

- T-070 `[x]` (2026-11-02): solo los negocios que habilita el operador encienden el aviso (REQ-043.6,
  ADR-029). Migración `0040_whatsapp_allowed`: columna `whatsapp_allowed` que el personal no puede
  cambiar y `check` que impide encender el aviso sin ella; habilita a Filo. Sin habilitación,
  `/admin/negocio` no muestra el interruptor. Cierra la limitación de T-068. **En producción** desde el
  2026-11-02: PR #34, `0040` aplicada con `supabase db push` y `main` desplegado. Verificado: la base
  remota al día, `/filo/turno` sin casilla y el webhook responde 403 sin credenciales. No se pudo leer
  la tabla para confirmar que solo Filo quedó habilitado: el conector de Supabase no tiene permiso en
  el proyecto. pgTAP 773 · unitarias 267 · integración 102.

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
- [x] `0040_whatsapp_allowed` aplicada en producción y código de T-070 desplegado, **antes** de las
      variables: así solo Filo ve el interruptor (ADR-029).
- [ ] Las cuatro variables `WHATSAPP_*` en Vercel, producción, y un despliegue nuevo para que las tome
      (§7).
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
- [ ] ADR de aprobación del Hito 6 (ADR-031; ADR-030 es la membresía) y T-069 marcada `[x]`.

### Hito 7 — membresía familiar (**aprobado**, ADR-032, 2026-11-03)

- 2026-11-02: grill de 25 preguntas con Henry, todas con la respuesta recomendada. Escritos
  REQ-044…REQ-048 (29 criterios, §5e), `design.md` §13, ADR-030 (propuesta) y tareas T-071…T-077.
  Henry aprobó la spec el mismo día (PR #36). No depende del Hito 6.
- T-071 (2026-11-02): `0041_memberships.sql` con plan, familias (`family_memberships`, porque
  `memberships` ya es el personal), miembros y periodos; RLS solo lectura del dueño; funciones
  `save_membership_plan`, `create_membership`, `add_membership_member`, `remove_membership_member`;
  `merge_customers` y anonimizar ya conocen las familias (`BOTH_IN_FAMILIES`, decisión de Henry).
  pgTAP 49 nuevas (822 en total). Sin aplicar en producción (se hace al cerrar el hito). Sigue T-072.
- T-072 (2026-11-02): `0042_membership_sales.sql` con la cuota en la caja: `sale_item_kind`
  agrega `'membership'`, `sales.membership_total` (el total la suma), `sale_items.membership_period_id`
  y `membership_benefit`; `register_membership_fee` (solo el dueño, plan encendido, venta sin barbero
  ni comisión, periodo de 30 días desde hoy o encadenado al último) y `void_sale` con
  `MEMBERSHIP_IN_USE`. pgTAP 44 nuevas (866 en total), integración 102. Sin aplicar en producción.
  Sigue T-073 (cobro con membresía, en la misma 0042).
- T-073 (2026-11-02): en la misma `0042`, `membership_status` (periodo vigente y cortes que quedan,
  null con el plan apagado), `register_sale` con la línea `"membership": true` (corte en $ 0 o
  descuento del plan al agotar, comisión sobre la lista, un solo beneficio por venta, el barbero la
  aplica sin motivo) y el sello del corte: se quita al cobrar y `void_sale` lo repone. Espejo en
  `commission.ts` (ejemplos E y F). pgTAP 46 nuevas (912 en total), unitarias 270, integración 102.
  Sin aplicar en producción. Sigue T-074 (pantalla "Membresías" del dueño).
- T-074 (2026-11-02): pantalla `/admin/membresias` del dueño (plan con interruptor y servicios que
  gastan cortes, familias con titular, miembros y cortes que quedan, crear familia, agregar y quitar
  miembro, "Cobrar cuota" con medio de pago, "Vencen esta semana" con botón de WhatsApp) y chip
  "Membresías" en el menú. `0043_membership_reports.sql` (`memberships_expiring`, plantilla en
  `create_business`) y `0044_membership_template.sql` (plantilla "Membresía por vencer" para los
  negocios existentes, editable en Mensajes). pgTAP 930, unitarias 280, integración 109, E2E 2/2
  (Pixel 7 + iPhone 13). El Supabase local de la Mac quedó en 0044 (Henry lo autorizó el
  2026-11-02). Sin aplicar en producción. Sigue T-075 (cobro, "Mi
  turno" y filas).
- T-075 (2026-11-03): el panel de cobro ofrece "Usar membresía" marcado en la línea que gasta
  cortes ("Corte de membresía (quedan X)" o "Descuento de membresía X %") y no ofrece el premio en
  esa venta; "Nueva venta" tiene el campo opcional "Celular del cliente" (decisión de Henry) para
  usar la membresía sin turno. "Mi turno" dice "Membresía familiar: quedan X de N cortes · vence el
  <día>" y las filas del barbero y del dueño marcan "Membresía". En `0043`: `get_ticket_by_token`
  con `membership` y `membership_member_ids`. pgTAP 943, unitarias 284, integración 111, E2E 4/4
  (Pixel 7 + iPhone 13). El Supabase local tiene las dos funciones nuevas (Henry lo autorizó). Sin
  aplicar en producción. Sigue T-076 (caja, semana y aviso de privacidad).
- T-076 (2026-11-03): la Caja de hoy, el cierre (también el texto por WhatsApp) y la Semana muestran
  aparte "Cuotas de membresía" y "Cortes de membresía" (cantidad · valor de lista); el aviso de
  privacidad por defecto dice que el titular entrega el celular de los miembros. En `0043`:
  `cash_day_summary`, `weekly_summary` y `default_privacy_text`. pgTAP 954, unitarias 288,
  integración 111, E2E 2/2. El Supabase local tiene la sección T-076 (Henry lo autorizó). Sin
  aplicar en producción. Los negocios que ya existen (Filo) deben publicar una versión nueva del
  aviso (REQ-002.5): queda para T-077. Sigue T-077 (validación del hito, depende de Henry).
- Decisión que cambia la caja: la comisión del corte de membresía y del descuento al agotar los
  cortes se calcula sobre el precio de lista (como el premio de fidelidad); la cuota no paga comisión.
- `pnpm trace`: 235 criterios, 0 sin prueba.
- T-077 (2026-11-03, abierta): `HITOS["7"] = [[44, 48]]` en `scripts/traceability.ts` y el hito 7 en
  `tests/unit/traceability.test.ts`; `pnpm trace --hito=7` da 0 sin prueba. Esperas de 15 s en los
  E2E de `memberships.spec.ts` (tarjeta de la familia nueva) y `membership-checkout.spec.ts` ("Usar
  membresía"), que fallaban a veces en iPhone por tiempo. Queda abierta hasta el checklist de abajo.

#### Checklist de Henry para cerrar T-077 (Hito 7)

Ninguno lo puede hacer el agente. En este orden:

- [x] Fusionar en `main`, uno por uno y en orden, los PR #36 (spec) → #37 (T-071) → #38 (T-072) →
      #39 (T-073) → #40 (T-074) → #41 (T-075) → #42 (T-076) → el de T-077. Cada uno sale del anterior:
      al fusionar uno, el siguiente queda contra `main`. **No desplegar** a producción todavía.
- [x] Aplicar en producción `0041_memberships`, `0042_membership_sales`, `0043_membership_reports` y
      `0044_membership_template`, en ese orden y cada una en su propia transacción (0044 usa el valor
      del enum que agrega 0043). Antes de desplegar el código: las pantallas nuevas leen tablas y
      funciones de estas migraciones.
- [x] Desplegar `main` a producción y entrar a `/admin/membresias` de Filo: debe abrir sin error.
- [ ] Fijar el plan de Filo en `/admin/membresias`: cuota, cortes por periodo, servicios que gastan
      cortes y descuento al agotar. Encender "Membresía activa" solo cuando esté listo para ofrecerla.
- [ ] Revisar en "Mensajes" de Filo la plantilla "Membresía por vencer" (la crea 0044).
- [ ] Publicar en Filo, desde `/admin/privacidad`, una versión nueva del aviso de privacidad con el
      párrafo de la membresía (el titular entrega el celular de los miembros) y el de WhatsApp
      (REQ-002.5). Una sola versión nueva con los dos párrafos: el aviso que ya tiene Filo no los trae.
- [ ] Prueba en la barbería con una familia real: crear la familia con el titular y un miembro,
      cobrar la cuota, que un miembro tome turno y vea "Membresía familiar: quedan X de N" en "Mi
      turno", que el barbero cobre el corte en $ 0 con "Usar membresía", y que la Caja de hoy, el
      cierre y la Semana muestren "Cuotas de membresía" y "Cortes de membresía".
- [x] Aprobación de Henry → ADR-032 (2026-11-03) y T-077 marcada `[x]`. ADR-031 sigue apartado
      para el Hito 6.

Hecho el 2026-11-03: #36…#43 fusionados en orden (CI de `main` en verde), `supabase db push` aplicó
0041–0044 y `vercel deploy --prod` publicó `a50342d`. Lo que sigue sin marcar es operación en Filo.

### Hito 8 — citas a hora fija (construido, falta aprobación de Henry; ADR-033)

- 2026-11-03: grill con Henry (todas las respuestas recomendadas). Escritos REQ-049…REQ-054 (§5f),
  `design.md` §14, ADR-033 y tareas T-078…T-087. Va en paralelo con el Hito 9: los números saltan a
  propósito. Spec en PR #46.
- Construido 2026-11-03/04, una tarea por PR, apilados: #46 spec → #53 T-078 → #54 T-079 → #55
  T-080 → #57 T-081 → #59 T-082 → #61 T-083 → #64 T-084 → #65 T-085 → #66 T-086 → T-087 (este).
  Cada PR va sobre el anterior: **fusionar en ese orden**. El agente no puede fusionar (el modo
  automático lo bloquea sin revisión): lo hace Henry.
- Migraciones nuevas: `0045_appointments` (tabla, agenda, reservar, cancelar, pasar a otro
  barbero), `0046_appointments_queue` ("Llegó", `call_next` que salta lo que no cabe antes de la
  próxima cita con `NEXT_APPOINTMENT`, cierre → "No vino", `queue_snapshot` con `scheduledAt` y
  huecos), `0047_appointment_templates` (tres plantillas por trigger + las de negocios existentes) y
  `0048_appointment_public_info` (portada y horas en jsonb) y `0049_appointments_customer_fk` (la
  cita no bloquea fusionar ni borrar la ficha). **En producción desde el 2026-11-04.** Como 0050–0055 (Hito 9
  y la corrección de fusión) ya pueden estar aplicadas, `supabase db push` necesitará
  `--include-all` para subir 0045–0049; no redefinen nada de 0050–0055, así que el orden no cambia
  el resultado.
- Funciones redefinidas (ya fusionado con el Hito 9 el 2026-11-04, sin cruces): `call_next`, `transition_ticket`,
  `close_expired_queues`, `queue_snapshot`, `barbers_restrict_self_update`. No se tocaron
  `create_business`, `get_ticket_by_token` ni `get_public_business`.
- Pantallas: `/[slug]` ("Reservar cita"), `/[slug]/cita`, `/c/[token]` ("Mi cita") y
  `/c/[token]/calendario` (.ics); `/app/fila` ("Mis citas de hoy"), `/admin/fila` ("Citas de
  hoy"), `/admin/citas` (ajustes, nueva cita, citas de mañana, agenda) y tres plantillas en
  `/admin/mensajes`.
- Pruebas (Docker local, 2026-11-04): 1163 pgTAP · 334 unitarias · 142 integración (con el Hito 9 ya en `main`). E2E nuevos:
  `appointments-settings`, `appointments-public`, `appointments-queue`, `appointments-agenda` y
  `appointment-templates` (corren en CI). `pnpm trace --hito=8` sin huecos (34 criterios).
- Checklist de Henry:
  - [x] Fusionar #46 → #53 → #54 → #55 → #57 → #59 → #61 → #64 → #65 → #66 → #67, con CI verde.
  - [x] `supabase db push --include-all` de 0045–0049 en producción y `vercel deploy --prod`
        (2026-11-04, desde `100ab74`, la fusión de #67; la 0056 se aplicó después, sola).
  - [ ] En `/filo` → Citas: encender y marcar los barberos que reciben citas.
  - [ ] Prueba real: reservar desde el celular, "Agregar al calendario", que el barbero toque
        "Llegó" y la llame; cancelar otra desde "Mi cita" y otra desde la agenda con el WhatsApp.
  - [ ] Aprobación del hito → ADR-035 y T-087 `[x]`.

### Hito 9 — tarjetas de regalo (**aprobado**, ADR-036, 2026-11-04)

- 2026-11-03: grill de 12 preguntas con Henry, todas con la respuesta recomendada, y abogado del
  diablo breve (anotado en ADR-034). Escritos REQ-055…REQ-059 (26 criterios, §5g), `design.md` §15,
  ADR-034 (propuesta) y tareas T-090…T-097. Va en paralelo con el Hito 8 (citas): los números saltan
  a propósito. Henry aprobó la spec el mismo día (PR #45) y autorizó seguir sin él. Migraciones previstas `0050`…`0053`.
- 2026-11-04: construidas T-090…T-097 en PRs en cadena, cada uno sobre el anterior:
  #50 T-090 (venta, `0050`/`0051`) → #49 T-091 (pagar y anular, `0052`) → #52 T-092 (caja, semana,
  plantilla y aviso, `0053`) → #56 T-093 (pantalla Tarjetas de regalo) → #58 T-094 (página
  `/regalo/[token]`) → #60 T-095 (cobro con tarjeta) → #62 T-096 (caja, cierre y semana en pantalla)
  → #63 T-097 (esta validación). Henry autorizó fusionar en orden: #50…#62 en `main` el
  2026-11-04 con el CI en verde, y #63 al quedar verde.
- `pnpm trace --hito=9`: 261 criterios, **0 sin prueba en el hito 9**; el hito 9 entra al loop de
  `tests/unit/traceability.test.ts`. Pruebas (Docker local): pgTAP 1052 · unitarias 306 ·
  integración 122; los E2E nuevos (`gift-cards`, `gift-card-page`, `gift-card-checkout`,
  `gift-card-reports`) corren en el CI.
- Desvío anotado: `merge_customers` no se redefinió en `0051` (falla antes del Hito 9 con
  `SALE_IMMUTABLE`); el arreglo va aparte (PR #48, migración `0055`).
- **Checklist de Henry** para cerrar el hito:
  1. ~~Fusionar la cadena~~ hecho (2026-11-04).
  2. ~~`0050`…`0053` y `0055` en producción y `main` desplegado~~ hecho (2026-11-04, `b7de232`).
  3. En Filo: publicar la versión nueva del aviso de privacidad (párrafo de tarjetas de regalo,
     REQ-059.4) y revisar la plantilla "Tarjeta de regalo" en Mensajes.
  4. Prueba en la barbería: vender una tarjeta, enviarla por WhatsApp, cobrar con ella parte de un
     corte y ver la Caja de hoy.
  5. ~~Aprobación del hito~~ hecho (ADR-036, 2026-11-04).
- Corrección `0056_merge_customers_gift_cards` (2026-11-04): fusionar la ficha de alguien que compró
  una tarjeta fallaba por la llave foránea `gift_cards.buyer_customer_id`; ahora las tarjetas pasan a
  la ficha que queda. **En producción** desde el 2026-11-04 (`supabase db push` desde `c113896`,
  la fusión de #69).

### Hito 11 — limpieza y bioseguridad (aprobado, ADR-041, 2026-11-06; ADR-037)

- 2026-11-04: grill de 21 preguntas con Henry, todas con la respuesta recomendada. Escritos
  REQ-060…REQ-064 (37 criterios, §5h), `design.md` §16, ADR-037 y tareas T-100…T-109. Henry aprobó
  la spec el mismo día (PR #73, ya en `main`).
- Construido en PRs apilados, uno por tarea, todos ya en `main` (merge normal): #74 (T-100,
  `0057`), #78 (T-101, `0058`), #81 (T-102, `0059`), #84 (T-103 acciones), #88 (T-104 barbero), #91
  (T-105 dueño), #98 (T-106 revisión), #101 (T-107 tareas), #103 (T-108 historial) y #104 (T-109).
- 2026-11-06: Henry aplicó `0057`…`0059` en producción (`supabase db push --include-all`) y
  desplegó `main`.
- Qué hay: interruptor "Limpieza activada" (nace apagada) y cuatro listas editables; apertura,
  cierre y profunda con foto y nota; aviso "Apertura pendiente" en la fila del barbero; tarjeta
  "Limpieza" en el panel del dueño; revisión del dueño con fallas por barbero; tareas periódicas
  con foto o PDF; historial por semana y por barbero. Las fotos van a un bucket privado, `cleaning`,
  y las de registros y revisiones se borran a los 90 días (`after()` una vez al día, sin cron).
- `pnpm trace --hito=11`: 0 sin prueba; el hito 11 ya está en el loop de
  `tests/unit/traceability.test.ts`.
- 2026-11-06: Henry aprobó el hito (ADR-041) sin esperar la prueba en la barbería.
- Falta la operación en Filo:
  1. Encender Limpieza (`/admin/limpieza` → Listas) y ajustar las listas sugeridas.
  2. Probar un día en la barbería: apertura, cierre con foto, una revisión y una tarea.

### Hito 12 — punto de venta con comisión (aprobado, ADR-040, 2026-11-05; ADR-038)

- 2026-11-04: grill de 7 preguntas con Henry, todas con la respuesta recomendada, y abogado del
  diablo (Henry siguió sin cambios; anotado en ADR-038). Escritos REQ-065…REQ-069 (26 criterios,
  §5i), `design.md` §17, ADR-038 (aceptada; cambia PA-17) y tareas T-110…T-119. Va en paralelo con
  el Hito 11 (limpieza) y el Hito 13 (inventario): los números saltan a propósito. Henry aprobó la spec
  el mismo día (PR #75); sigue T-110. Migraciones previstas `0060`…`0062`.
- 2026-11-04: construido T-110…T-118 en PRs encadenados, cada uno sobre el anterior: #75 spec →
  #80 T-110 (`0060`, datos) → #82 T-111/T-112 (`0061`, `register_sale` con comisión de productos y
  compra de barbero) → #86 T-113 (`0062`, caja y semana) → #87 T-114 (dominio) → #90 T-115
  ("Negocio" y "Productos") → #93 T-116/T-117 (vitrina y compra de barbero) → #99 T-118 (Caja de hoy,
  cierre, semana y "Mis números") → T-119 (este cierre). El Hito 13 descuenta la vitrina con sus
  triggers sobre `sale_items` (`ref_id`, `qty`), sin tocar este código.
- `pnpm trace --check --hito=12`: 0 sin prueba (26 CA); el hito 12 ya está en el loop de
  `tests/unit/traceability.test.ts`.
- 2026-11-05: Henry aplicó `0060`…`0062` en producción (`supabase db push --include-all` desde
  `claude/h12-t118`; subieron también `0063` y `0064` del Hito 13). Preview de la cadena:
  https://turnos-mw7ifckv4-henry-garzons-projects.vercel.app (con sesión de Vercel).
- 2026-11-05: Henry probó en el preview y aprobó el hito (ADR-040). Corrección de la prueba:
  "Usar otro medio de pago" para quitar la tarjeta de regalo del cobro (PR #105). Los % de productos
  y de descuento se quedan uno por negocio.
- 2026-11-05: Henry desplegó a producción desde `7836e54` de `main` (Hito 12 y "Usar otro medio de
  pago", #105), antes del código del Hito 13: este necesita `0065`…`0067`, que aún no están en
  producción. Desplegar `main` completo solo después de subir esas migraciones.
- Falta (Henry): marcar en Filo los productos que dan comisión y sus categorías, revisar los dos % en "Negocio", probar una
  venta de vitrina y una compra de barbero en la barbería. El hito ya está aprobado (ADR-040).

### Hito 13 — inventario de insumos y vitrina (**aprobado**, ADR-042, 2026-11-05)

- 2026-11-04: grill en dos rondas con Henry (Q1–Q20, todas con la respuesta recomendada). Escritos
  REQ-070…REQ-074 (29 criterios, §5j), `design.md` §18, ADR-039 y tareas T-120…T-129. Henry aprobó
  la spec (PR #72, ya en `main`). Todo vive en TurnOS: cada barbero tiene una dotación de la barbería,
  se repone solo con el envase vacío, los conteos semanales de estación alertan el consumo de más y la
  vitrina se descuenta sola desde la caja y la cortesía.
- Frontera con el Hito 12 (POS), acordada con la sesión coordinadora: el 12 es dueño de `products` y
  de la venta (`register_sale`/`void_sale`). El 13 solo agrega triggers sobre `sale_items` (insert
  de producto) y `sales` (activa → anulada, idempotente). Las migraciones del 12 (`0060`–`0062`)
  entran antes que las del 13.
- PRs en cadena, cada uno sobre el anterior: #76 T-120 (`0063` catálogo y sitios) → #77 T-121
  (`0064` movimientos) → #79 T-122 (`0065` gancho de caja y cortesía) → #83 T-123 (`0066`
  conteos, alerta y rendimiento) → #85 T-124 (`0067` orden de compra, costo y Mi estación) → #89
  T-125 (acciones) → #92 T-126 (resumen y catálogo) → #94 T-127 (conteo, compra, costos, alerta
  en Negocio) → #95 T-128 (Mi estación y E2E) → T-129 (esta validación).
- #76 y #77 ya están en `main`; el Hito 12 (`0060`–`0062`) también (2026-11-05). El pgTAP de `0065`
  pasa con el `register_sale` nuevo de `0061` (la cadena se probó sobre el 12: 1422 pgTAP en verde).
- `pnpm trace --hito=13`: **0 sin prueba en el hito 13**; el hito 13 entra al loop de
  `tests/unit/traceability.test.ts`. Pruebas: pgTAP de `0063`–`0067` (186) · unitarias 345 ·
  integración 149 (Docker local); la E2E `inventory.spec.ts` corre en el CI.
- **Checklist de Henry** para cerrar el hito:
  1. ~~Fusionar la cadena en orden~~ hecho (2026-11-05, #79 → … → #96, `main` en `37fee60`).
  2. ~~`0063`…`0067` en producción y `main` desplegado~~ hecho (2026-11-05: `0063`/`0064` ya
     estaban; Henry aplicó `0065`–`0067` con `supabase db push --include-all` desde `37fee60` y
     desplegó con `vercel --prod`). `/admin/inventario` y `/app/estacion` responden en producción.
  3. En Filo → Inventario → Catálogo: "Agregar plantilla básica", crear los insumos reales (cera,
     gel, alcohol…) con su dotación, y enlazar los productos de la vitrina.
  4. Primer conteo de bodega, vitrina y cada estación (queda como inicial).
  5. Una semana después: conteo semanal de las estaciones y revisar alertas y la orden de compra.
  6. ~~Aprobación del hito~~ hecho (ADR-042, 2026-11-05; Henry aprobó antes de la prueba en Filo,
     que queda como operación: pasos 3 a 5).

### Hito 14 — rendimiento percibido y medición (**spec aprobada**, ADR-043, 2026-11-06)

- Spec aprobada por Henry (PR #109, `claude/h14-spec-rendimiento`): REQ-075 (esqueletos en `/[slug]`, `/t/[token]`,
  `/app/fila`, `/admin/fila`, `/admin/caja`; velocidad de usuarios reales sin tokens ni cookies),
  design §19, T-130…T-133, sin migraciones. Sin código todavía.
- Medición: Henry eligió Speed Insights anónimo y el cambio de texto de NFR-005 (2026-11-06).
- T-130 hecha (rama `claude/t-130-esqueletos-dd66c5`, 2026-11-06): `Skeleton.tsx` y `loading.tsx` en
  `/[slug]` y `/t/[token]`; prueba `tests/unit/skeleton.test.tsx` (REQ-075.1 y .2 con prueba escrita).
- Siguiente: T-131 (esqueletos del personal). Pendiente de Henry: revisar la cuota de Speed Insights en el plan de Vercel
  (T-132); confirmar la región de Supabase y de las funciones de Vercel (T-133).
- ADR-043 aceptada; la aprobación del hito terminado será ADR-044 (reservado).

### Hito 15 — inicio "Hoy" y menú del dueño (**spec aprobada**, ADR-046, 2026-11-06)

- Spec en `main` (PR #114): REQ-076, REQ-077, design §21, T-150…T-154, sin migraciones. Sin código.
- Se construye después de T-160 y T-161, ya con el sistema visual nuevo (PA-H16-1).
- T-150 hecha (rama `claude/t-150-menu-dueno`, encima de T-161, 2026-11-07): `ADMIN_GROUPS` en
  `src/lib/domain/admin-nav.ts`; el dueño tiene barra inferior (Hoy, Fila, Caja, Clientes, Más) en
  el celular y menú lateral de 240 px desde 1024 px, montados una vez en el layout del personal (también
  en `/app/clientes`); las 23 pantallas ya no pintan la fila de chips. La barra de acciones de la
  fila del dueño sube encima del menú. "Hoy" (`/admin`) sigue llevando a la fila hasta T-151.
  E2E con proyecto `escritorio` (1280 px).
- T-151 hecha (rama `claude/t-151-hoy`, encima de T-150, 2026-11-07): `/admin` ya no lleva a la
  fila: muestra "Hoy" con la fila en vivo (esperando, estimado de la portada, estado de cada
  barbero con nombre corto y sin celulares) y la caja de hoy (total, medios, vitrina, servicios y
  el mismo día de la semana pasada). Cada bloque carga con su esqueleto y falla solo; se relee con
  el canal de la fila.
- T-152 hecha (rama `claude/t-152-alertas`, encima de T-151, 2026-11-07): "Hoy" suma "Piden tu
  atención" (cajas sin cerrar, limpieza, insumos, membresías que vencen; cada una con su enlace, o
  "Todo en orden"), "Citas de hoy" (solo con citas encendidas) y "Para recordar" (solo conteos). El
  número de alertas sale en rojo junto a "Hoy" en la barra y en el menú lateral. `loginAsOwner` del
  E2E entra directo a la fila.
- T-153 hecha (rama `claude/t-153-accesos`, encima de T-152, 2026-11-07): "Hoy" tiene "Fila",
  "Cerrar caja" y "Nueva venta" (abre la hoja ahí mismo); en el celular van en una barra fija
  encima del menú. Desde 1024 px, "Ingresos de la semana" con una barra por día: cada una es la Caja
  de ese día y la suma es el "Vendido" de Semana (ADR-048 corrigió REQ-076.9, sin migración).
  Siguiente: T-154 (validación del Hito 15).
- Ojo con el E2E local: con el servidor de desarrollo cargado (muchas corridas seguidas) los
  ingresos se cuelgan y fallan pruebas que no tienen que ver; reiniciar el servidor y usar
  `--workers=2` lo deja estable.

### Hito 16 — sistema visual nuevo (**spec aprobada**, ADR-047, 2026-11-07)

- Diseño: lienzo "TurnOS — Rediseño" (https://claude.ai/artifact/VK8TXA9Aw9tnZMnrXZ4kPU, 20
  tableros, versión 22 tras la revisión visual) hecho con `docs/diseno/prompt-diseno.md`; capturas en
  `docs/diseno/tableros/`.
- Spec aprobada por Henry (rama `claude/h16-spec-rediseno`): REQ-078 (15 criterios), design §22,
  T-160…T-168, sin migraciones. PA-H16-1…3 con la recomendación. Sin código todavía.
- Orden: T-160 (tokens, `accent` → `brand` antes de volver rojo a `accent`; `pnpm lint:design`) →
  T-161 (componentes base) → Hito 15 → T-162…T-168 (cliente, barbero, acceso, dueño, validación).
- T-160 hecha (rama `claude/t-160-tokens`, 2026-11-07): tokens nuevos en `globals.css`, `accent` → `brand`
  sin cambio visual y luego los valores del diseño; `pnpm lint:design` en CI; prueba de contraste;
  esquinas 5/8/10/20. Revisado con Supabase local (`.claude/launch.json` → `turnos-local`, puerto
  3001): ningún botón de acción quedó rojo.
- T-161 hecha (rama `claude/t-161-componentes`, encima de T-160, 2026-11-07): `Button`
  (`onAction` con candado contra doble envío, `SubmitButton`), `Field`, `PhoneField`,
  `MoneyField`, `PinField`, `OptionList`, `StatusChip`, `Sheet`/`Dialog`, `Toast`, `FlashRow`,
  `EmptyState`/`ErrorState`, `Icon`; `Skeleton` y `ConnectionBanner` reescritos; movimiento en
  `globals.css`. Muestra en `/diseno` (solo desarrollo). Siguiente: Hito 15 (T-150, menú del
  dueño) ya con estos componentes (PA-H16-1).
- La aprobación del hito terminado será un ADR nuevo.

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
0019 barbero preferido. Hito 9: 0050 valores nuevos de los enums · 0051 tarjetas de regalo (venta,
búsqueda, lista, página) · 0052 pagar y anular con la tarjeta · 0053 caja, semana, plantilla y aviso.
Hito 13: 0063 catálogo, sitios y dotación · 0064 entradas, transferencias y reposición · 0065 vitrina
desde la caja y la cortesía · 0066 conteos, alerta y rendimiento · 0067 orden de compra, costo por
servicio y Mi estación.

### Pantallas

Cliente: `/[slug]`, `/[slug]/turno`, `/t/[token]`, `/[slug]/privacidad`, `/[slug]/pantalla?k=`.
Personal: `/entrar`, `/invitacion/[token]`, `/crear-negocio` (3 pasos), `/app/fila`,
`/admin/{fila,servicios,productos,barberos,horario,qr,mensajes,negocio,privacidad}`.
Personal (H2): `/app/clientes`, `/app/clientes/[id]`, `/admin/fidelidad`, `/admin/recordar`.
Hito 3: `/admin/caja` (+ `/admin/caja/[fecha]`), `/admin/semana`, `/app/mis-numeros`, panel de cobro.
Hito 9: `/admin/regalos` (dueño) y `/regalo/[token]` (pública, sin cuenta).
Hito 13: `/admin/inventario` (+ `catalogo`, `conteo`, `compra`, `costos`), "Alerta de consumo (%)"
en `/admin/negocio` y `/app/estacion` (barbero).
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

- `0055_merge_customers_sales` (2026-11-04, PR #48): `merge_customers` fallaba con
  `SALE_IMMUTABLE` si la ficha fusionada tenía ventas (el `delete` hacía `on delete set null` en
  `sales.customer_id`). Ahora las ventas pasan a la ficha que queda; `sales_guard` deja cambiar solo
  `customer_id` dentro de `turnos.internal`. design §2.6 paso 2. **En producción** desde el
  2026-11-04, junto con `0050`…`0053`.
  Como ya está aplicada, el `supabase db push` del Hito 8 (`0045`…`0049`) necesita `--include-all`
  (versiones menores que la última aplicada). Las tarjetas de regalo en `merge_customers` van en
  `0056`.
- pgTAP `0018_reminders` fallaba entre las 00:00 y las 02:00 de Bogotá (la prueba, no la función):
  corregido en PR #51.

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
