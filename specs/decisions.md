# TurnOS — Registro de decisiones (ADR) y preguntas abiertas

> Formato de cada ADR: contexto → opciones → decisión → consecuencias. Estado: `propuesta`,
> `aceptada`, `reemplazada por ADR-nnn`. Una decisión aceptada solo cambia con un ADR nuevo.
> Las preguntas abiertas viven en `requirements.md` §9 (`PA-nn`); cuando se responden, la
> respuesta se registra aquí como ADR si cambia el diseño, o se incorpora al requisito si no.

## ADR-001 · Stack: Next.js + Supabase + Vercel
- Estado: **aceptada** (definida en el brief del producto, 2026-10-23)
- Contexto: equipo de una persona, experiencia previa con este stack, necesidad de tiempo real y
  autenticación sin construir backend propio.
- Opciones: (a) Next.js + Supabase + Vercel; (b) Next.js + Prisma + Postgres gestionado + WebSockets
  propios; (c) Firebase.
- Decisión: (a).
- Consecuencias: RLS como mecanismo central de aislamiento; Realtime de Supabase para la fila;
  Edge Functions para lógica que no debe correr en el cliente; dependencia de dos proveedores.

## ADR-002 · El cliente se identifica por celular, sin cuenta
- Estado: **aceptada** (brief)
- Contexto: usuarios son familias del barrio; cualquier fricción (app, contraseña, OTP) elimina el
  uso. El contacto natural es WhatsApp.
- Opciones: (a) nombre + celular sin verificación; (b) OTP por SMS/WhatsApp; (c) cuenta con
  contraseña.
- Decisión: (a). La clave del cliente es `(business_id, phone_e164)`.
- Consecuencias: no hay garantía de que el celular sea del que lo escribe; se mitiga con rate
  limiting, un turno activo por celular, y que el único canal de contacto sea WhatsApp a ese
  número (quien puso un número ajeno no recibe nada). El enlace "Mi turno" usa un token aleatorio;
  nunca el celular en la URL.

## ADR-003 · Notificaciones por `wa.me` en el MVP, interfaz preparada para Cloud API
- Estado: **aceptada** (brief)
- Contexto: WhatsApp Cloud API requiere verificación de negocio, plantillas aprobadas y costo por
  conversación; para un negocio no es viable el primer día.
- Opciones: (a) `wa.me` con mensaje prellenado y un toque del barbero; (b) Cloud API desde el
  inicio; (c) SMS.
- Decisión: (a), detrás de una interfaz `NotificationChannel` con una sola implementación en el
  MVP (`WaMeChannel`). Se registra en la base de datos el evento "aviso enviado" al tocar el
  botón.
- Consecuencias: el aviso depende de que el barbero lo toque; no hay confirmación de entrega.
  Cambiar a Cloud API después es agregar una implementación y una configuración por negocio.

## ADR-004 · Multi-tenant por `business_id` + RLS en una sola base de datos
- Estado: **aceptada** (brief)
- Opciones: (a) una base, `business_id` en todas las tablas y RLS; (b) un esquema por negocio;
  (c) una base de datos por negocio.
- Decisión: (a).
- Consecuencias: la seguridad depende de que cada tabla tenga su política y de que exista una
  prueba automatizada de aislamiento (REQ-031.4). Membresías usuario↔negocio con rol, para
  soportar varios negocios por dueño sin cambiar el modelo.

## ADR-005 · Dinero en enteros COP, registros inmutables de caja
- Estado: **aceptada** (constitución P9)
- Decisión: columnas `integer` en COP; ventas y cierres no se editan, se anulan y se vuelven a
  crear; comisión calculada y congelada en cada venta.
- Consecuencias: cambiar el porcentaje de un barbero no reescribe el pasado; el cierre de caja es
  reproducible a mano.

## ADR-006 · Especificación como fuente de verdad (SDD)
- Estado: **aceptada** (brief)
- Decisión: nada se implementa sin REQ aprobado, diseño aprobado y tarea en `tasks.md`; cada
  tarea nace con sus pruebas; cada hito cierra con matriz de trazabilidad.

## ADR-007 · Preguntas abiertas PA-01 a PA-27 resueltas con el valor por defecto
- Estado: **aceptada** (Henry, 2026-10-23: "todo está bien")
- Decisión: todos los valores por defecto de `requirements.md` §9 quedan como definitivos. Los que
  cambian el diseño quedan así:
  - PA-01 Acceso: dueño con correo + contraseña; barbero con **celular + PIN de 6 dígitos**
    (internamente una cuenta de Supabase Auth con correo alias `<celular>@barberos.turnos.local`,
    sin proveedor de SMS). Ver ADR-010.
  - PA-03 Un solo servicio por turno; los combos se crean como servicio aparte.
  - PA-04 El barbero solo llama al primero de su lista; el dueño puede reordenar y saltar.
  - PA-09 Duración por servicio, igual para todos los barberos (campo de ajuste por barbero
    reservado, no usado).
  - PA-15 Toda la plata entra al negocio; el negocio liquida la comisión al barbero.
  - PA-18 El porcentaje es la parte del barbero, sobre el valor de servicios después de descuento.
  - PA-20 Los cierres son inmutables; solo el dueño reabre con motivo (se anula el cierre y se
    crea otro).
- Consecuencias: el diseño (`design.md`) se escribe con estas reglas sin alternativas.

## ADR-008 · Tiempo real = señal por Broadcast + relectura del estado
- Estado: **aceptada**
- Contexto: el cliente no tiene sesión (ADR-002), así que no puede recibir cambios de tabla con
  RLS; además los eventos perdidos durante una desconexión no deben dejar la pantalla en un estado
  viejo (REQ-011.2).
- Opciones: (a) `postgres_changes` con políticas RLS para anónimos (imposible filtrar por token);
  (b) Broadcast desde triggers de Postgres con un payload sanitizado y relectura del estado por
  server action; (c) polling cada 3 s.
- Decisión: (b). Un trigger en `tickets` y `barbers` publica en el canal `queue:<business_id>`
  un mensaje `{ "type": "queue_changed", "at": … }` (sin datos personales). Todo cliente
  interesado (cliente, barbero, dueño, pantalla) al recibirlo vuelve a cargar su vista completa
  con una server action o RPC. Al reconectar, se recarga igual.
- Consecuencias: un solo mecanismo para todas las pantallas; los datos sensibles nunca viajan por
  el canal; la carga por evento es una consulta ligera por suscriptor (aceptable para NFR-011).

## ADR-009 · Escrituras públicas solo por server actions con validación y rate limiting
- Estado: **aceptada**
- Contexto: tomar turno y cancelar lo hace un anónimo.
- Decisión: las páginas públicas no usan la clave `anon` para escribir. Las server actions
  (Next.js) usan la clave `service_role` **solo en servidor**, validan con Zod, aplican rate
  limiting en una tabla `rate_limits` de Postgres (5 turnos/celular/hora, 30/IP/hora) y llaman
  funciones SQL (`join_queue`, `cancel_ticket_by_token`) que encapsulan las reglas.
- Consecuencias: la lógica de negocio queda en funciones de Postgres probables con pgTAP y desde
  Vitest; ningún secreto llega al navegador.

## ADR-010 · Acceso del personal: Supabase Auth con correo/contraseña y alias para barberos
- Estado: **aceptada** (resuelve PA-01)
- Decisión: dueño: correo + contraseña. Barbero: celular + PIN de 6 dígitos, materializado como
  usuario de Auth con correo `<E.164 sin +>@barberos.turnos.local` y contraseña = PIN. La
  invitación (enlace con token, 7 días) crea el usuario con el PIN que el barbero elige.
- Consecuencias: sin SMS ni costo; el PIN es débil, se compensa con bloqueo tras 5 intentos
  (Supabase) y con que el barbero solo ve su fila y sus ventas. El dueño puede restablecer el PIN.

## ADR-011 · Transiciones de estado del turno validadas en Postgres
- Estado: **aceptada**
- Decisión: una sola función `transition_ticket(ticket_id, to_status, actor, reason)` valida la
  transición contra la tabla de transiciones permitidas, actualiza marcas de tiempo, estado del
  barbero y escribe `ticket_events`. Es idempotente: repetir la misma transición ya aplicada no
  falla ni duplica (REQ-011.4). "Llamar al siguiente" usa `SELECT … FOR UPDATE SKIP LOCKED` para
  resolver la carrera entre barberos (REQ-007.2).
- Consecuencias: la máquina de estados vive en un solo lugar; la UI solo muestra botones.

## ADR-012 · Orden de la fila por `queue_order` con huecos
- Estado: **aceptada** (resuelve PA-04)
- Decisión: cada turno recibe `queue_order = sequence × 1000` al crearse (secuencia global por
  negocio). Reordenar por el dueño asigna un valor entre los vecinos; si no hay hueco, se
  renumera la fila del día. La posición y el estimado usan `queue_order`.

## ADR-013 · Tiempo estimado por simulación de asignación
- Estado: **aceptada**
- Decisión: el estimado se calcula simulando la fila contra los barberos activos (ver
  `design.md` §4), en una función pura de TypeScript (`estimateQueue`) usada por servidor y
  pruebas, no en SQL. Se redondea hacia arriba a 5 minutos.

## ADR-014 · Cierre automático del día con `pg_cron`
- Estado: **aceptada**
- Decisión: `pg_cron` (incluido en Supabase) ejecuta cada 15 min `close_expired_queues()`, que
  cancela turnos activos de negocios cuya hora de cierre + 60 min ya pasó (REQ-014). Sin
  servicios externos (NFR-013).

## ADR-015 · Base de datos local sin Docker: Postgres 16 + shim de Supabase para pruebas
- Estado: **aceptada** (2026-10-23, al iniciar la Fase 4)
- Contexto: el entorno donde se construye el MVP no tiene demonio de Docker, así que
  `supabase start` no está disponible. Sí hay Postgres 16, pgTAP, pg_trgm y pg_cron instalables.
- Opciones: (a) esperar a tener Docker; (b) correr todas las pruebas contra un proyecto remoto de
  Supabase; (c) un clúster local de Postgres con un *shim* mínimo que imita lo que las migraciones
  usan de Supabase (`auth.uid()`, roles `anon`/`authenticated`/`service_role`, `realtime.send`).
- Decisión: (c). `scripts/db-local.sh` levanta un clúster en `.pg/` (puerto 54329) y aplica
  `supabase/local/0000_supabase_shim.sql` **antes** de las migraciones; el shim nunca se aplica a
  un proyecto real de Supabase (allí esas funciones ya existen). Las migraciones en
  `supabase/migrations/` siguen siendo las que se aplican al proyecto remoto con `supabase db
  push` o con el MCP de Supabase. Auth real, Realtime real y la PWA desplegada se validan contra
  un proyecto de Supabase + Vercel a partir de T-006.
- Consecuencias: pgTAP y las pruebas de integración corren rápido y sin Docker; en la Mac de Henry
  (con Docker) `supabase start` sigue funcionando con las mismas migraciones.

## ADR-016 · Ficha de cliente: fusión, alcance del barbero y valor antes de la caja
- Estado: **aceptada** (Henry, 2026-10-24, al iniciar T-033)
- Contexto: REQ-018.2, 18.4 y 18.5 dejaban sin definir (a) qué pasa con la fidelidad y los datos
  al fusionar dos fichas, (b) qué clientes lista el barbero (el RLS de `customers` le permite leer
  todo el negocio) y (c) qué "valor pagado" mostrar antes de que exista la caja (Hito 3). La
  `merge_customers` de 0013 borraba la tarjeta abierta de la ficha absorbida, perdiendo sellos.
- Opciones fusión/fidelidad: (1) sumar sellos; (2) quedarse con la tarjeta de más sellos;
  (3) conservar solo la de la ficha principal. Alcance barbero: (1) su fila + los que ha atendido;
  (2) todo el negocio. Valor antes de H3: (1) precio congelado en el turno; (2) vacío.
- Decisión:
  - **Fusión** (`merge_customers(keep, merge)`, solo dueño): el dueño elige qué celular queda
    (preseleccionado el de la ficha con visita más reciente); nombre y celular son los de esa
    ficha. Turnos, recordatorios y tarjetas canjeadas pasan a la ficha que queda. Las tarjetas
    abiertas se **juntan**: los sellos (`loyalty_stamps`) se mueven a una sola tarjeta, el conteo
    se suma y, si el programa está activo y la suma llega a `visits_required`, el premio queda
    disponible (`completed`). Los sellos que excedan el requerido no pasan a la tarjeta siguiente.
    Si **las dos** fichas tienen premio disponible, no se fusiona (`BOTH_REWARDS_PENDING`):
    primero se canjea uno. Visitas = suma; primera/última visita = mín/máx; notas se unen;
    aviso de privacidad = la aceptación de versión más alta; "No contactar" si cualquiera lo
    tenía; barbero preferido se recalcula (salvo que la ficha que queda lo tenga fijado a mano).
    No se fusiona una ficha consigo misma, ni fichas eliminadas (REQ-018.6), ni de otro negocio.
  - **Barbero** en `/app/clientes`: lista "Hoy en tu fila" (turnos activos de hoy que lo
    eligieron a él o a "el que esté libre") y "Atendidos por ti" (turnos con
    `assigned_barber_id` = su silla); el buscador filtra solo esos. Solo abre fichas de ese
    conjunto. Dentro de la ficha ve el historial completo del cliente en el negocio, pero el
    valor solo de sus propios turnos (PA-10). El RLS no cambia: el filtro es de la función
    `barber_customers` y de la acción `getCustomer`.
  - **Valor antes de H3**: el historial muestra `tickets.service_price` (precio congelado al
    tomar el turno) solo en turnos `done`; medio de pago vacío. T-043 lo reemplaza por el valor
    cobrado de `sales` y agrega el medio de pago.
- Consecuencias: migración `0014_customers_merge.sql` redefine `merge_customers` y agrega
  `barber_customers`; nada del pasado se pierde al fusionar salvo el exceso de sellos (raro y
  documentado).

## ADR-017 · Aprobación de los Hitos 1 y 2 con parte manual de T-029 pendiente
- Estado: **aceptada** (Henry, 2026-10-24)
- Contexto: H1 y H2 tienen todos sus CA con prueba (`pnpm trace --hito=1/2` → 0 huecos), CI verde
  en GitHub (con Lighthouse) y la app desplegada en producción
  (https://turnos-smoky-nine.vercel.app). Henry probó en su celular el flujo del cliente y del
  barbero (H1) y clientes y fidelidad (H2). De T-029 faltan dos verificaciones manuales:
  instalación como app en Android/iPhone y la prueba de pasillo con un barbero real (NFR-007).
- Opciones: (a) esperar esas dos verificaciones para cerrar H1; (b) aprobar H1 y H2 y llevar la
  parte manual de T-029 como pendiente explícito.
- Decisión: (b). T-030 y T-039 quedan `[x]`; T-029 sigue `[~]` hasta registrar la instalación
  (tabla del README) y la prueba de pasillo (en este archivo).
- Consecuencias: se empieza el Hito 3 (T-040). La prueba de pasillo de NFR-007 incluye el cobro,
  así que conviene hacerla cuando exista el panel de cobro (T-043) y cubrir H1 y H3 de una vez.

## ADR-018 · Reglas de `register_sale` y `void_sale` que la spec no fijaba
- Estado: **aceptada** (Henry, 2026-10-24: "apruebo el ADR-018"; antes, provisional desde que se
  implementó T-041 con su autorización de avanzar sin consultarle). Cualquier punto se cambia con un
  ADR nuevo.
- Contexto: REQ-023, REQ-025 y design.md §5.1 definen las fórmulas, pero no quién fija el precio,
  dónde queda el motivo del descuento, qué pasa con el turno al anular ni a nombre de quién queda
  una venta de productos de un barbero.
- Decisión:
  1. **Precios del servidor.** El cliente manda servicio/producto y cantidad; el precio lo pone la
     base: la línea del servicio del turno usa `tickets.service_price` (congelado al tomar turno);
     las demás, el catálogo activo.
  2. **Descuentos (PA-13).** Solo el dueño descuenta, y con motivo (`sale_items.discount_reason`).
     El barbero solo aplica el premio. Los productos no llevan descuento.
  3. **Premio.** El valor lo fija el programa: servicio gratis = el precio del servicio
     configurado (otro servicio → `REWARD_SERVICE_MISMATCH`); descuento = el monto configurado
     (máximo el precio). Un premio por venta.
  4. **Productos de un barbero.** Si un barbero registra una venta solo de productos, queda a su
     nombre (comisión 0, PA-17) para que la vea en "Mis números"; si la registra el dueño, sin
     barbero.
  5. **Anular** (`void_sale`): solo el dueño, solo ventas del día de caja de hoy ("una venta del
     día", REQ-026.1), con motivo. El turno vuelve a "cobro pendiente" para registrarlo bien, por
     eso la unicidad es **una venta activa por turno** (índice parcial). Si la venta usó el premio
     y la tarjeta nueva no tiene sellos, el premio vuelve a quedar disponible.
- Consecuencias: migración `0022_register_sale.sql`; `src/lib/domain/commission.ts` replica las
  fórmulas para la UI; pgTAP 0022 reproduce los ejemplos A–D.

## ADR-019 · Permisos de ejecución de funciones explícitos (corrección de seguridad)
- Estado: **aceptada** (2026-10-24; corrección aplicada al encontrar el problema en producción)
- Contexto: en Supabase real, `anon` y `authenticated` reciben EXECUTE sobre todas las funciones
  de `public` por *default privileges*. Las migraciones solo revocaban a `PUBLIC`, y varias
  funciones aceptan `auth.uid() is null` pensando en `service_role`/pruebas. Con la llave pública
  (y el id del negocio, que es público) se podían llamar `search_customers`, `register_sale`,
  `void_sale`, `close_cash_day`, etc. Además, el personal podía llamar funciones solo del
  servidor (`join_queue`, `upsert_customer`). El shim de ADR-015 no reproduce esos permisos, por
  eso ninguna prueba lo detectó hasta llamar la API de producción sin sesión.
- Decisión: migración `0028_function_grants.sql`: revocar EXECUTE a `public`, `anon` y
  `authenticated` sobre todo `public`; `service_role` todo; `authenticated` solo la lista de
  funciones del personal y las que usan las políticas RLS y los defaults de columnas;
  `gen_public_token` pasa a `security definer`; *default privileges* sin EXECUTE para funciones
  nuevas (cada migración debe dar permisos explícitos). Prueba `supabase/tests/0029_function_grants.sql`,
  corrida también sobre la imagen real de Supabase (no solo el shim).
- Consecuencias: toda función nueva necesita su `grant execute ... to authenticated` si la usa el
  personal. Pendiente de revisar si en algún momento se leyeron datos con esta vía (logs de la API
  de Supabase): el negocio de producción es solo de demostración con datos del seed.

## ADR-020 · Aprobación del Hito 3 con pruebas de pasillo pendientes
- Estado: **aceptada** (Henry, 2026-10-24: "apruebo el Hito 3")
- Contexto: H3 (caja y comisiones) construido y en producción; matriz 144/144 CA con prueba;
  CI verde en GitHub (unitarias con cobertura 100 % del dominio, pgTAP, integración, Lighthouse);
  corrección de seguridad ADR-019 aplicada. Siguen manuales: prueba de pasillo con un barbero
  (T-029, NFR-007) y con el dueño (T-049), e instalación en celulares reales.
- Decisión: T-050 `[x]`; T-029 y T-049 siguen `[~]` hasta registrar esas pruebas aquí, como en
  ADR-017. ADR-018 (reglas de cobro y anulación) seguía provisional; Henry lo aprobó aparte el
  mismo día.
- Consecuencias: el MVP de la especificación (REQ-001…REQ-034) queda construido. Lo siguiente sale
  de los pendientes externos y de lo que muestre el uso real en la barbería.

## ADR-021 · Prueba de pasillo e instalación en celulares reales (NFR-007, REQ-032.1)
- Estado: **aceptada** (Henry, 2026-10-25)
- Contexto: T-029 y T-049 quedaron `[~]` (ADR-017, ADR-020) hasta hacer la prueba de pasillo y la
  instalación en celulares reales, contra producción (https://turnos-smoky-nine.vercel.app).
- Resultado (reportado por Henry): **un barbero** completó llamar → en la silla → terminado → cobro
  sin ayuda; **el dueño** cobró, registró una venta suelta y cerró la caja sin ayuda; la app se
  instaló en **Android** (Chrome) y en **iPhone** (Safari, "Agregar a inicio"). Nada les costó ni
  hubo preguntas; no quedaron hallazgos.
- Decisión: NFR-007 y la verificación manual de REQ-032.1 se dan por cumplidas; T-029 y T-049 `[x]`.
- Consecuencias: del MVP solo queda abierta T-010 (activar E2E en el CI con los secretos del
  proyecto de Supabase y proteger `main`), que depende de configuración en GitHub.

## ADR-022 · E2E del CI contra un Supabase local, nunca contra producción
- Estado: **aceptada** (2026-10-25)
- Contexto: design.md §8 y el job `e2e` de 0.1 suponían correr los E2E con los secretos "del
  proyecto de Supabase". El único proyecto es producción (ADR del despliegue, 2026-10-24) y los
  E2E cambian datos: `resetQueue` cancela todos los turnos activos, `close-cash` cierra y reabre la
  caja del día, otras crean clientes, ventas y barberos. Correrlos en cada push contra producción
  le cancelaría turnos a clientes reales.
- Opciones: (a) secretos de producción; (b) un segundo proyecto de Supabase de pruebas; (c)
  `supabase start` dentro del CI con migraciones + seed (como el job de Lighthouse).
- Decisión: (c). Sin secretos; mismo esquema que producción (migraciones versionadas) y la imagen
  real de Supabase (cubre también los permisos de ADR-019, que el shim no reproduce).
- Consecuencias: T-010 ya no depende de configurar secretos en GitHub; solo queda proteger `main`.
  `design.md` §8: "E2E contra Supabase local del CI (ADR-022)".

## ADR-023 · Servicios por barbero (REQ-035)
- Estado: **aceptada** (Henry, 2026-10-28)
- Contexto: Filo tiene 4 sillas de hombre, 1 de mujer y una persona aparte para manicure y
  pedicure. REQ-003, REQ-006 y REQ-007 suponen que cualquier barbero hace cualquier servicio: un
  turno de "El que esté libre" le cae al primero que llame, y un cepillado le puede caer a quien
  solo corta pelo de hombre.
- Opciones: (a) lista de servicios por barbero (relación barbero ↔ servicio); (b) categorías
  (servicio "hombre"/"mujer", barbero atiende una o ambas); (c) no modelarlo y que el dueño
  reasigne a mano.
- Decisión: (a), tabla `barber_services`. Por defecto cada barbero hace todo (negocios existentes
  sin cambios). La fila respeta la relación (formulario, fila del barbero, `call_next`,
  estimados, acciones del dueño); la caja no. La persona de manicure es un barbero con solo esos
  servicios (sin rol nuevo). Duración y precio siguen iguales para todos (PA-09).
- Consecuencias: precisa REQ-003.1 (lista de barberos según el servicio), REQ-006.1/REQ-007.1
  (lista del barbero y "Llamar al siguiente"), REQ-004 (estimado) y REQ-016.1 (alta de barbero).
  Cambian `join_queue`, `add_manual_ticket`, `call_next`, `get_barber_queue`,
  `get_public_business`, `transition_ticket` (llamar/reasignar con barbero), `estimateQueue` y las
  pantallas de Barberos y Servicios. Nuevo Hito 4 (T-051…T-057).

## ADR-024 · Aprobación del Hito 4 (servicios por barbero)
- Estado: **aceptada** (Henry, 2026-10-28)
- Contexto: REQ-035 / ADR-023 implementados en T-051…T-056 (PRs #4–#9) con `pnpm trace --hito=4`
  sin huecos y CI verde (unit, pgTAP, integración, E2E Pixel 7 + iPhone 13, Lighthouse).
- Decisión: Henry aprueba el Hito 4 y autoriza fusionar la cadena #6–#10 y llevar las migraciones
  0030–0032 a producción.
- Consecuencias: T-057 `[x]`. En producción ya estaban 0030–0032 y la app desplegada desde la rama
  de T-055 (por un `checkout` fallido en otra sesión); tras fusionar, se vuelve a desplegar desde
  `main` limpio para que producción y `main` coincidan. Falta configurar Filo desde **Barberos**
  cuando lleguen sus barberos.


## ADR-025 · TurnOS es para una sola barbería; Hito 5 "experiencia del cliente"
- Estado: **aceptada** (Henry, 2026-10-28)
- Contexto: tras comparar TurnOS con Bukea, Beunik, WeiBook, SANEO, TuTurno, SleekFlow y
  AgendaPro (`docs/propuesta-mejoras-clientes.md`), Henry aclara que TurnOS **no es un producto
  para vender**: es para su barbería (Filo). La pregunta deja de ser "¿qué tiene la competencia?" y
  pasa a ser "¿qué mejora la experiencia de nuestros clientes?".
- Opciones: (a) seguir diseñando como producto multi-negocio (planes, precios, alta de negocios);
  (b) enfocar todo en una barbería y dejar lo multi-negocio como está.
- Decisión: (b). Lo multi-negocio que ya existe (`business_id`, RLS, `/crear-negocio`) se queda
  porque funciona y no estorba, pero no se extiende ni se usa para justificar requisitos. Orden de
  mejoras acordado ("lo rápido primero"): Hito 5 = reseña en Google (REQ-036), cumpleaños
  (REQ-037), menú de la barbería con bebida de cortesía (REQ-038) y fotos de cortes (REQ-039).
  Después, cada uno con su grill y su ADR: aviso automático (canal por decidir: push + WhatsApp
  Cloud API directo con Meta), membresía familiar (cuota mensual con N cortes compartidos y
  descuento al agotarlos), citas a hora fija mezcladas con la fila, gift cards y asistente con IA en
  WhatsApp.
- Valores por defecto de las preguntas del borrador (Henry aprobó el Hito 5 sin responderlas; se
  cambian con una nota en `requirements.md`): (1) el enlace de reseña solo va en "Mi turno", no por
  WhatsApp, porque aún no hay envío automático; (2) el cumpleaños trae solo saludo: el dueño escribe
  el regalo, si quiere, en la plantilla; (3) la cortesía no pasa por caja: queda en el turno
  (bebida y "Servida ✓"), sin inventario; (4) hasta 12 fotos por barbero.
- Consecuencias: REQ-036…REQ-039 nuevos (§5c de `requirements.md`), `design.md` §11, tareas
  T-058…T-063. "Fuera de alcance del MVP" no cambia, pero sus puntos de citas, planes familiares,
  WhatsApp Cloud API y push pasan a ser hitos futuros, no exclusiones. Primer uso de Supabase
  Storage (fotos).


## ADR-026 · Aprobación del Hito 5 (experiencia del cliente)
- Estado: **aceptada** (Henry, 2026-11-01)
- Contexto: REQ-036…REQ-039 implementados en T-058…T-062 (PRs #13–#21), con `pnpm trace --hito=5`
  sin huecos (180 criterios), CI de `main` en verde y desplegado en producción el 2026-11-01.
  Henry hizo la prueba en la barbería con el celular.
- Decisión: Henry aprueba el Hito 5.
- Consecuencias: T-063 `[x]`. Siguen las mejoras de ADR-025 (aviso automático, membresía familiar,
  citas a hora fija, gift cards, asistente en WhatsApp), cada una con su grill y su ADR.

## ADR-027 · Aviso automático por WhatsApp oficial (Hito 6)
- Estado: **aceptada** (Henry, 2026-11-01, tras grill de 15 preguntas)
- Contexto: hoy el aviso depende de que el barbero toque el botón de `wa.me` (REQ-009), y con las
  manos ocupadas se le olvida. Comparación de canales en `docs/propuesta-mejoras-clientes.md`.
  Desde el 1-oct-2026 Meta cobra los mensajes de utilidad también dentro de la ventana de 24 h, y
  deja 1.000 mensajes de servicio gratis al mes por número. Tarifa de utilidad en Colombia: unos
  USD 0,0008 o $2,95 COP por mensaje según fuentes secundarias (por verificar en la tabla oficial).
- Opciones: (a) push web; (b) WhatsApp Cloud API directo con Meta; (c) las dos; (d) librerías no
  oficiales, descartadas porque violan las reglas de WhatsApp y arriesgan el número.
- Decisión: (b), plantillas de utilidad sin que el cliente escriba primero. Reemplaza la
  recomendación del borrador (push + "Hola" para abrir la ventana): por unos $3 COP el mensaje no
  vale la pena un paso más para el cliente ni un segundo canal. Costo esperado: unos $6.000 COP al
  mes con 2.000 avisos. Número nuevo (SIM aparte); el WhatsApp actual de la barbería no se toca.
  Dos avisos por turno como máximo: "faltan 2" y "te están llamando". Permiso con casilla aparte sin
  marcar. El botón manual queda como respaldo. Tope de 3.000 avisos al mes. Solo se activa en Filo.
  Los textos automáticos son fijos porque Meta los aprueba. Trámite con Meta a cargo de Henry
  (`docs/guia-whatsapp-meta.md`).
- Consecuencias: REQ-040…REQ-043 nuevos (§5d), `design.md` §12, tareas T-064…T-069. Precisa REQ-009
  (el envío automático marca "Avisado ✓") y REQ-033 (los textos automáticos no se editan). Sale de
  "Fuera de alcance" el envío por WhatsApp Cloud API; la notificación push sigue fuera. El celular y
  el nombre del cliente pasan por Meta: el aviso de privacidad debe decirlo y publicarse una versión
  nueva (REQ-002.5). Los mensajes de cumpleaños e inactivos siguen manuales porque son de marketing
  (unas 15 veces más caros), y la IA sigue en un hito aparte.

## ADR-028 · Mensajes entrantes de WhatsApp en un número compartido
- Estado: **aceptada** (Henry, 2026-11-01, en T-067)
- Contexto: la instalación tiene un solo número de WhatsApp y un mismo celular puede tener ficha en
  varios negocios. §12.5 no decía de qué negocio es un mensaje entrante, y `whatsapp_opt_out_by_phone`
  y la respuesta automática necesitan saberlo. Además `check_rate_limit` usa ventanas fijas, que no
  cumplen "máximo una vez cada 24 horas" (REQ-042.4), y borra al azar lo que tenga más de 2 horas.
- Opciones para "PARAR": (a) baja solo en el negocio del último aviso; (b) baja en todos los negocios
  donde ese celular tenga permiso vigente.
- Decisión: (b). El cliente no elige negocio al responder y debe dejar de recibir avisos de ese
  número. El número de contacto de la respuesta automática sale del negocio del último aviso enviado;
  si no hay, del único negocio activo; si no, se omite (REQ-042.5). La ventana de 24 h es móvil, con
  la función nueva `claim_whatsapp_reply`.
- Consecuencias: migración `0038_whatsapp_inbound`, que se aplica en producción junto con `0036` y
  `0037`. `design.md` §12.5. Con solo Filo activo (ADR-027), (a) y (b) dan lo mismo hoy; la diferencia
  aparece si se activa un segundo negocio.

## ADR-029 · WhatsApp solo en negocios habilitados por el operador
- Estado: **aceptada** (Henry, 2026-11-02, antes de poner las credenciales en Vercel)
- Contexto: ADR-027 dice que el aviso solo se activa en Filo, pero el interruptor dependía solo de las
  credenciales del servidor, que son de toda la instalación. Con ellas en Vercel, cualquier dueño lo
  vería, y además puede escribir `whatsapp_auto_enabled` directo por la API (política
  `businesses_update`). Otro negocio activo mandaría mensajes por el número y la tarjeta de Filo, y
  rompe la regla de "PARAR" de ADR-028 (el "único negocio activo").
- Opciones: (a) lista de negocios en una variable de entorno, solo en las pantallas; (b) columna
  `whatsapp_allowed` que solo cambia `service_role`, con `check` que exige habilitación para encender.
- Decisión: (b). Cierra también la escritura directa y las funciones SQL sin tocarlas. Filo queda
  habilitado en la misma migración.
- Consecuencias: REQ-043.6, migración `0040_whatsapp_allowed`, `design.md` §12.1 y §12.6, tarea T-070.
  Va a producción antes que las variables `WHATSAPP_*`. Habilitar otro negocio es un `update` del
  operador. La aprobación del Hito 6 pasa a ser ADR-031 (ADR-030 quedó para la membresía familiar).

## ADR-030 · Membresía familiar (Hito 7)
- Estado: **aceptada** (Henry, 2026-11-02, tras grill de 25 preguntas; aprobó la spec en el PR #36)
- Contexto: Henry escogió una cuota mensual con N cortes compartidos por la familia y descuento al
  agotarlos (`docs/propuesta-mejoras-clientes.md`, ADR-025). Toca caja y comisiones: hoy la comisión
  se calcula sobre el precio después de descuento (PA-18) y solo el premio de fidelidad se calcula
  sobre el precio de lista (PA-19).
- Opciones para la comisión de un corte de membresía: (a) sobre el precio de lista, la asume el
  negocio; (b) sobre la cuota dividida entre N cortes; (c) sin comisión.
- Decisión: (a), también para el descuento que se aplica al agotar los cortes. Los barberos son
  independientes y no deben perder por la membresía, y es la misma regla del premio. La cuota entra
  completa como ingreso del negocio, sin comisión. Además: un solo plan configurable y apagado por
  defecto; cobro en la caja por el dueño, sin pasarela; periodos de 30 días que se encadenan si se
  renueva antes; cortes que no se acumulan; hasta 5 personas por familia y un celular en una sola
  membresía vigente; solo el dueño inscribe; un beneficio por venta, con la membresía antes que el
  premio; el corte de membresía no suma sello; recordatorio de renovación manual por `wa.me`.
- Consecuencias: REQ-044…REQ-048 (§5e), `design.md` §13 (cambia la fórmula de §5.1),
  migraciones `0041`…`0044` y tareas T-071…T-077. Sale de "Fuera de alcance" el plan familiar. El
  aviso de privacidad por defecto agrega un párrafo; Filo publica una sola versión nueva con este y el
  de WhatsApp. La aprobación del Hito 6 pasa a ser ADR-031.
- Corrección (Henry, 2026-11-02, T-071): la tabla de la familia se llama `family_memberships`
  porque `memberships` ya guarda el personal de cada negocio desde `0002`. Al fusionar dos fichas
  que están en familias distintas con periodo vigente o futuro, `merge_customers` rechaza con
  `BOTH_IN_FAMILIES` (`design.md` §13.1).

## ADR-032 · Aprobación del Hito 7 (membresía familiar)
- Estado: **aceptada** (Henry, 2026-11-03)
- Contexto: REQ-044…REQ-048 implementados en T-071…T-077 (PRs #36–#43, fusionados en `main` el
  2026-11-03), con `pnpm trace --hito=7` sin huecos (235 criterios) y CI de `main` en verde. El mismo
  día Henry aplicó `0041`…`0044` en producción con `supabase db push` y desplegó `main`
  (`a50342d`); `/salud`, `/filo` y `/admin/membresias` responden.
- Decisión: Henry aprueba el Hito 7 antes de la prueba con una familia real. Lo que queda es
  operación en Filo, no código: fijar el plan, revisar la plantilla "Membresía por vencer", publicar
  la versión nueva del aviso de privacidad (membresía + WhatsApp, REQ-002.5) y la prueba con una
  familia real. Si esa prueba encuentra un problema, se corrige como tarea nueva.
- Consecuencias: T-077 `[x]`. ADR-031 sigue apartado para la aprobación del Hito 6 (T-069).

## ADR-033 · Citas a hora fija mezcladas con la fila (Hito 8)
- Estado: **aceptada** (Henry, 2026-11-03, tras grill de 15 preguntas en tres tandas; tomó todas
  las opciones recomendadas y autorizó construir sin esperar su sí a la spec: "doy autorización a
  todo para que puedas seguir sin mí").
- Contexto: hoy todo es fila sin cita (constitución §6 dejaba las reservas para después y
  `tickets.scheduled_at` reservado). Algunas familias quieren llegar a una hora y no esperar. El
  riesgo es romper la fila: que los clientes sin cita esperen más de lo que el estimado dice, o que
  un barbero quede ocupado con un sin cita a la hora de una cita.
- Opciones para mezclar: (a) la cita reserva un hueco del barbero, el estimado lo cuenta y a su hora
  la cita queda de primera en la fila de ese barbero; (b) la fila no reserva hueco y la cita solo pasa
  de primera al llegar; (c) barberos o franjas solo para citas.
- Decisión: (a). Además, valores que eligió Henry:
  - Reservan el cliente desde `/[slug]` (nombre y celular, sin cuenta, P1) y el dueño desde `/admin`.
  - Barbero elegido o "El que esté libre"; con "cualquiera" el sistema fija uno al reservar.
  - Horas cada 15 min; la cita ocupa la duración del servicio (REQ-035) y debe terminar antes del
    cierre. Desde 1 hora después de ahora hasta 7 días adelante. Sin horas en días cerrados.
  - "Llamar al siguiente" salta a un sin cita cuyo servicio no termina antes de la próxima cita del
    barbero; el dueño puede forzarlo.
  - Llegada: la marca el barbero o el dueño ("Llegó"), no el cliente. Tolerancia de 10 min; después
    la cita pierde la hora y, si llega, entra como sin cita. Si nunca llega, "No vino" al cierre.
  - El cliente cancela cuando quiera desde "Mi cita"; no hay mover (cancela y reserva otra).
  - Una cita pendiente por celular y negocio.
  - Recordatorio manual por `wa.me` ("Citas de mañana" del dueño) y archivo de calendario para el
    cliente; no depende de Meta (ADR-027).
  - Apagadas por defecto; el dueño las enciende y marca qué barberos reciben citas.
  - Barbero ausente o en pausa a la hora de la cita: el dueño la pasa a otro o la cancela con aviso
    por `wa.me`; si era "cualquiera", al marcar "Llegó" el sistema busca otro barbero presente.
  - Días que el dueño cierra con citas ya dadas: no se cancelan solas; el dueño las ve marcadas y
    avisa.
- Consecuencias: REQ-049…REQ-054 (§5f), `design.md` §14, migraciones `0045`…`0047`, tareas
  T-078…T-087 (T-088 y T-089 quedan libres). Sale de "Fuera de alcance" la reserva con hora fija.
  La cita es una tabla aparte (`appointments`); al llegar se vuelve un turno normal, así que caja,
  fidelidad, membresía y avisos de WhatsApp no cambian. La aprobación del Hito 8 será ADR-035.

## ADR-034 · Tarjetas de regalo (Hito 9)
- Estado: **aceptada** (Henry, 2026-11-03: tras el grill dio autorización para seguir sin él; PR #45)
- Contexto: Hito 9 de `docs/propuesta-mejoras-clientes.md`. Toca caja y comisiones: la venta de la
  tarjeta entra plata hoy, pero el servicio se presta otro día, y la comisión del barbero es sobre el
  servicio (PA-18, ADR-030). La Circular Única de la SIC (numeral 2.18.3.2, Circular Externa 006 de
  2014) exige que los bonos y tarjetas de regalo duren como mínimo un año desde que se expiden, y
  usarlos en partes no alarga el plazo; la Ley 1480 (arts. 23 y 24) pide informar las condiciones.
- Opciones para la caja: (a) venderla es una venta aparte (ingreso del día, sin comisión) y usarla es
  un medio de pago más que no es plata nueva; (b) el ingreso se reconoce solo al usarla; (c) la
  tarjeta es un descuento en la venta del servicio.
- Decisión: (a). La plata cuadra con la caja del día en que se recibe, el barbero gana su comisión
  normal sobre el servicio que presta, y no se mezcla con "un beneficio por venta" (REQ-047.5). Henry
  escogió las 12 respuestas recomendadas del grill: valor libre ($ 10.000–$ 500.000, en miles); enlace
  por WhatsApp (`wa.me`) a una página pública de la tarjeta; vence a un año; se usa en partes; solo el
  dueño vende y cualquiera del personal cobra con ella; anular con las reglas de caja, sin devolver
  saldo en efectivo; se combina con membresía, premio y descuentos; al portador, con la ficha del
  comprador y solo el nombre de pila de quien la recibe; código de 8 caracteres sin símbolos
  confusos; cierre y semana con vendidas, pagado con tarjeta y "Entró en plata", y lista con "Saldo
  por usar".
- Abogado del diablo (breve, pedido por Henry), y lo que cambió:
  1. *Doble conteo:* el día de J (§15.4) el "total vendido" suma la tarjeta y el corte que paga con
     ella, 75.000, cuando entraron 50.000. → El cierre muestra "Entró en plata" y lo pagado con tarjeta
     no cuenta en el efectivo esperado (REQ-059.2).
  2. *Adivinar códigos:* 8 caracteres de 31 símbolos son ~850 mil millones de combinaciones, y el
     código solo se prueba desde el cobro, con sesión del personal. La página pública usa otro token
     de 16 bytes. → Sin límite de intentos extra; código y token separados (REQ-055.4).
  3. *Gastarla dos veces a la vez:* dos sillas cobrando con la misma tarjeta. → Tarjeta bloqueada al
     cobrar y saldo recalculado (REQ-057.8).
  4. *Lavar plata entre tarjetas o cuotas:* pagar una tarjeta con otra alarga el plazo de un saldo. →
     Prohibido pagar tarjetas o cuotas con tarjeta (REQ-057.7) y sin traspasos (REQ-058.3).
  5. *Saldo que nunca se usa:* es plata del cliente durante un año. → La lista muestra "Saldo por
     usar" para que el dueño sepa cuánto debe; al vencer se pierde, como permite la norma.
  6. *Tarjeta perdida:* al portador, quien la tenga la usa. → Aceptado y dicho en las condiciones de
     la página; bloquear tarjetas queda fuera de alcance.
- Consecuencias: REQ-055…REQ-059 (§5g), `design.md` §15, migraciones `0050`…`0053` (`0054` libre) y
  tareas T-090…T-097. El aviso de privacidad por defecto agrega un párrafo (comprador); Filo publica
  una versión nueva. Los números saltan (REQ-049…054, §14, `0045`…`0049`, T-078…T-089 y ADR-033/035
  son del Hito 8, en paralelo). La aprobación del Hito 9 será ADR-036.

## ADR-036 · Aprobación del Hito 9 (tarjetas de regalo)
- Estado: **aceptada** (Henry, 2026-11-04)
- Contexto: REQ-055…REQ-059 implementados en T-090…T-097 (PRs #50, #49, #52, #56, #58, #60, #62 y
  #63, fusionados en `main` el 2026-11-04 con el CI en verde, incluidos E2E y Lighthouse), con
  `pnpm trace --hito=9` sin huecos (261 criterios). Con la autorización de Henry, el mismo día se
  aplicaron `0050`…`0053` y `0055` en producción con `supabase db push` y se desplegó `main`
  (`b7de232`); `/filo` responde y `/admin/regalos` pide entrar.
- Decisión: Henry aprueba el Hito 9 antes de la prueba en la barbería. Lo que queda es operación en
  Filo, no código: publicar la versión nueva del aviso de privacidad con el párrafo de tarjetas de
  regalo (REQ-059.4, por el mecanismo de REQ-002.5), revisar la plantilla "Tarjeta de regalo" y la
  prueba en la barbería. Si esa prueba encuentra un problema, se corrige como tarea nueva.
- Consecuencias: T-097 cerrada. Queda abierto que `merge_customers` (`0055`) no mueve
  `gift_cards.buyer_customer_id`: fusionar una ficha que compró una tarjeta falla por la llave
  foránea. Va como corrección aparte (después: `0056`, porque `0054` quedaría antes que `0055`). ADR-031 sigue apartado para el Hito 6 y
  ADR-033/035 son del Hito 8.

## ADR-037 · Control de limpieza y bioseguridad (Hito 11)
- Estado: **aceptada** (Henry, 2026-11-04: grill de 21 preguntas, todas con la respuesta
  recomendada; aprobó la spec en el PR #73)
- Contexto: el plan operativo de Henry ("Gamma") pide controlar la limpieza y la bioseguridad de la
  barbería, con listas de apertura, cierre, limpieza profunda y entre clientes. Henry decidió el
  2026-11-04 que todo va en TurnOS (nada en Odoo), que no hay horario por barbero ni niveles de
  barbero, y que Limpieza (11), Punto de venta (12) e Inventario (13) se construyen en paralelo. La
  Resolución 2827 de 2006 del Ministerio de Salud pide protocolos de bioseguridad en peluquerías, y
  la Secretaría de Salud los revisa en visita. Las fotos del local pueden mostrar personas (Ley 1581).
- Opciones:
  - Qué se registra: (a) apertura, cierre y profunda; (b) también cada limpieza entre clientes.
  - A quién le toca: (c) a cualquiera del personal; (d) asignado o en rotación.
  - Cómo avisar: (e) solo dentro de TurnOS; (f) también por WhatsApp.
  - Dónde guardar las fotos: (g) el bucket público `media` del Hito 5; (h) un bucket privado nuevo.
  - Cómo borrarlas: (i) con un cron nuevo de Vercel; (j) con `after()` al usar el módulo,
    escondiéndolas desde el día 90.
- Decisión: (a), (c), (e), (h) y (j).
  - Entre clientes no se registra: un toque más por corte no se haría. Va impreso y se controla en
    la revisión sorpresa del dueño (Bien o Falla por punto, con falla asignable a un barbero).
  - Hay una apertura y un cierre por día y una profunda por semana, y las registra el primero que
    llega. El cierre exige foto y solo se registra desde 1 hora antes de cerrar. La apertura con más
    de 30 minutos de retraso queda "Tarde".
  - Se puede enviar incompleto con nota por punto, y lo enviado no se edita. El cierre que no se
    registró antes de la medianoche queda "Sin registrar".
  - Las listas son editables y cada registro guarda la copia de sus puntos.
  - Las tareas periódicas son del dueño y guardan el historial de sus certificados.
  - El historial no tiene niveles ni consecuencias automáticas.
  - Las fotos se borran a los 90 días; los registros y los certificados se conservan.
- Por qué (j) y no (i): TurnOS no tiene crons de Vercel ni pg_net (§12.4), y desde SQL no se borran
  objetos de Storage. Con (j), "Foto borrada" se cumple el día 90 aunque nadie abra la app. El borrado
  físico pasa la próxima vez que alguien abre Limpieza, y en la barbería eso es a diario.
- Abogado del diablo: no se pasó, porque no hay plata, precios ni datos de clientes. Riesgos vistos
  en el grill:
  1. *Marcar sin limpiar*: la lista no prueba nada. → Foto obligatoria en el cierre, hora mínima y
     revisión sorpresa del dueño.
  2. *Rellenar después*: → no se edita lo enviado y el cierre no se registra al día siguiente.
  3. *Fotos con personas*: → texto "local vacío, sin personas", bucket privado y borrado a 90 días.
  4. *Wifi caído al cierre*: → no se pierde lo marcado; no hay modo sin conexión.
- Consecuencias: REQ-060…REQ-064 (§5h), `design.md` §16, migraciones `0057`…`0059` y tareas
  T-100…T-109. Bucket nuevo `cleaning` en Supabase (lo crea la migración). Todo nace apagado. Los
  números saltan: el Hito 10 está reservado y el 12 y el 13 van en paralelo. La aprobación del Hito
  11 será otro ADR, que se pide a la sesión coordinadora.

## ADR-038 · Punto de venta de productos con comisión (Hito 12)
- Estado: **aceptada** (Henry, 2026-11-04: aprobó la spec en el chat; PR #75)
- Contexto: Henry pidió "una sección donde se pueden ver los productos que tenemos, como un punto
  POS para la venta, y se le puede asignar la venta a un barbero, donde va a tener la comisión por
  esa venta". El plan operativo de Gamma habla de 10 % para quien vende la vitrina (cera, aceite de
  barba, after shave). Hoy PA-17 dice que los productos no dan comisión y cada venta tiene un solo
  barbero, del que dependen la comisión (§5.1), el cierre, la semana y "Mis números". El stock va en
  el Hito 13 (inventario), que se cuelga de las líneas de producto. Henry descartó horario por
  barbero, planes de crecimiento y niveles de comisión (2026-11-04).
- Opciones del %: (a) uno del negocio con una casilla por producto; (b) uno por producto; (c) uno
  para todos los productos, helados incluidos. Opciones de a quién va la comisión cuando el producto
  va en el cobro de un corte: (a) al barbero de la venta (una venta, un barbero); (b) un barbero por
  línea.
- Decisión: (a) y (a). Henry escogió las 7 respuestas recomendadas del grill: % del negocio (10 % por
  defecto) y casilla "Da comisión al que vende" por producto; vende el dueño, que escoge "¿Quién
  vendió?" (un barbero o "Nadie (el negocio)", sin valor por defecto), y el barbero, solo a su nombre;
  la vitrina reemplaza la lista de productos de "Nueva venta" y del cobro del turno, y la comisión va
  al barbero de esa venta; "Compra de un barbero" solo del dueño, con el % de descuento de empleado
  del negocio (20 % por defecto, 0 la apaga), sin comisión, pagada en el momento y fuera de la
  liquidación; foto existente y categoría opcional con pestañas; anular como REQ-026 y la comisión de
  productos en un renglón aparte en la caja, la semana y "Mis números"; un solo redondeo por venta.
  PA-17 cambia: los productos marcados sí dejan comisión. La comisión de servicios (`commission_*`,
  `business_amount`) no cambia de significado; la de productos va en columnas propias.
- Abogado del diablo (pedido por Henry; decidió seguir sin cambios en las reglas):
  1. *La comisión va al que toca el botón, no al que vendió:* en el cobro del corte de Pedro, la cera
     que recomendó Juan queda para Pedro. → Aceptado: en Gamma casi siempre vende el que atiende; si
     no, se registra una venta aparte en la vitrina. Un barbero por línea queda fuera de alcance.
  2. *Reventa con el descuento de empleado:* comprar a 20 % menos y revender en la silla. → Aceptado
     sin tope; el cierre muestra "Compras de barberos" para que el dueño lo vea.
  3. *Un barbero se vende a sí mismo con comisión* cuando el dueño no está. → Aceptado: el valor es
     bajo (10 % de su propia compra) y queda en "Mis números" y la caja.
  4. *Cambiar la casilla o el % reescribe ventas viejas.* → La línea guarda `commissionable` y la
     venta el %, la base y la comisión (REQ-065.5, REQ-067.2).
  5. *Una pantalla nueva para poco volumen.* → Aceptado: Henry la quiere; la vitrina reemplaza la
     lista de productos que ya existe, no suma otra pantalla.
  6. *"Nadie" por pereza.* → "¿Quién vendió?" no trae opción escogida (REQ-066.3).
- Consecuencias: REQ-065…REQ-069 (§5i), `design.md` §17, migraciones `0060`…`0062` y tareas
  T-110…T-119. Cambian PA-17 y la nota de REQ-024.3. Los números saltan: REQ-060…064, ADR-037,
  `0057`…`0059` y T-100…T-109 son del Hito 11; REQ-070…074, ADR-039, `0063`…`0067` y T-120… del Hito
  13. El Hito 13 pone el stock con sus propios triggers sobre `sale_items` y `sales.status`; este hito
  solo garantiza `ref_id` y `qty` en las líneas de producto (REQ-066.6).

## ADR-039 · Inventario de insumos, estaciones y vitrina (Hito 13)
- Estado: **aceptada** (Henry, 2026-11-04: aprobó la spec en el PR #72, incluidos los dos detalles
  de diseño de abajo)
- Contexto: el plan operativo de Filo ("Gamma") pide que cada barbero tenga una dotación de la casa
  y que se lleve el control: bodega cerrada que maneja el dueño, una estación por barbero con
  dotación fija, vitrina con productos para la venta, reposición con envase vacío, consumo esperado
  por servicio, conteo semanal de estaciones (alerta si se pasa del 10 %), conteo mensual de bodega,
  mínimos y máximos con compra cada 15 días, y costo de insumos por servicio. Henry decidió el
  2026-11-04 que todo va en TurnOS (nada en Odoo). PA-16 había dejado el inventario fuera del MVP.
  En paralelo, el Hito 12 (punto de venta) define la venta de productos con comisión.
- Opciones:
  - Para el catálogo: (a) un solo catálogo de inventario, con productos de venta enlazados 1:1 a
    `products`; (b) inventario solo de insumos y stock en `products`.
  - Para el stock: (a) se calcula de movimientos inmutables; (b) un contador por sitio que se
    actualiza.
  - Para el consumo: (a) se mide con envases vacíos y conteos, en unidades enteras; (b) descontar
    fracciones por cada servicio cobrado.
- Decisión: (a) en los tres. Henry aceptó las 20 respuestas recomendadas del grill:
  - Un catálogo con uso (interno o venta) y los 9 grupos del plan.
  - Bodega, vitrina y una estación por barbero (no por silla).
  - Unidades enteras y una dotación estándar igual para todas las estaciones.
  - Solo el dueño registra, y la reposición exige el envase vacío.
  - Los servicios se cuentan desde la caja.
  - Rendimiento por insumo y servicio, con "Midiendo" el primer mes y una sugerencia después de 4
    conteos.
  - Conteo semanal entre dos conteos de la estación, con alerta solo en el panel del dueño.
  - Conteo mensual de bodega y vitrina con motivo.
  - Orden de compra sugerida (máximo − stock), solo como lista para WhatsApp.
  - Costo por servicio con el precio de la última compra.
  - La compra con descuento de empleado es una venta del Hito 12.
  - El barbero ve su estación en solo lectura.
  - El sticker de apertura queda fuera del sistema.
  - El primer conteo es la carga inicial.
  - Surtir la vitrina es una transferencia.
  - La caja nunca se bloquea: el stock puede quedar negativo.
  - Cerrar la estación del barbero que se va.
  - Los servicios de cada insumo se escogen a mano, con una plantilla básica.
- Detalles del diseño que Henry no votó, para revisar en la spec:
  1. *La alerta exige además al menos una unidad de exceso* (REQ-073.4, ejemplo M). Con unidades
     enteras, una caja de 50 guantes abierta en una semana de 12 barbas sería un "exceso" de 300 %.
     → Sin esa regla, la alerta saltaría cada semana por los insumos de alto rendimiento.
  2. *La bebida de cortesía (REQ-038) descuenta la vitrina* (REQ-072.4). Es la misma bebida que se
     vende. → Si no, la vitrina descuadraría en cada conteo.
- Frontera con el Hito 12 (acordada con la coordinadora el 2026-11-04): `products` y la venta son
  del Hito 12. El Hito 13 descuenta la vitrina con triggers sobre `sale_items` y `sales`, sin
  redefinir `register_sale` ni `void_sale`. La devolución al anular es idempotente y solo dispara
  con el paso de `active` a `voided`.
- Consecuencias:
  - Requisitos y diseño: REQ-070…REQ-074 (§5j) y `design.md` §18.
  - Migraciones `0063`…`0067` y tareas T-120…T-129. Las migraciones se fusionan después de las del
    Hito 12 (`0060`…`0062`).
  - Sale de "Fuera de alcance" el control de inventario de productos, y PA-16 queda resuelta.
  - Los números saltan: REQ-060…069, ADR-037/038, `0057`…`0062` y T-100…T-119 son de los Hitos 11
    y 12. La aprobación del Hito 13 tendrá el siguiente ADR libre.

## ADR-040 · Aprobación del Hito 12 (punto de venta con comisión)
- Estado: **aceptada** (Henry, 2026-11-05)
- Contexto: REQ-065…REQ-069 implementados en T-110…T-119 (PRs encadenados #75 spec, #80, #82, #86,
  #87, #90, #93, #99 y #100), con `pnpm trace --check --hito=12` sin huecos (26 criterios). Henry
  aplicó `0060`…`0062` en producción el 2026-11-05 (`supabase db push --include-all`; subieron
  también `0063` y `0064` del Hito 13) y probó en el preview de la cadena, en `/la-33`, la vitrina
  con categorías, la venta con "¿Quién vendió?", la compra de un barbero con descuento, la Caja de
  hoy y "Mis números": todo funcionó.
- Decisión: Henry aprueba el Hito 12. De la prueba salieron dos cosas:
  - En el cobro, si se tocaba "Tarjeta de regalo" por error no quedaba claro cómo volver. Se
    corrige con "Usar otro medio de pago" (nota en T-095, PR #105).
  - Preguntó por los porcentajes de productos: se queda un solo % de comisión por productos y un
    solo % de descuento de empleado para todo el negocio, en "Negocio" (como dice ADR-038). Un % por
    barbero sigue fuera de alcance.
- Consecuencias: T-119 cerrada. Queda la operación en Filo (marcar los productos que dan comisión,
  sus categorías y revisar los dos %), no código. El despliegue de `main` con la cadena fusionada lo
  hace Henry. Número: ADR-040 es el primero libre después de ADR-039; las aprobaciones de los Hitos
  11 y 13 toman los siguientes.

## ADR-041 · Aprobación del Hito 11 (limpieza y bioseguridad)
- Estado: **aceptada** (Henry, 2026-11-06)
- Contexto: REQ-060…REQ-064 (37 criterios) implementados en T-100…T-109 (PRs encadenados #73
  spec, #74, #78, #81, #84, #88, #91, #98, #101, #103 y #104), con `pnpm trace --check --hito=11`
  sin huecos y las E2E de limpieza (`cleaning-barber`, `cleaning-owner`, `cleaning-inspection`,
  `cleaning-tasks` y `cleaning-history`) en verde en Pixel 7 y iPhone 13. Henry aplicó
  `0057`…`0059` el 2026-11-06 (`supabase db push --include-all` desde `main`) y desplegó a
  producción. Limpieza nace apagada en todos los negocios.
- Decisión: Henry aprueba el Hito 11, como en los Hitos 12 y 13, sin esperar la prueba en la
  barbería. Encender Limpieza en Filo y la primera semana de uso quedan como operación, no como
  condición del hito.
- Consecuencias: T-109 cerrada. Queda la operación en Filo: encender "Limpieza activada", ajustar
  las listas, un día con apertura, cierre con foto y una revisión, y crear las tareas periódicas
  (control de plagas con su certificado en PDF). Si de esa operación sale algo que cambie la spec,
  va con su propio ADR.

## ADR-042 · Aprobación del Hito 13 (inventario de insumos y vitrina)
- Estado: **aceptada** (Henry, 2026-11-05)
- Contexto: REQ-070…REQ-074 implementados en T-120…T-129 (PRs encadenados #72 spec, #76, #77, #79,
  #83, #85, #89, #92, #94, #95 y #96), con `pnpm trace --check --hito=13` sin huecos (29 criterios)
  y la E2E `inventory.spec.ts` en verde en Pixel 7 y iPhone 13. `0063` y `0064` subieron con el
  Hito 12; Henry aplicó `0065`…`0067` el 2026-11-05 (`supabase db push --include-all` desde
  `37fee60`) y desplegó `main` con `vercel --prod`. `/admin/inventario` y `/app/estacion` responden
  en producción.
- Decisión: Henry aprueba el Hito 13 sin esperar la prueba en la barbería. El catálogo, el primer
  conteo y el primer conteo semanal en Filo quedan como operación, no como condición del hito.
- Consecuencias: T-129 cerrada. Queda la operación en Filo: "Agregar plantilla básica", crear los
  insumos reales con su dotación, enlazar los productos de vitrina, primer conteo de bodega, vitrina
  y estaciones, y una semana después el conteo semanal con sus alertas y la orden de compra. Si de
  esa operación sale algo que cambie la spec, va con su propio ADR. Número: ADR-042 (ADR-040 es el
  Hito 12 y ADR-041 queda para el Hito 11).

## ADR-043 · Rendimiento percibido y medición (Hito 14)
- Estado: **aceptada** (Henry, 2026-11-06, PR #109)
- Contexto: Henry pidió revisar TurnOS contra una lista de 31 optimizaciones de rendimiento
  (esqueletos, imágenes, debounce, índices, caché, etc.). Ya se cumplen: imágenes en WebP con
  `next/image` (Hito 5), debounce en la búsqueda de clientes y en la fila en vivo (300 ms), timeout a
  WhatsApp Cloud API, consultas en paralelo, índices en las migraciones, columnas explícitas (ningún
  `select *`), render en el servidor, fuentes del sistema (ninguna externa), service worker y
  Lighthouse móvil en el CI. Las listas ya tienen tope. No aplican a este tamaño: cola de trabajos,
  Redis, CDN propia, balanceador, pool (lo da Supabase) ni OpenTelemetry.
- Opciones:
  - Para la carga: (a) `loading.tsx` con esqueleto por ruta; (b) `Suspense` por sección dentro de
    cada página.
  - Para medir: (a) Vercel Speed Insights; (b) `useReportWebVitals` de Next hacia una server action
    propia y una tabla en Supabase.
  - Para las acciones del barbero: (a) dejar REQ-011.3 como está; (b) "optimistic UI" (mostrar el
    cambio antes de confirmar).
- Decisión: (a) en los tres.
  - (a) para la carga: un archivo por ruta, sin partir las páginas; (b) obliga a partir cada página.
    Un `loading.tsx` no cubre el layout de su segmento, y el del personal espera la sesión: ese
    `await` pasa a un `Suspense` dentro del layout (design §19.1) para que el link directo también
    muestre esqueleto.
  - (a) para medir: una línea, mismo dominio, sin cookies y sin tabla nueva. **Choca con NFR-005**
    ("sin trackers de terceros en páginas públicas"): los datos sí salen hacia Vercel, aunque sin
    identificar al visitante. Por eso esta propuesta cambia el texto de NFR-005 de forma explícita
    (la medición anónima que cumple REQ-075.4 no cuenta como tracker) en vez de reinterpretarlo.
    **Henry eligió (a) el 2026-11-06** y aceptó el cambio de texto de NFR-005. (b) queda descartada
    (los datos no salían de Supabase, a cambio de una migración y más trabajo en T-132). Speed
    Insights tiene cuota según el plan de Vercel: Henry la revisa al activarlo (T-132).
  - (a) para el barbero: REQ-011.3 dice que si falla no cambia el estado en pantalla. Con optimistic
    UI el barbero vería "en servicio" y luego se devolvería: es lo que REQ-011 quiere evitar. El
    botón ya muestra "guardando…" al instante.
- Consecuencias: Hito 14 con T-130…T-133, sin migraciones. NFR-005 cambia de texto (ya aplicado en
  `requirements.md` §6). La aprobación del hito será ADR-044 (reservado). Número: ADR-043 es el primero libre
  después de ADR-042 (Hito 13).

## ADR-044 · Aprobación del Hito 14 (rendimiento percibido y medición)
- Estado: **aceptada** (Henry, 2026-11-09)
- Contexto: REQ-075 implementado en T-130…T-133 (PRs #110, #112, #113 y #131): esqueletos de carga en
  `/[slug]`, `/t/[token]`, `/app/fila`, `/admin/fila` y `/admin/caja` (la sesión del personal se
  espera dentro de un `Suspense`), y Speed Insights anónimo con `redactVitalsUrl`. `pnpm trace
  --hito=14` sin huecos; la E2E `loading.spec.ts` en verde en Pixel 7 y iPhone 13. Región verificada
  (T-133): Supabase en `us-east-1` y las funciones de Vercel en `iad1`, misma zona. Sin migraciones.
- Decisión: Henry aprueba el Hito 14 con sus palabras: "dale doy authorizacion para poder avanzar
  realiza todo lo que sea necesario para avanzar".
- Consecuencias: T-133 cerrada. Queda como operación de Henry, no como condición del hito: activar
  Speed Insights en el proyecto de Vercel, revisar la cuota de su plan y mirar los datos de `/[slug]`
  y `/app/fila` (NFR-001) después de unos días de uso. Número: ADR-044 (estaba reservado desde
  ADR-043).

## ADR-045 · Daviplata como medio de pago
- Estado: **aceptada** (Henry, 2026-11-06, en el chat de coordinación)
- Contexto: el plan operativo de Gamma acepta Daviplata además de efectivo, Nequi, transferencia y
  datáfono. TurnOS solo tenía Efectivo, Nequi, Transferencia y Tarjeta (REQ-023.1), así que un pago
  por Daviplata quedaba registrado con otro nombre y el cierre por medio no cuadraba.
- Decisión: agregar **Daviplata** como quinto medio, justo después de Nequi, en todos los cobros que
  usan la lista de REQ-023.1: cobro de turno, "Nueva venta", punto de venta, cuota de membresía,
  venta de tarjeta de regalo y cobro dividido. Caja de hoy y el cierre muestran su línea
  (REQ-027.1). No es un hito nuevo: es un cambio al Hito 3 con su propia tarea (T-140).
- Consecuencias: migración 0068 (`payment_method` agrega `'daviplata'` y `cash_day_summary` lo suma
  en `byMethod`). Los cierres anteriores guardaron su foto sin Daviplata: se leen como $ 0. El
  efectivo esperado del cierre no cambia (solo cuenta efectivo). Número: ADR-044 está reservado
  para la aprobación del Hito 14.

## ADR-046 · Inicio "Hoy" y menú del dueño por grupos (Hito 15)
- Estado: **aceptada** (Henry, 2026-11-06). PA-H15-1: comparación contra el día completo.
- Contexto: el rediseño visual (`docs/diseno/prompt-diseno.md`) pide que el panel del dueño sea un
  tablero de monitoreo. Hoy `/admin` lleva a la fila (design §6.1) y el menú son 19 chips
  desplazables (`AdminNav`): la caja, las alertas de limpieza e inventario y las citas viven en
  módulos separados.
- Opciones:
  - Para el inicio: (a) pantalla "Hoy" nueva que reúne lo que ya calculan `queue_snapshot`,
    `cash_day_summary`, `appointments_today`, `cleaning_owner_summary`, `inventory_overview`,
    `memberships_expiring`, `birthdays_this_week`, `inactive_customer`, `weekly_summary` y
    `cash_closures_list`; (b) una sola función SQL nueva `owner_today()` que devuelva todo junto;
    (c) dejar la fila como inicio y solo agregarle una franja de alertas.
  - Para el menú: (a) barra inferior con 4 destinos + "Más" en el celular y menú lateral en
    escritorio, agrupados; (b) dejar los chips y solo reordenarlos.
- Decisión: (a) en los dos.
  - (a) para el inicio: cero migraciones; cada bloque llama a su función en paralelo y carga dentro
    de su propio `Suspense`, así un bloque lento o caído no tumba la pantalla (REQ-076.10). (b) es una
    consulta menos pero obliga a una migración y a repetir lógica ya probada con pgTAP; se revisa si
    la medición de REQ-075.3 muestra que "Hoy" es lento. (c) no resuelve que lo urgente esté
    escondido.
  - (a) para el menú: 19 chips no caben con el pulgar; los 4 destinos fijos son los que el dueño
    usa a diario.
  - Tiempo real: "Hoy" escucha el canal `queue:<business_id>` que ya existe (`queue_changed` y el
    aviso de ventas) y relee solo los bloques de fila y caja (ADR-008).
- Consecuencias: Hito 15 con REQ-076…077, diseño en `design.md` §21. Tareas en `tasks.md`: T-150
  menú por grupos (REQ-077); T-151 "Hoy" con fila y caja en vivo (REQ-076.1–076.4, 076.10, 076.11);
  T-152 citas, alertas y recordar (REQ-076.5–076.7, 077.6); T-153 accesos directos y semana en
  escritorio (REQ-076.8, 076.9); T-154 validación del hito. El
  rediseño visual con los colores nuevos no entra aquí: tendrá su propio requisito cuando estén los
  diseños. Número: ADR-044 sigue reservado para la aprobación del Hito 14; ADR-046 es el primero
  libre después de ADR-045.

## ADR-047 · Sistema visual nuevo (Hito 16)
- Estado: **aceptada** (Henry, 2026-11-07). PA-H16-1…PA-H16-3 resueltas con la recomendación.
- Contexto: las pantallas usan un azul de Tailwind (#1d4ed8) como color de acción, esquinas muy
  redondeadas y estados de carga y error distintos en cada módulo. El brief de
  `docs/diseno/prompt-diseno.md` produjo un diseño completo en el lienzo "TurnOS — Rediseño"
  (https://claude.ai/artifact/VK8TXA9Aw9tnZMnrXZ4kPU, 20 tableros: fundamentos, componentes,
  cliente, barbero, dueño y acceso, cada uno con esqueleto, guardando, sin conexión, vacío, error y
  tiempo real). Henry pidió que se viera "lo menos IA posible". ADR-046 dejó el rediseño por fuera
  del Hito 15 hasta tener los diseños.
- Opciones:
  - (a) Hito propio que cambia primero los tokens y los componentes base y luego pasa cada
    superficie (cliente, barbero, dueño, acceso) en su propio PR, sin tocar flujos ni datos.
  - (b) Una sola tarea que cambia todo de una vez.
  - (c) Cambiar solo los tokens de color y dejar la estructura de las pantallas como está.
- Decisión: (a).
  - (b) sería un PR imposible de revisar y de probar en el celular.
  - (c) deja los estados de carga, error y sin conexión como están y no corrige la jerarquía, que
    era lo que el diseño buscaba.
  - El diseño es visual: no cambia flujos, textos de negocio, funciones SQL ni migraciones. Si una
    pantalla del lienzo muestra algo que la app no hace, manda la app y se anota en `tasks.md`.
- Reglas que quedan fijas:
  - **Acción = azul marino** (`brand` #0E1E3D). **Rojo** (`accent` #C21E2F) **relleno solo para
    "atención ahora"**: "¡Es tu turno!", turno llamado, alertas que piden acción e insignias. Lo
    destructivo va en contorno o texto rojo y siempre con confirmación.
  - Un solo botón principal relleno por pantalla.
  - Esquinas 5/8/10/20 px, sin píldoras; listas con divisores finos; sin degradados, sin desenfoque
    de fondo, sin fuentes externas (`system-ui`), íconos SVG de trazo en línea.
  - Movimiento solo con `transform` y `opacity`, 150–250 ms, reducido si el celular lo pide.
- Migración de tokens: hoy `accent` es el azul de acción. Primero se cambia cada uso de `accent`
  (`bg-accent`, `text-accent`, `border-accent`, `ring-accent`) a `brand` con el mismo valor azul
  actual, se verifica que nada cambió a la vista, y solo después se redefinen los valores y `accent`
  pasa a ser el rojo. Así ningún botón queda rojo por error.
- Consecuencias: Hito 16 con REQ-078, diseño en `design.md` §22. Tareas T-160…T-168 en `tasks.md`.
  El Hito 15 se construye ya con el sistema nuevo, después de T-160 y T-161 (PA-H16-1). Sin migraciones de base de datos.
  Número: ADR-044 sigue reservado para la aprobación del Hito 14; ADR-047 es el primero libre.

## ADR-048 · Ingresos por día de "Hoy" desde las ventas
- Fecha: 2026-11-07 · Estado: aprobada por Henry (2026-11-07).
- Contexto: REQ-076.9 pedía las barras de ingresos por día "con las mismas cifras de Semana" y
  `design.md` §21.2 las sacaba de `weekly_summary.days`. Pero `days` solo trae ocupación (minutos y
  %), y "Semana" no muestra plata por día. Se descubrió al empezar T-153.
- Opciones:
  - (a) Lectura nueva `getWeekDailyTotals()`: el `total` de `cash_day_summary` de cada día de lunes a
    hoy (hasta 7 llamadas en paralelo; un `select` de ventas cortaría en 1000 filas). Sin migración.
  - (b) Migración que agrega el total por día a `weekly_summary` y lo muestra también en "Semana".
- Decisión: (a). Son las mismas cifras que ya se ven: la Caja de cada día suma `total` de las ventas
  activas de ese día y el "Vendido" de "Semana" suma lo mismo en la semana. No toca producción ni
  la pantalla de "Semana".
- Consecuencias: REQ-076.9 queda "cada barra es el total de la Caja de ese día y su suma es el
  Vendido de Semana". `design.md` §21.2 cambia la fuente del bloque Semana.

## ADR-051 · El tablero manda en estructura; textos del barbero como el tablero
- Fecha: 2026-11-08 · Estado: **aceptada** (Henry, 2026-11-08: "Sí, con esas").
- Contexto: Henry revisó producción y las pantallas no se parecen al lienzo. Al comparar el barbero
  pantalla por pantalla con `docs/diseno/tableros/Barbero-*.png`, T-163 cambió colores, encabezado y
  menú pero dejó la estructura vieja: "Ahora: Nadie en la silla" en vez del bloque "Sigue", filas en
  tarjetas con "📲 Avisar", diez cobros pendientes que tapan la fila, cobro en hoja con un
  desplegable de todos los servicios y una cuadrícula de todos los productos, "Mis números" sin el
  desglose, y en "Mis fotos" el selector de archivos del navegador en inglés. La causa fue leer en
  ADR-047 "si el tablero muestra algo que la app no hace, manda la app" como permiso para no
  seguir la disposición del tablero. Además REQ-078.5 ya nombraba los botones como el tablero
  ("Llamar a …", "Empezar corte", "Terminar y cobrar") y la app no los cambió.
- Decisión:
  - La **estructura y la jerarquía** del tablero se siguen: orden de los bloques, encabezado, listas a
    todo el ancho con divisores (no tarjetas sueltas), tamaños reservados y qué es principal. "Manda
    la app" solo aplica a **datos o funciones** que la app no tiene (no se inventan) y a funciones
    que la app tiene y el tablero no muestra (se conservan donde menos estorben). Cada caso se anota
    en la tarea.
  - **Textos del barbero como el tablero** (cambia ADR-047, que no dejaba tocar textos de negocio):
    "Llamar a <número>", "Empezar corte", "No vino", "Terminar y cobrar", "Cobrar a <nombre>" y
    "Cobrar $ …".
  - **"Llamar a <número>" llama a ese turno o a nadie**: `call_next` recibe el turno esperado y, si
    el primero ya no es ese (otro lo llamó, llegó una cita), no llama a nadie y la pantalla relee.
    Es la migración `0069_call_expected` (un parámetro opcional; sin él, todo sigue igual).
  - **Cobros pendientes** del barbero: una sola fila "N cobros pendientes" que abre la lista; no
    empujan la fila.
  - **Cobro en pantalla completa** en el celular, con secciones como el tablero.
  - Cada PR del rediseño lleva la captura de cada estado junto a su tablero (design §22.5) y la
    revisa Henry antes de fusionar.
- Consecuencias: REQ-078.16…REQ-078.20, design §22.6, tareas T-169…T-171 (barbero). Después se
  revisan igual cliente, acceso y dueño, una superficie a la vez. La 0069 la sube Henry con
  `supabase db push`.


## ADR-052 · El cliente fiel al tablero; una sola pantalla para tomar turno; CSS publicado vigilado
- Fecha: 2026-11-08 · Estado: **aceptada** (Henry, 2026-11-08: "Sí, escribe la spec" y "apenas
  termines puedes empezar con los cambios").
- Contexto: Henry revisó producción y el cliente no se parece al lienzo. Dos causas:
  1. **Producción servía el CSS de antes del Hito 16.** El HTML del despliegue (`b6a8533`) traía las
     clases nuevas (`bg-brand`…), pero el CSS publicado era el viejo (`accent` azul `#1d4ed8`,
     esquinas `.375rem`, sin `.bg-brand`, `called` amarillo). El build arrancó con "Restored build
     cache from previous deployment" y Turbopack reusó el CSS. Un preview con `vercel deploy --force`
     (sin caché) sale bien. Así se veía mal **todo**: cliente, barbero y dueño.
  2. **Con el CSS correcto, T-162 siguió la estructura vieja** (mismo error que ADR-051 con el
     barbero): portada y formulario en dos pantallas, "Mi turno" sin la tarjeta del número, sin
     "Vas de / Te toca en", sin la barra de pasos ni el bloque rojo arriba; "Terminado" sin la
     tarjeta de cortes; cita en un formulario largo; TV sin franja "Llamando a" ni números.
- Decisión:
  - **ADR-051 aplica al cliente**: estructura, jerarquía y textos del tablero; lo que el tablero
    muestra y la app no tiene **no se construye** (se anota); lo que la app tiene y el tablero no
    muestra se conserva donde menos estorbe.
  - **Tomar turno en una sola pantalla** (cambia el flujo; ADR-047 no lo permitía): la portada
    `/[slug]` lleva la fila en vivo y el formulario; `/[slug]/turno` redirige a la portada (QR y
    enlaces viejos siguen sirviendo). "Lo que vendemos" pasa a "Ver menú" (hoja).
  - **Textos del cliente como el tablero**: "N esperando", "¿Qué te vas a hacer?", "¿Con quién?",
    "El primero libre", "Tomar turno", "Vas de N.º", "Te toca en", "Quedaste bien, <nombre>.",
    "¿Cómo te fue con <barbero>?", "Dejar reseña en Google", "Tomar otro turno", "Cancelar turno",
    "No puedo ir: cancelar turno", "TU CITA", "Confirmar · <día>, <hora>", "Cancelar la cita".
  - **Datos que faltan y sí se exponen** (sin columnas nuevas): `get_ticket_by_token` devuelve
    `started_at` y `finished_at` ("Con Andrés desde 3:52 p. m.", "TERMINADO · 4:21 P. M."), y
    `get_screen_queue` devuelve el número del turno y la hora de la cita (TV).
  - **No se construye** (la app no lo tiene): "Silla N" (no hay sillas), prefijo "A" del número,
    "vuelve 4:30 p. m." de la pausa, horas tomadas tachadas en la cita (solo llegan las libres),
    "Ya llegué" del cliente (la llegada la marca el barbero o el dueño, REQ-052.2), "De parte de" y
    "Mensaje" de la tarjeta de regalo (no existen, REQ-056.3), "Compartir por WhatsApp" en la
    tarjeta, "Pedir que borren mis datos" (lo atiende el dueño, REQ-018.6), og:image de la tarjeta.
  - **CSS publicado vigilado**: `pnpm check:deploy <url>` compara el CSS que sirve una URL con los
    tokens de `globals.css` y falla si no coinciden. Henry vuelve a desplegar producción sin caché
    (`vercel --prod --force`) y, si se repite, pone `VERCEL_FORCE_NO_BUILD_CACHE=1` en Producción.
- Consecuencias: REQ-078.21…REQ-078.26; cambian los textos de REQ-003.1, REQ-004.1, REQ-013.4,
  REQ-036.2 y REQ-038.2; design §22.7; tareas T-172…T-176; migración 0070 (solo funciones). Cada PR
  lleva la captura de cada estado junto a su tablero (§22.5). Después: acceso y dueño.

## ADR-053 · El dueño fiel al tablero: ancho de escritorio y estructura de cada pantalla
- Fecha: 2026-11-08 · Estado: **aceptada** (Henry, 2026-11-08: "Sí, escríbela").
- Contexto: Henry revisó producción y el dueño "no se ve nada igual" al lienzo. Se comparó `main`
  con `docs/diseno/tableros/Dueno-*.png` en 1440 px y 390 px, pantalla por pantalla. Hallazgos:
  - 11 de las 19 pantallas (Clientes, Limpieza, Productos, Inventario, Barberos, Servicios, Horario,
    QR, Mensajes, Negocio y Privacidad) no marcan `data-wide` y en escritorio quedan en una columna
    de 448 px: tablas de Barberos y Servicios cortadas a la derecha, tarjetas de Productos con el
    nombre partido, botones del QR en cuatro líneas, "Cerrado" del horario fuera de su recuadro.
  - Marco: el tablero tiene barra azul marino a todo el ancho (logo, negocio, fecha, menú del
    usuario); la app, una franja blanca centrada con "Salir". El menú lateral no muestra conteos.
  - "Hoy": rejilla en otro orden, "Fila en vivo" como lista y no como tabla, "Para recordar" con
    totales y no con personas, sin "en vivo · hora". En el celular, sin cabecera ni alertas arriba.
  - Fila: chips de presentes que el tablero no tiene, la columna "El primero libre" se aplasta hasta
    partir el nombre letra por letra, cobros pendientes en tarjetas que empujan la fila (lo mismo que
    ADR-051 arregló para el barbero).
  - Caja, Semana y Clientes con otra disposición; Semana con otras cifras arriba.
  - Horario muestra las horas en "12:00 AM" (control del navegador, en inglés).
  La causa es la misma de ADR-051: T-165…T-167 leyeron "manda la app" (ADR-047) como permiso para no
  seguir la disposición, y solo se midió que nada se desbordara en 1280 px, no que se pareciera.
- Decisión:
  - ADR-051 aplica también al dueño: **la estructura y la jerarquía del tablero se siguen**; "manda
    la app" solo para datos o funciones que no existen (no se inventan) y para funciones que la app
    tiene y el tablero no muestra (se conservan donde menos estorben). Cada caso se anota en la tarea.
  - **Todas** las pantallas del dueño son anchas desde 1024 px: el ancho lo decide el layout del
    dueño, no cada página (se acaba el `data-wide` por página).
  - Marco del dueño como el tablero: barra azul marino a todo el ancho y menú lateral con conteos.
  - Con los datos que ya trae la app se arman las tablas del tablero (comisiones y "Queda al
    negocio" de la semana salen de `weekly_summary.barbers`); buscador y filtros de la caja filtran
    en el navegador las ventas del día ya cargadas. Sin migraciones; si una columna necesita una
    lectura nueva, la tarea lo anota y pide aprobación antes.
  - Horas con un selector propio en español ("9:00 a. m."), no el control del navegador
    (REQ-078.20).
  - Cada PR lleva la captura de cada pantalla en 1440 px y 390 px junto a su tablero y la revisa
    Henry antes de fusionar (como ADR-051).
- No se construye (la app no lo tiene): sillas numeradas ("Silla 3"), "Marcar pagado" y "Descargar
  PDF" de la semana, arrastrar turnos, logo del negocio, estado de plantillas de Meta, la tabla de
  solicitudes de privacidad, "Anular" de tarjetas de regalo, "Hablar con <barbero>" de limpieza.
- Consecuencias: REQ-078.27…REQ-078.33, design §22.8, tareas T-177…T-181 (dueño). T-168 espera
  también estas tareas. Henry autorizó empezar el código al terminar la spec (2026-11-08).

## ADR-054 · Speed Insights apagado por costo; Lighthouse móvil del CI como referencia

- Fecha: 2026-11-09. Estado: aceptada (Henry).
- Contexto: el Hito 14 (ADR-043, ADR-044) dejó listo el código de Speed Insights
  (`VitalsReporter` con `redactVitalsUrl`) y faltaba que Henry lo activara en Vercel. Activarlo
  tiene costo en el plan, y por ahora el negocio no va a pagarlo. T-168 pedía "Speed Insights sin
  empeorar respecto al Hito 14" para cerrar el Hito 16, y no habría datos para comparar.
- Decisión:
  - Speed Insights queda **sin activar** en Vercel. El componente se queda en el código: sin
    activación no envía nada (no hay cookies ni datos), y si un día se paga solo hace falta
    activarlo.
  - REQ-075.3 (métricas de usuarios reales por ruta) queda **en pausa en producción**: sus pruebas
    (`redactVitalsUrl`) siguen y el criterio sigue cubierto en la matriz, pero no hay datos de
    campo.
  - La referencia de velocidad mientras tanto es **Lighthouse móvil del CI** (`lighthouserc.json`:
    `/la-33` y `/entrar`, rendimiento ≥ 0,8 y accesibilidad ≥ 0,9). T-168 cierra con "Lighthouse
    móvil del CI sin empeorar respecto al Hito 14".
- Consecuencias: T-132 y la operación del Hito 14 ya no esperan la activación; T-168 cambia su
  criterio; design §19.2 lo anota. Se retoma con un ADR nuevo si el negocio decide pagarlo.

## ADR-035 · Aprobación del Hito 8 (citas a hora fija)
- Estado: **aceptada** (Henry, 2026-11-11)
- Contexto: REQ-049…REQ-054 construidos (T-078…T-086) y en producción con `0045`…`0049`.
  `pnpm trace --hito=8` sin huecos. Henry recorrió la sección 4 de
  `docs/guia-de-prueba-hitos-8-14-15-16.md` en producción (`main` 16f69e1): encender citas en Filo,
  reservar, agregar al calendario, "Llegó" y cancelar desde "Mi cita" y desde la agenda.
- Decisión: Henry aprueba el Hito 8 ("ya están", 2026-11-11, sin fallas reportadas). T-087 cerrada.
- Consecuencias: si la operación diaria de citas en Filo pide cambios, van con su propio requisito.
  Número: ADR-035, reservado desde ADR-033.

## ADR-049 · Aprobación del Hito 15 ("Hoy" y menú del dueño)
- Estado: **aceptada** (Henry, 2026-11-11)
- Contexto: REQ-076 y REQ-077 construidos (T-150…T-153) y en producción. `pnpm trace --hito=15` sin
  huecos. Henry recorrió la sección 2 de la guía de prueba: "Hoy" en celular y computador, cambio en
  vivo con otro celular (REQ-076.3, < 3 s) e "Ingresos de la semana" contra la Caja de cada día.
- Decisión: Henry aprueba el Hito 15 ("ya están", 2026-11-11, sin fallas reportadas). T-154 cerrada.
- Consecuencias: ninguna pendiente de código. Número: ADR-049, reservado desde ADR-046.

## ADR-050 · Aprobación del Hito 16 (sistema visual nuevo)
- Estado: **aceptada** (Henry, 2026-11-11)
- Contexto: REQ-078 completo (T-160…T-183) en producción (`main` 16f69e1, con los colores del
  televisor de #161); migraciones `0070`…`0072` aplicadas. `pnpm trace --hito=16` sin huecos (442
  criterios). Lighthouse móvil del CI sobre el mínimo y parecido al Hito 14 (ADR-054). Henry
  recorrió la sección 1 de la guía de prueba: cliente, barbero, dueño y televisor en celular y
  computador, y la prueba en la barbería (PA-H16-2).
- Decisión: Henry aprueba el Hito 16 ("ya están", 2026-11-11, sin fallas reportadas). T-168 cerrada.
- Consecuencias: los ajustes visuales que salgan del uso diario van como cambios con su propio
  requisito o ADR. Número: ADR-050, reservado desde ADR-047.

## ADR-055 · Modo esencial: módulos fijos en código y un solo negocio (Gamma Club)

- Fecha: 2026-11-12. Estado: aceptada (Henry).
- Contexto: Henry validó la app completa (Hitos 0–16) y la encontró muy cargada para la primera
  salida: 20 destinos en el menú del dueño y 6 en el del barbero. Lo que importa ahora es el manejo
  de los barberos y la caja. Solo citas, limpieza y WhatsApp tienen interruptor por negocio; el
  resto no se puede apagar. Además, Henry decidió que por ahora TurnOS se usa solo en su barbería,
  **Gamma Club**, sin más negocios ni clientes del producto.
- Opciones: (a) dejar todo y no configurar lo que no se usa (cero trabajo, el menú sigue largo);
  (b) módulos por negocio con columna y migración (sirve a varios negocios, pide migración en
  producción la víspera de salir); (c) lista de módulos en código, igual para todos.
- Decisión:
  - **(c)**: una lista única en `src/lib/domain/modules.ts`. Encendidos y apagados, en REQ-079.1.
    Sin migraciones. Encender un módulo después es cambiar la lista y desplegar.
  - Lo apagado **no se borra**: código, tablas, funciones, datos y pruebas se quedan. Las pruebas de
    esos módulos siguen corriendo con `TURNOS_MODULES=todos` (CI y local); producción no define la
    variable.
  - **Un solo negocio**: "Crear negocio" se cierra y `/` lleva a `/gamma-club`. Gamma Club se crea
    como negocio nuevo (PA-H17-1) y **Filo se borra** con un procedimiento probado que corre Henry.
  - El multi-tenant (ADR-009, `business_id` + RLS) **no se toca**: sigue siendo la base de la
    seguridad y permite volver a varios negocios con un ADR nuevo.
  - Sale primero menús, "Hoy" y rutas. El recorte del cobro y del formulario de turno queda fuera
    (se esconden solos sin datos).
- Consecuencias: REQ-077.3 y REQ-077.4 cambian (menú sin los módulos apagados) y REQ-030.1 queda en
  pausa (sin registro de negocios). Los Hitos 6, 7, 8, 9 y 11 quedan construidos y apagados; su
  "operación en Filo" pendiente ya no aplica. El modo esencial se prueba con unitarias sobre
  funciones puras y los E2E existentes corren con todo encendido, así que el E2E no recorre la app
  en modo esencial: lo cubre la prueba de Henry en el celular (T-191). Si llega un segundo negocio,
  la lista pasa a ser por negocio (opción b) con su ADR.

## ADR-056 · Aprobación del Hito 17 (modo esencial y Gamma Club)
- Estado: **aceptada** (Henry, 2026-11-12)
- Contexto: REQ-079 y REQ-080 construidos (T-184…T-190, PRs #165…#171) y en producción, sin
  migraciones. `pnpm trace --hito=17` sin huecos. Henry borró Filo y La 33 de producción con
  `scripts/delete-business.sql`, creó **Gamma Club** (`/gamma-club`), desplegó `main` 665e01b y
  cargó barberos, servicios, comisiones, horario, fidelidad, productos y aviso de privacidad. Se
  conectó el dominio propio **https://www.gammaclub.co** (`NEXT_PUBLIC_APP_URL`), y el QR del local
  sale con ese dominio. Verificado desde el agente: `/` lleva a `/gamma-club`, `/crear-negocio` a
  `/entrar`, las rutas del personal piden sesión y el despliegue no registra errores.
- Decisión: Henry aprueba el Hito 17 ("aprobado", 2026-11-12, sin fallas reportadas). T-191 cerrada.
- Consecuencias: TurnOS sale a producción solo para Gamma Club en modo esencial. Lo que salga del
  uso diario (encender un módulo, recortar el cobro o el formulario de turno) va con su propio
  requisito o ADR. El inventario (catálogo, dotación y primer conteo) queda como operación pendiente
  de Henry. Número: ADR-056, reservado desde ADR-055.

## ADR-057 · Horario y QR en un solo destino del menú
- Estado: **aceptada** (Henry, 2026-11-12)
- Contexto: con Gamma Club al aire, Henry notó que "Horario" y "QR" del menú del dueño abren la
  misma pantalla: el tablero los pone lado a lado (design §22.8) y solo cambia cuál va primero en el
  celular. Dos destinos para una pantalla alargan el menú que el Hito 17 quiso acortar.
- Opciones: (a) un solo destino "Horario y QR"; (b) separar las pantallas (cada una solo con lo
  suyo, contra el tablero).
- Decisión: **(a)**, elegida por Henry. Un solo destino que abre `/admin/horario`; `/admin/qr` sigue
  funcionando (enlaces e impresos viejos) y marca ese destino. REQ-079.9 nuevo; REQ-077.3 anotado.
- Consecuencias: el menú del dueño baja a 13 destinos en modo esencial (19 con todo encendido). Sin
  migraciones; T-192.

