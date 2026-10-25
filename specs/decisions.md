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
