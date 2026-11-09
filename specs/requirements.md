# TurnOS — Requisitos del MVP

> Estado: **APROBADA v1.0** (Henry, 2026-10-23). Las preguntas abiertas PA-01 a PA-27 quedaron
> resueltas con el valor por defecto propuesto (ver `decisions.md` ADR-007); los supuestos
> marcados `[PA-nn]` pasan a ser definitivos.
> Fecha: 2026-10-23
> Depende de: `constitution.md`
>
> Convenciones:
> - Cada historia tiene un identificador `REQ-NNN` estable. Nunca se reutiliza un número.
> - Los criterios de aceptación (CA) usan formato **EARS**:
>   `CUANDO <evento>, EL SISTEMA DEBE <respuesta>` / `MIENTRAS <estado>…` / `SI <condición>, ENTONCES…`.
>   Cada CA se numera `REQ-NNN.n` y es la base de al menos una prueba.
> - Prioridad: **M** = imprescindible para el MVP, **D** = deseable (entra si cabe en el hito).
> - Donde el requisito depende de una decisión que no está tomada, se marca `[PA-nn]` y se lista en
>   la sección 9, *Preguntas abiertas*. **Los supuestos marcados así no son definitivos**: están
>   escritos con el valor por defecto que propongo para poder avanzar, y se corrigen con la respuesta.

## Índice

1. Actores y vocabulario
2. Hito 1 — Fila virtual con QR (REQ-001 a REQ-017)
3. Hito 2 — Clientes y fidelidad (REQ-018 a REQ-022)
4. Hito 3 — Caja y comisiones (REQ-023 a REQ-029)
5. Transversales: cuentas, negocio, configuración (REQ-030 a REQ-034)
5b. Hito 4 — Servicios por barbero (REQ-035)
5c. Hito 5 — Experiencia del cliente (REQ-036 a REQ-039)
5d. Hito 6 — Aviso automático por WhatsApp (REQ-040 a REQ-043)
5e. Hito 7 — Membresía familiar (REQ-044 a REQ-048)
5h. Hito 11 — Limpieza y bioseguridad (REQ-060 a REQ-064)
5i. Hito 12 — Punto de venta de productos con comisión (REQ-065 a REQ-069)
5k. Hito 14 — Rendimiento percibido y medición (REQ-075)
6. Requisitos no funcionales (NFR)
7. Casos borde consolidados
8. Fuera de alcance del MVP
9. Preguntas abiertas

---

## 1. Actores y vocabulario

| Término | Definición |
|---|---|
| **Negocio** | Un tenant: la barbería. Tiene nombre, dirección, horario, servicios, barberos, clientes y caja propios. |
| **Dueño** | Usuario con rol administrador del negocio. Ve y configura todo. |
| **Barbero** | Usuario con rol barbero. Atiende turnos en una silla y registra sus servicios. |
| **Cliente** | Persona que toma turno. No tiene cuenta; se identifica con nombre y celular. |
| **Servicio** | Algo que se cobra por atender (corte, barba, corte + barba…). Tiene nombre, duración estimada en minutos y precio en COP. |
| **Producto** | Algo que se vende sin atención (helado, gaseosa). Tiene nombre y precio. |
| **Turno** | Una entrada en la fila: cliente + servicio(s) + barbero preferido (o "el que esté libre") + estado. |
| **Fila** | El conjunto de turnos del negocio que aún no han sido atendidos, ordenados. |
| **Llamar** | Acción del barbero de invitar al siguiente cliente a pasar a la silla. |
| **Venta / cobro** | Registro en caja de un servicio atendido o de productos vendidos, con medio de pago. |
| **Comisión** | Porcentaje del valor de un servicio que corresponde al barbero; el resto queda al negocio. |
| **Cierre de caja** | Resumen inmutable de las ventas de un día por medio de pago y por barbero. |

---

## 2. Hito 1 — Fila virtual con QR

### REQ-001 · Acceso a la fila por QR o enlace — M
**Como** cliente, **quiero** abrir la fila del negocio escaneando un QR en el local o tocando un
enlace que me compartieron por WhatsApp, **para** tomar turno sin instalar nada.

Criterios de aceptación:
- REQ-001.1 CUANDO un cliente abre la URL pública del negocio (`/<slug-del-negocio>`), EL SISTEMA
  DEBE mostrar el nombre del negocio, si está abierto o cerrado, cuántas personas hay en la fila y
  el botón "Tomar turno", sin pedir login.
- REQ-001.2 CUANDO el dueño abre la sección "QR de la fila", EL SISTEMA DEBE mostrar el QR de esa
  URL con un botón para descargarlo como imagen (PNG) lista para imprimir y un botón "Copiar
  enlace".
- REQ-001.3 CUANDO el dueño o barbero toca "Compartir por WhatsApp", EL SISTEMA DEBE abrir un enlace
  `wa.me` con el mensaje prellenado que incluye la URL pública.
- REQ-001.4 SI el negocio está cerrado o la fila está pausada, ENTONCES EL SISTEMA DEBE mostrar un
  mensaje claro ("Hoy abrimos a las 9:00 a. m." o "La fila está cerrada por hoy") y no permitir
  tomar turno.
- REQ-001.5 SI la URL no corresponde a ningún negocio activo, ENTONCES EL SISTEMA DEBE mostrar una
  página de "Negocio no encontrado" sin revelar información de otros negocios.

### REQ-002 · Aviso de privacidad y aceptación (Ley 1581) — M
**Como** negocio, **quiero** que el cliente acepte el aviso de privacidad antes de guardar sus
datos, **para** cumplir la Ley 1581 de 2012.

- REQ-002.1 CUANDO el cliente va a tomar turno por primera vez desde ese navegador, EL SISTEMA DEBE
  mostrar un texto corto de aviso de privacidad con enlace al texto completo y una casilla de
  aceptación **no marcada por defecto**.
- REQ-002.2 SI la casilla no está marcada, ENTONCES EL SISTEMA DEBE impedir enviar el formulario y
  explicar por qué.
- REQ-002.3 CUANDO el cliente acepta, EL SISTEMA DEBE guardar en la ficha del cliente la fecha y
  hora de aceptación y la versión del aviso aceptado.
- REQ-002.4 CUANDO un cliente ya aceptó la versión vigente del aviso (identificado por celular),
  EL SISTEMA DEBE mostrar el recordatorio en una línea ("Ya aceptaste nuestra política de datos")
  sin exigir marcar la casilla de nuevo.
- REQ-002.5 CUANDO el dueño publica una versión nueva del aviso, EL SISTEMA DEBE volver a pedir
  aceptación a todos los clientes en su siguiente turno.

### REQ-003 · Tomar turno — M
**Como** cliente, **quiero** dejar mi nombre, celular, el servicio que quiero y mi barbero
preferido (o "el que esté libre"), **para** entrar en la fila.

- REQ-003.1 CUANDO el cliente toca "Tomar turno", EL SISTEMA DEBE mostrar un formulario con: nombre
  (obligatorio), celular (obligatorio), servicio (obligatorio, lista de servicios activos del
  negocio con duración y precio) y barbero (obligatorio: lista de barberos **disponibles hoy** más
  la opción "El que esté libre", seleccionada por defecto).
- REQ-003.2 CUANDO el cliente escribe un celular, EL SISTEMA DEBE aceptar 10 dígitos que inicien en
  3 (con o sin espacios, con o sin `+57`), normalizarlo a E.164 y rechazar cualquier otro formato
  con un mensaje en español.
- REQ-003.3 CUANDO el cliente envía el formulario válido, EL SISTEMA DEBE crear el turno en estado
  `esperando`, asignarle una posición al final de la fila correspondiente y redirigir a la pantalla
  "Mi turno" (REQ-004) en menos de 2 segundos en red 4G.
- REQ-003.4 CUANDO se crea el turno, EL SISTEMA DEBE crear o actualizar la ficha del cliente de ese
  negocio por celular (nombre más reciente, última visita) — ver REQ-018.
- REQ-003.5 SI ya existe un turno **activo** (`esperando`, `llamado` o `en_servicio`) con el mismo
  celular en ese negocio, ENTONCES EL SISTEMA DEBE no crear uno nuevo y en su lugar abrir la
  pantalla "Mi turno" del turno existente con el aviso "Ya tienes un turno en la fila".
- REQ-003.6 El cliente puede escoger un solo servicio por turno en el MVP `[PA-03]`.
- REQ-003.7 CUANDO el cliente toma turno, EL SISTEMA DEBE recordar en el navegador (localStorage)
  nombre y celular para prellenar la próxima vez; el celular nunca se muestra completo en la URL.

### REQ-004 · Ver mi turno en tiempo real — M
**Como** cliente, **quiero** ver mi posición en la fila y cuánto falta, **para** llegar justo a
tiempo al local.

- REQ-004.1 CUANDO el cliente abre "Mi turno" (URL con token no adivinable, `/t/<token>`), EL
  SISTEMA DEBE mostrar: nombre del negocio, su nombre, servicio, barbero asignado o "El que esté
  libre", **posición** ("Eres el 3.º"), **personas delante**, **tiempo estimado** en minutos y el
  estado del turno.
- REQ-004.2 MIENTRAS el turno esté activo, EL SISTEMA DEBE actualizar posición y tiempo estimado
  sin que el cliente recargue, en menos de 3 segundos desde que cambia la fila.
- REQ-004.3 CUANDO el turno pasa a `llamado`, EL SISTEMA DEBE mostrar de forma destacada "¡Es tu
  turno! Pasa a la silla de <barbero>" y, si el navegador lo permite, vibrar/sonar.
- REQ-004.4 CUANDO el turno pasa a `en_servicio`, `terminado`, `cancelado` o `no_llego`, EL
  SISTEMA DEBE mostrar el estado final correspondiente en español y, en `terminado`, un mensaje
  de agradecimiento.
- REQ-004.5 El tiempo estimado DEBE calcularse con el algoritmo de `design.md` a partir de la
  duración de los servicios de los turnos que están delante y la cantidad de barberos activos, y
  mostrarse redondeado a 5 minutos ("≈ 25 min"); cuando el cliente es el siguiente, mostrar "Eres el
  siguiente".
- REQ-004.6 CUANDO el cliente reabre el enlace después de cerrar el navegador, EL SISTEMA DEBE
  mostrar el estado actual del mismo turno (el estado vive en el servidor, no en el navegador).
- REQ-004.7 SI el token no existe, ENTONCES EL SISTEMA DEBE responder "Este turno no existe o ya
  terminó" sin revelar datos.

### REQ-005 · Cancelar mi turno — M
**Como** cliente, **quiero** cancelar mi turno, **para** no hacer esperar a nadie si no voy a ir.

- REQ-005.1 MIENTRAS el turno esté en `esperando` o `llamado`, EL SISTEMA DEBE mostrar en "Mi
  turno" el botón "Cancelar mi turno" con confirmación.
- REQ-005.2 CUANDO el cliente confirma, EL SISTEMA DEBE pasar el turno a `cancelado` (motivo:
  cliente), recalcular posiciones de los turnos siguientes y notificar en tiempo real a los
  barberos y a la pantalla pública.
- REQ-005.3 CUANDO el turno está `en_servicio` o en un estado final, EL SISTEMA DEBE ocultar el
  botón.

### REQ-006 · Vista de fila del barbero — M
**Como** barbero, **quiero** ver desde mi celular quién sigue, **para** atender en orden.

- REQ-006.1 CUANDO el barbero abre "Mi fila", EL SISTEMA DEBE mostrar: (a) su turno actual (si lo
  hay) y (b) la lista ordenada de turnos que le corresponden: los que lo eligieron a él más los de
  "el que esté libre", intercalados según el orden de llegada global.
- REQ-006.2 Cada turno DEBE mostrar nombre del cliente, servicio, duración, hace cuánto llegó y si
  lo eligió a él o a "cualquiera".
- REQ-006.3 MIENTRAS la vista esté abierta, EL SISTEMA DEBE actualizarla en tiempo real (nuevos
  turnos, cancelaciones, turnos tomados por otro barbero).
- REQ-006.4 EL SISTEMA DEBE mostrar un indicador de estado propio del barbero: `disponible`,
  `en servicio`, `en pausa` (REQ-010).
- REQ-006.5 CUANDO otro barbero llama a un turno de "el que esté libre", EL SISTEMA DEBE retirarlo
  de la lista de los demás barberos en tiempo real.

### REQ-007 · Llamar al siguiente, en servicio, terminado — M
**Como** barbero, **quiero** llamar al siguiente y marcar "en servicio" y "terminado" con un toque,
**para** que la fila avance sola.

- REQ-007.1 CUANDO el barbero toca "Llamar al siguiente" y está `disponible`, EL SISTEMA DEBE pasar
  a `llamado` el primer turno de su lista (REQ-006.1), asignarle ese barbero, registrar la hora de
  llamado y mostrar al barbero el nombre del cliente llamado.
- REQ-007.2 SI dos barberos tocan "Llamar al siguiente" sobre el mismo turno de "el que esté
  libre" al mismo tiempo, ENTONCES EL SISTEMA DEBE asignarlo a uno solo y mostrar al otro el
  siguiente disponible (sin error visible ni turno duplicado).
- REQ-007.3 CUANDO el barbero toca "Ya está en la silla", EL SISTEMA DEBE pasar el turno a
  `en_servicio`, poner al barbero `en servicio` y registrar la hora de inicio.
- REQ-007.4 CUANDO el barbero toca "Terminado", EL SISTEMA DEBE pasar el turno a `terminado`,
  registrar la hora de fin, poner al barbero `disponible` y abrir el registro del cobro (REQ-023;
  en el Hito 1, solo marca terminado).
- REQ-007.5 CUANDO el barbero tiene un turno `llamado` o `en_servicio`, EL SISTEMA DEBE deshabilitar
  "Llamar al siguiente" hasta resolverlo (terminado, no llegó o cancelado).
- REQ-007.6 CUANDO el barbero toca "Llamar al siguiente" y no hay turnos para él, EL SISTEMA DEBE
  mostrar "No hay nadie en la fila".
- REQ-007.7 Todas las transiciones DEBEN registrarse en un historial del turno (quién, cuándo, de
  qué estado a cuál), para auditoría y para el reporte de ocupación.
- REQ-007.8 El barbero puede llamar a un turno específico (no solo el primero) desde la lista, por
  ejemplo cuando el primero avisó que viene tarde `[PA-04]`.

### REQ-008 · Cliente que no llega — M
**Como** barbero, **quiero** marcar que un cliente llamado no apareció, **para** seguir con el
siguiente.

- REQ-008.1 CUANDO un turno lleva en `llamado` más del tiempo de gracia configurado (por defecto
  **5 minutos** `[PA-05]`), EL SISTEMA DEBE resaltar el turno y habilitar el botón "No llegó".
- REQ-008.2 CUANDO el barbero toca "No llegó" (en cualquier momento tras llamar), EL SISTEMA DEBE
  pasar el turno a `no_llego`, liberar al barbero y notificar al cliente en su pantalla "Te
  llamamos y no estabas. Puedes tomar un turno nuevo".
- REQ-008.3 Un turno `no_llego` DEBE quedar en el historial del cliente (para la ficha, REQ-018) y
  **no** cuenta como visita para fidelidad.
- REQ-008.4 CUANDO el cliente marcado como `no_llego` vuelve a tomar turno el mismo día, EL
  SISTEMA DEBE permitirlo y colocarlo al final de la fila (no recupera su puesto) `[PA-05]`.

### REQ-009 · Aviso por WhatsApp cuando faltan 2 turnos — M
**Como** barbero, **quiero** avisarle al cliente con un toque cuando le faltan 2 turnos, **para**
que salga de la casa a tiempo.

- REQ-009.1 CUANDO a un turno le quedan exactamente **2 turnos delante** (según la lista del
  barbero que lo va a atender, o la lista global para "el que esté libre"), EL SISTEMA DEBE
  marcarlo visualmente en la fila del barbero con la etiqueta "Avisar" y mostrar un botón de
  WhatsApp.
- REQ-009.2 CUANDO el barbero toca el botón, EL SISTEMA DEBE abrir `https://wa.me/<celular>?text=`
  con un mensaje prellenado en español que incluya: nombre del cliente, nombre del negocio, que
  faltan ~2 turnos, el tiempo estimado y el enlace a "Mi turno". La plantilla es editable por el
  dueño (REQ-033).
- REQ-009.3 CUANDO el barbero vuelve de WhatsApp, EL SISTEMA DEBE marcar el turno como "avisado"
  (hora y quién) y cambiar la etiqueta a "Avisado ✓" para que nadie lo avise dos veces.
- REQ-009.4 El mismo botón DEBE estar disponible en cualquier turno de la lista (no solo a 2 de
  distancia), con el mensaje adaptado a la posición real.
- REQ-009.5 La implementación DEBE aislar el envío en un único módulo/interfaz
  (`NotificationChannel`) de modo que reemplazar `wa.me` por WhatsApp Cloud API no toque el resto
  del código (preparación, no implementación).

> Hito 6 (ADR-027): con el aviso automático activo, este botón queda como respaldo (REQ-040.7,
> REQ-040.8).

### REQ-010 · Barbero que se ausenta (pausa) — M
**Como** barbero, **quiero** ponerme en pausa (almuerzo, salida), **para** que no me asignen turnos
mientras no estoy.

- REQ-010.1 CUANDO el barbero toca "Pausar" estando `disponible`, EL SISTEMA DEBE ponerlo en
  `en pausa`, excluirlo del cálculo de tiempos y de la asignación de turnos "el que esté libre", y
  mostrar su estado al dueño y en la lista de barberos del formulario del cliente (REQ-003.1 lo
  muestra como "no disponible ahora" o lo oculta `[PA-06]`).
- REQ-010.2 SI el barbero tiene clientes `esperando` que lo eligieron específicamente, ENTONCES EL
  SISTEMA DEBE preguntarle: "Tienes N clientes esperándote. ¿Qué hacemos?" con opciones (a) "Los
  dejo esperando" (siguen asignados a él) y (b) "Que los atienda el que esté libre" (los turnos
  pasan a `barbero_preferido = cualquiera` **conservando su posición** en la fila).
- REQ-010.3 CUANDO un turno cambia de barbero por pausa, EL SISTEMA DEBE mostrar al cliente en "Mi
  turno" el aviso "Tu barbero se ausentó; te atenderá el primero que esté libre" (o el nuevo
  barbero).
- REQ-010.4 CUANDO el barbero toca "Volver", EL SISTEMA DEBE ponerlo `disponible`.
- REQ-010.5 CUANDO el barbero tiene un turno `llamado` o `en_servicio`, EL SISTEMA DEBE impedir la
  pausa hasta resolverlo.
- REQ-010.6 El dueño DEBE poder poner en pausa o reactivar a cualquier barbero (REQ-012).

### REQ-011 · Pérdida de conexión — M
**Como** barbero o cliente, **quiero** que la app no me engañe cuando se cae el internet, **para**
no duplicar acciones ni creer que algo se guardó cuando no.

- REQ-011.1 CUANDO el navegador pierde conexión con el servidor en tiempo real por más de 5
  segundos, EL SISTEMA DEBE mostrar una franja "Sin conexión. Reintentando…" en todas las
  pantallas con datos en vivo.
- REQ-011.2 CUANDO se recupera la conexión, EL SISTEMA DEBE volver a cargar el estado completo
  desde el servidor (no confiar en los eventos perdidos) y quitar la franja.
- REQ-011.3 CUANDO el barbero toca una acción (llamar, en servicio, terminado, no llegó) y la
  petición falla, EL SISTEMA DEBE mantener el botón en estado "guardando…", reintentar hasta 3
  veces con espera creciente y, si sigue fallando, mostrar "No se pudo guardar. Revisa tu
  conexión" sin cambiar el estado en pantalla.
- REQ-011.4 Cada acción de cambio de estado DEBE ser idempotente (enviar dos veces la misma
  transición no genera dos registros ni un estado inválido).
- REQ-011.5 CUANDO el cliente envía "Tomar turno" y la respuesta se pierde, EL SISTEMA DEBE evitar
  el duplicado por la regla REQ-003.5 y, al reintentar, mostrarle su turno existente.
- REQ-011.6 La PWA DEBE poder abrirse (shell) sin conexión y mostrar el último estado conocido con
  su hora ("Actualizado hace 2 min") en lugar de una pantalla en blanco.
- REQ-011.7 CUANDO una pantalla con datos en vivo vuelve a primer plano (se desbloquea el celular,
  se vuelve a la pestaña o el navegador la restaura desde su caché), EL SISTEMA DEBE volver a cargar
  el estado completo desde el servidor una sola vez, aunque lleguen varios avisos juntos, sin
  esperar al sondeo de 30 s ni a la reconexión.

### REQ-012 · Vista del dueño sobre la fila — M
**Como** dueño, **quiero** ver toda la fila del negocio y poder intervenir, **para** resolver
problemas sin estar detrás de una silla.

- REQ-012.1 CUANDO el dueño abre "Fila", EL SISTEMA DEBE mostrar todos los turnos activos del
  negocio en orden, con barbero preferido/asignado, estado y tiempo de espera transcurrido, más el
  estado de cada barbero.
- REQ-012.2 El dueño DEBE poder sobre cualquier turno: cancelar (motivo: negocio), marcar no
  llegó, reasignar a otro barbero o a "el que esté libre", y mover de posición (subir/bajar)
  `[PA-04]`.
- REQ-012.3 El dueño DEBE poder agregar un turno manualmente (cliente que llegó al local sin
  celular a la mano o sin querer registrarse) con nombre y celular opcional `[PA-07]`; sin celular
  no se crea ficha de cliente.
- REQ-012.4 El dueño DEBE poder pausar y reanudar la fila completa ("Cerrar fila por hoy") con
  efecto en REQ-001.4.
- REQ-012.5 CUANDO el dueño también atiende sillas, EL SISTEMA DEBE permitirle operar como barbero
  (tiene ambos roles) sin cambiar de cuenta.

### REQ-013 · Pantalla pública para el televisor — D
**Como** negocio, **quiero** una pantalla para el televisor del local, **para** que los que están
en el local vean el orden sin preguntar.

- REQ-013.1 CUANDO se abre la URL `/<slug>/pantalla` (con una clave simple en la URL para que no
  sea indexable `[PA-08]`), EL SISTEMA DEBE mostrar en letra grande: por cada barbero, el cliente
  actual y los siguientes 2–3, y un bloque con la fila de "el que esté libre".
- REQ-013.2 Los nombres DEBEN mostrarse como **primer nombre + inicial del apellido** ("Juan P.")
  y nunca el celular (P6).
- REQ-013.3 La pantalla DEBE actualizarse en tiempo real y mostrar el QR de la fila en una esquina.
- REQ-013.4 CUANDO un turno pasa a `llamado`, EL SISTEMA DEBE resaltarlo durante 30 segundos con
  el texto "Pasa a la silla de <barbero>".
- REQ-013.5 La pantalla DEBE funcionar en un navegador de Smart TV o Chromecast sin interacción
  (sin login, sin scroll, sin que la sesión caduque).

### REQ-014 · Cierre automático de turnos al final del día — M
- REQ-014.1 CUANDO llega la hora de cierre del negocio + 60 minutos (o el dueño cierra la fila) y
  quedan turnos `esperando` o `llamado`, EL SISTEMA DEBE pasarlos a `cancelado` (motivo:
  cierre) y mostrarle al cliente "El negocio cerró hoy; vuelve a tomar turno mañana".
- REQ-014.2 Ningún turno DEBE sobrevivir de un día para otro en estado activo.

### REQ-015 · Gestión de servicios — M
**Como** dueño, **quiero** configurar mis servicios con duración y precio, **para** que la fila y
la caja usen los valores correctos.

- REQ-015.1 El dueño DEBE poder crear, editar, ordenar y desactivar servicios con: nombre,
  duración estimada (minutos, múltiplos de 5), precio (COP entero ≥ 0) y si está activo.
- REQ-015.2 SI un servicio se desactiva, ENTONCES EL SISTEMA DEBE dejar de ofrecerlo a clientes
  nuevos pero conservarlo en turnos e historial existentes.
- REQ-015.3 El precio y la duración DEBEN copiarse al turno/venta en el momento de crearlos (un
  cambio de precio no altera ventas pasadas).
- REQ-015.4 La duración es por servicio, igual para todos los barberos en el MVP `[PA-09]`.

### REQ-016 · Gestión de barberos y sillas — M
**Como** dueño, **quiero** dar de alta a mis barberos, **para** que cada uno tenga su fila y su
cuenta.

- REQ-016.1 El dueño DEBE poder crear un barbero con nombre visible, celular, porcentaje de
  comisión (REQ-025) y estado activo/inactivo, e invitarlo a crear su acceso (REQ-030).
- REQ-016.2 El negocio tiene un número de sillas (por defecto 5) usado en el reporte de ocupación
  (REQ-028); un barbero activo ocupa una silla cuando está `disponible`, `en servicio` o `en pausa`
  dentro del horario.
- REQ-016.3 SI un barbero se desactiva, ENTONCES EL SISTEMA DEBE cerrar su sesión, excluirlo de
  la fila y conservar su historial y comisiones.
- REQ-016.4 El dueño DEBE poder marcar qué barberos trabajan hoy (presentes), y solo esos aparecen
  en el formulario del cliente `[PA-06]`.

### REQ-017 · Horario y estado del negocio — M
- REQ-017.1 El dueño DEBE poder configurar el horario por día de la semana (abre/cierra, o
  cerrado) en hora de Bogotá.
- REQ-017.2 La fila DEBE aceptar turnos solo dentro del horario, salvo que el dueño la abra o
  cierre manualmente (REQ-012.4), lo cual prevalece ese día.
- REQ-017.3 CUANDO falta menos de X minutos para cerrar y el tiempo estimado supera el tiempo
  restante, EL SISTEMA DEBE advertir al cliente "Es posible que no alcancemos a atenderte hoy"
  antes de confirmar el turno (X = tiempo estimado).

---

## 3. Hito 2 — Clientes y fidelidad

### REQ-018 · Ficha de cliente por celular — M
**Como** dueño o barbero, **quiero** ver la ficha de un cliente, **para** atenderlo mejor.

- REQ-018.1 EL SISTEMA DEBE mantener una ficha por (negocio, celular) con: nombre, celular,
  barbero preferido (el más elegido en sus últimos 5 turnos, editable), primera visita, última
  visita, número de visitas (turnos `terminado`), estado de aceptación del aviso de privacidad y
  notas libres del negocio.
- REQ-018.2 CUANDO el dueño o barbero abre un cliente, EL SISTEMA DEBE mostrar su historial:
  fecha, servicio, barbero, valor pagado, medio de pago (si Hito 3) y estado (terminado, no llegó,
  cancelado).
- REQ-018.3 El dueño DEBE poder buscar clientes por nombre o por los últimos dígitos del celular,
  con resultados en menos de 1 segundo para 5.000 clientes.
- REQ-018.4 El barbero DEBE ver la ficha de los clientes que atiende o tiene en su fila, con el
  historial completo del cliente en el negocio `[PA-10]`.
- REQ-018.5 El dueño DEBE poder editar nombre y notas, y fusionar dos fichas cuando un cliente
  cambió de celular (conservando el historial de ambas) — D.
- REQ-018.6 Para cumplir la Ley 1581, el dueño DEBE poder **eliminar** una ficha a solicitud del
  cliente: se anonimizan nombre y celular en la ficha y en los turnos/ventas históricos (los montos
  y conteos se conservan para la caja).

### REQ-019 · Tarjeta de fidelidad configurable — M
**Como** dueño, **quiero** premiar a los clientes que repiten (por ejemplo, el décimo corte gratis),
**para** que vuelvan.

- REQ-019.1 El dueño DEBE poder activar la tarjeta y configurar: número de visitas necesarias
  (por defecto 10), qué servicios suman (por defecto todos) `[PA-11]`, y el premio: un servicio
  gratis (elegir cuál) o un descuento en COP.
- REQ-019.2 CUANDO un turno pasa a `terminado` con un servicio que suma, EL SISTEMA DEBE agregar
  un sello a la tarjeta vigente del cliente.
- REQ-019.3 CUANDO la tarjeta se completa, EL SISTEMA DEBE marcar el premio como "disponible",
  mostrarlo en "Mi turno" del cliente ("¡Tu próximo corte es gratis!") y en la ficha/fila para el
  barbero.
- REQ-019.4 CUANDO el barbero registra el cobro (Hito 3) de un cliente con premio disponible, EL
  SISTEMA DEBE ofrecer "Aplicar premio" y, al aplicarlo, registrar la venta con el descuento,
  marcar el premio como canjeado (fecha, turno) y abrir una tarjeta nueva en cero.
- REQ-019.5 Mientras no exista el Hito 3, el canje DEBE poder marcarse desde la ficha del cliente
  ("Marcar premio como canjeado").
- REQ-019.6 CUANDO el dueño cambia la configuración, EL SISTEMA DEBE aplicarla solo a sellos
  futuros; los sellos acumulados se conservan.
- REQ-019.7 El cliente DEBE ver en "Mi turno" su progreso ("7 de 10 cortes").

### REQ-020 · Clientes para recordar (inactivos) — M
**Como** dueño, **quiero** una lista de clientes que llevan más de N días sin venir, **para**
mandarles un recordatorio por WhatsApp.

- REQ-020.1 El dueño DEBE poder configurar N (por defecto **21** días).
- REQ-020.2 CUANDO el dueño abre "Clientes para recordar", EL SISTEMA DEBE listar los clientes con
  al menos 1 visita `terminado`, cuya última visita fue hace más de N días, ordenados por los que
  llevan más tiempo, mostrando nombre, días sin venir, visitas totales y barbero preferido.
- REQ-020.3 Cada fila DEBE tener un botón de WhatsApp que abre `wa.me` con un mensaje prellenado y
  editable por el dueño (REQ-033) con el nombre del cliente y el enlace de la fila.
- REQ-020.4 CUANDO se toca el botón, EL SISTEMA DEBE registrar "recordatorio enviado" con fecha y
  quién lo envió, y excluir al cliente de la lista durante 7 días `[PA-12]` para no insistir.
- REQ-020.5 El dueño DEBE poder excluir permanentemente a un cliente de recordatorios ("No
  contactar"), y EL SISTEMA DEBE respetarlo también en REQ-009.

### REQ-021 · Clientes nuevos vs. que repiten — M
- REQ-021.1 EL SISTEMA DEBE clasificar cada visita `terminado` como "cliente nuevo" (primera visita
  terminada en el negocio) o "repite", para alimentar el resumen semanal (REQ-028).

### REQ-022 · Barbero preferido en la ficha — D
- REQ-022.1 CUANDO un cliente con barbero preferido guardado vuelve a tomar turno, EL SISTEMA DEBE
  preseleccionar ese barbero si está disponible hoy; si no, "El que esté libre".

---

## 4. Hito 3 — Caja y comisiones

### REQ-023 · Cobrar un servicio — M
**Como** barbero, **quiero** registrar el cobro al terminar, **para** que quede en caja sin papel.

- REQ-023.1 CUANDO un turno pasa a `terminado`, EL SISTEMA DEBE abrir "Registrar cobro" con el
  servicio y precio del turno prellenados, el barbero, y los medios de pago: **Efectivo, Nequi,
  Daviplata, Transferencia, Tarjeta** (Daviplata desde ADR-045).
- REQ-023.2 El barbero DEBE poder ajustar el servicio realmente prestado (cambiar o agregar
  servicios del catálogo), ajustar el precio final hacia abajo con un motivo (descuento) `[PA-13]`,
  aplicar el premio de fidelidad (REQ-019.4) y agregar productos (REQ-024) al mismo cobro.
- REQ-023.3 CUANDO se confirma, EL SISTEMA DEBE crear una venta inmutable con: fecha y hora (Bogotá),
  negocio, barbero, cliente (opcional), líneas (servicio/producto, cantidad, precio unitario,
  descuento), total, medio de pago, y la comisión calculada (REQ-025) congelada en ese momento.
- REQ-023.4 Un cobro DEBE poder registrarse **sin turno** (cliente atendido por fuera de la fila)
  desde "Nueva venta", escogiendo barbero y servicio `[PA-07]`.
- REQ-023.5 Un cobro DEBE poder **dividirse** en dos medios de pago (por ejemplo, parte en
  efectivo y parte en Nequi) — D `[PA-14]`.
- REQ-023.6 SI el barbero intenta terminar un turno sin registrar el cobro, ENTONCES EL SISTEMA
  DEBE dejar el turno terminado y marcarlo "Cobro pendiente" en la fila del barbero y del dueño
  hasta que se registre o se marque "No se cobró" con motivo.
- REQ-023.7 Quién registra el cobro: el barbero de su propio servicio; el dueño, cualquiera
  `[PA-15]`.

### REQ-024 · Vender productos — M
**Como** dueño o barbero, **quiero** registrar la venta de helados y bebidas, **para** que la caja
cuadre.

- REQ-024.1 El dueño DEBE poder gestionar productos: nombre, precio (COP entero), activo. Sin
  control de inventario en el MVP `[PA-16]`.
- REQ-024.2 CUANDO se abre "Nueva venta" y se escogen productos y cantidades, EL SISTEMA DEBE
  calcular el total, pedir el medio de pago y crear la venta (REQ-023.3) sin barbero.
- REQ-024.3 Las ventas de productos NO generan comisión salvo configuración explícita `[PA-17]`.
  Desde el Hito 12 (ADR-038): los productos marcados dejan el % de productos del negocio al barbero
  de la venta (REQ-067).

### REQ-025 · Comisión configurable por barbero — M
**Como** dueño, **quiero** definir qué porcentaje se lleva cada barbero, **para** liquidar sin
discusiones.

- REQ-025.1 Cada barbero DEBE tener un porcentaje de comisión (entero 0–100, por defecto el del
  negocio) que representa **la parte del barbero** sobre el valor del servicio después de
  descuentos `[PA-18]`.
- REQ-025.2 CUANDO se crea una venta, EL SISTEMA DEBE calcular `comision_barbero = redondear(valor_servicios × porcentaje / 100)` a pesos enteros (redondeo al peso más cercano) y
  `parte_negocio = valor_servicios − comision_barbero`, y guardarlos en la venta.
- REQ-025.3 CUANDO el dueño cambia el porcentaje, EL SISTEMA DEBE aplicarlo solo a ventas
  posteriores y guardar el historial de cambios (fecha, valor anterior, valor nuevo).
- REQ-025.4 Un servicio gratis por fidelidad genera comisión sobre **el precio de lista**
  `[PA-19]` (el negocio asume el premio).
- REQ-025.5 El barbero DEBE ver en "Mis comisiones" el total del día y de la semana, con el
  detalle por venta, y solo lo suyo.

### REQ-026 · Anular una venta — M
- REQ-026.1 El dueño DEBE poder anular una venta del día con motivo; EL SISTEMA DEBE marcarla
  `anulada` (no borrarla), excluirla de totales y comisiones y conservarla visible en el detalle.
- REQ-026.2 Las ventas de días con cierre de caja hecho NO pueden anularse `[PA-20]`.

### REQ-027 · Cierre de caja diario — M
**Como** dueño, **quiero** cerrar la caja cada día, **para** saber cuánto entró por cada medio y
cuánto le corresponde a cada barbero.

- REQ-027.1 CUANDO el dueño abre "Caja de hoy", EL SISTEMA DEBE mostrar en vivo: total vendido,
  total por medio de pago (Efectivo, Nequi, Daviplata, Transferencia, Tarjeta), total servicios vs. productos,
  y por barbero: servicios atendidos, valor vendido, comisión del barbero y parte del negocio.
- REQ-027.2 CUANDO el dueño toca "Cerrar caja", EL SISTEMA DEBE pedir el efectivo contado (COP
  entero), calcular la diferencia contra el efectivo esperado, y crear un cierre inmutable con
  todos los totales, la hora y quién cerró.
- REQ-027.3 CUANDO un día ya tiene cierre, EL SISTEMA DEBE bloquear nuevas ventas con fecha de ese
  día y mostrar el cierre en modo lectura; el dueño puede "Reabrir" con motivo, lo cual anula el
  cierre anterior y permite uno nuevo `[PA-20]`.
- REQ-027.4 El dueño DEBE poder ver cierres pasados por fecha y compartir el resumen por WhatsApp
  (texto plano prellenado).
- REQ-027.5 El "día" de caja es el día calendario en `America/Bogota`.
- REQ-027.6 El cierre DEBE mostrar, por barbero, un texto listo para liquidar: "Juan: 8 servicios,
  $ 240.000 vendidos, comisión 60 % = $ 144.000".

### REQ-028 · Resumen semanal — M
**Como** dueño, **quiero** un resumen semanal, **para** saber cómo va el negocio.

- REQ-028.1 CUANDO el dueño abre "Semana", EL SISTEMA DEBE mostrar, para la semana escogida
  (lunes a domingo `[PA-21]`, por defecto la actual): clientes nuevos, clientes que repiten, total
  de servicios, total vendido, total por barbero, y **ocupación de sillas**.
- REQ-028.2 La ocupación de sillas DEBE calcularse como `minutos en servicio de todos los barberos
  ÷ (minutos de apertura de la semana × número de sillas)` y mostrarse como porcentaje, con el
  detalle por día y por barbero. Los minutos en servicio salen del historial de estados
  (REQ-007.7).
- REQ-028.3 El resumen DEBE comparar con la semana anterior (variación en %) — D.
- REQ-028.4 Turnos `no_llego` y `cancelado` de la semana DEBEN mostrarse como indicador aparte
  ("12 turnos perdidos").

### REQ-029 · Vista del barbero sobre sus números — M
- REQ-029.1 El barbero DEBE ver únicamente sus propias ventas y comisiones (hoy y semana); nunca
  los totales del negocio ni los de otros barberos.

---

## 5. Transversales

### REQ-030 · Acceso del personal (dueño y barberos) — M
- REQ-030.1 El dueño DEBE poder crear su cuenta con correo y contraseña `[PA-01]` y crear su
  negocio en un asistente de 3 pasos: nombre y dirección, horario, servicios iniciales.
- REQ-030.2 El dueño DEBE poder invitar a un barbero generando un enlace de invitación (válido 7
  días, compartible por WhatsApp); CUANDO el barbero lo abre, define su acceso `[PA-01]` y queda
  vinculado al negocio con rol barbero.
- REQ-030.3 La sesión del personal DEBE persistir en el celular (sin volver a iniciar sesión cada
  día) por al menos 30 días de inactividad.
- REQ-030.4 El dueño DEBE poder revocar el acceso de un barbero (REQ-016.3).

### REQ-031 · Aislamiento multi-negocio — M
- REQ-031.1 Toda tabla con datos de negocio DEBE tener `business_id` y políticas RLS que impidan
  leer o escribir datos de otro negocio, para cualquier rol, incluso con consultas directas a la
  API de Supabase con el token del usuario.
- REQ-031.2 Las páginas públicas (fila, "Mi turno", pantalla) DEBEN exponer solo los datos
  estrictamente necesarios (nunca celulares de otros clientes, nunca ventas).
- REQ-031.3 Un usuario DEBE poder pertenecer a varios negocios (tabla de membresías), aunque la
  interfaz del MVP solo muestre el primero.
- REQ-031.4 DEBE existir una prueba automatizada que intente, con el token de un barbero del
  negocio A, leer y escribir turnos, clientes y ventas del negocio B, y falle.

### REQ-032 · PWA instalable — M
- REQ-032.1 La app DEBE ofrecer "Agregar a la pantalla de inicio" (manifest, íconos, nombre
  "TurnOS" o el nombre del negocio `[PA-22]`) en Android Chrome e iOS Safari.
- REQ-032.2 Las pantallas del barbero y del cliente DEBEN cargar en menos de 3 s en 4G
  (LCP) y ser usables con una mano (botones principales ≥ 48 px, en la parte inferior).

### REQ-033 · Plantillas de mensajes de WhatsApp — M
- REQ-033.1 El dueño DEBE poder editar las plantillas: "faltan 2 turnos", "recordatorio de
  cliente inactivo", "compartir la fila" y "cumpleaños" (REQ-037.4, Hito 5), con variables `{nombre}`, `{negocio}`, `{tiempo}`,
  `{enlace}`, con valores por defecto en español colombiano y vista previa.

> Hito 6 (ADR-027): los textos del aviso automático son fijos y no se editan aquí (REQ-040.9).

### REQ-034 · Datos de ejemplo (seed) — M
- REQ-034.1 EL SISTEMA DEBE incluir un seed reproducible con una barbería de ejemplo en Sabaneta,
  5 barberos con distintos porcentajes de comisión, 5–6 servicios con precios en COP, 4–5
  productos, ~30 clientes con historial y una fila con turnos en distintos estados, para pruebas y
  demostración.

---

## 5b. Hito 4 — Servicios por barbero

### REQ-035 · Servicios por barbero — M
> Estado: **APROBADA** (Henry, 2026-10-28, tras grill). Sale de Filo: 4
> sillas de hombre y 1 de mujer, y una persona aparte para manicure y pedicure. Ver ADR-023.

**Como** dueño, **quiero** decir qué servicios hace cada barbero, **para** que un cepillado no le
caiga a quien solo corta pelo de hombre.

Configuración

- REQ-035.1 El dueño DEBE poder marcar, al crear o editar un barbero, los servicios que hace
  ("Servicios que hace"); al crear un barbero, todos los servicios activos vienen marcados.
- REQ-035.2 El dueño DEBE poder marcar, al crear o editar un servicio, qué barberos lo hacen
  ("Quién lo hace"); al crear un servicio, todos los barberos activos vienen marcados. Es la misma
  relación que REQ-035.1, vista desde el servicio.
- REQ-035.3 SI el dueño intenta guardar un barbero activo sin ningún servicio marcado, ENTONCES
  EL SISTEMA DEBE impedirlo con el mensaje "Marca al menos un servicio".
- REQ-035.4 CUANDO se activa esta función en un negocio existente, EL SISTEMA DEBE considerar que
  cada barbero hace todos los servicios (nada cambia hasta que el dueño desmarque).
- REQ-035.5 La persona que solo hace manicure y pedicure (u otro servicio que no es de barbería)
  se registra como un barbero más, con solo esos servicios marcados; la interfaz sigue diciendo
  "barbero".

Fila

- REQ-035.6 CUANDO el cliente escoge un servicio en el formulario (REQ-003.1), EL SISTEMA DEBE
  mostrar solo los barberos presentes que hacen ese servicio, más "El que esté libre"; SI el
  barbero seleccionado (o el preferido prellenado, REQ-022) no hace el servicio nuevo, ENTONCES EL
  SISTEMA DEBE volver a seleccionar "El que esté libre".
- REQ-035.7 SI hay al menos un barbero presente y ninguno de los presentes hace un servicio,
  ENTONCES EL SISTEMA DEBE mostrarlo en gris con "Hoy no hay quién lo haga" y no dejar escogerlo;
  `join_queue` DEBE rechazarlo también en el servidor. Si todavía no hay nadie presente (el negocio
  abrió y no ha llegado ningún barbero), todo sigue como antes: se puede tomar turno y el cliente
  ve "No hay barberos atendiendo en este momento" (Henry, 2026-10-28, Q16).
- REQ-035.8 `join_queue` y `add_manual_ticket` DEBEN rechazar un barbero preferido que no hace el
  servicio del turno.
- REQ-035.9 Un turno de "El que esté libre" DEBE aparecer solo en la fila de los barberos que
  hacen su servicio, y "Llamar al siguiente" DEBE traer el primer turno que el barbero puede
  atender (saltando los demás), conservando la regla de carrera de REQ-007.2.
- REQ-035.10 La posición y el tiempo estimado (REQ-004) DEBEN calcularse solo con los barberos que
  hacen el servicio del turno; SI ninguno de ellos está atendiendo (todos en pausa o ausentes),
  ENTONCES el cliente DEBE ver "Esperando a que haya quién te atienda" en lugar del tiempo, y el
  turno sigue en la fila (nunca pasa a un barbero que no hace el servicio).
- REQ-035.11 CUANDO el dueño agrega un cliente a mano, reasigna un turno o lo llama con un barbero
  (REQ-012.2, REQ-012.3), EL SISTEMA DEBE ofrecer solo los barberos que hacen ese servicio y
  rechazar en el servidor cualquier otro.
- REQ-035.12 CUANDO el dueño cambia los servicios de un barbero, los turnos que ya están
  esperando con ese barbero como preferido DEBEN quedarse con él; la regla aplica a los turnos
  nuevos y a los de "El que esté libre".

Caja

- REQ-035.13 El cobro y la nueva venta (REQ-023, REQ-024) NO validan quién hace qué: la caja
  registra lo que pasó y la comisión se calcula igual (REQ-025).

Fuera de alcance de REQ-035: duración o precio distintos por barbero (PA-09 sigue vigente).

---

## 5c. Hito 5 — Experiencia del cliente

> Estado: **APROBADA** (Henry, 2026-10-28). TurnOS es para una sola barbería; cada requisito se
> mide por si mejora la experiencia del cliente. Ver ADR-025 (incluye los valores por defecto de
> las preguntas del borrador).

### REQ-036 · Reseña en Google después del corte — M
**Como** dueño, **quiero** que el cliente pueda dejarnos una reseña en Google justo después del
corte, **para** que más gente del barrio nos encuentre.

- REQ-036.1 El dueño DEBE poder guardar, en `/admin/negocio`, el enlace de reseñas de Google de
  la barbería; EL SISTEMA DEBE aceptar solo enlaces `https://` y mostrar "Ese enlace no parece
  válido" si no lo es.
- REQ-036.2 CUANDO el turno del cliente pasa a terminado y hay enlace guardado, "Mi turno" DEBE
  mostrar "¡Gracias por venir!" y un botón "Déjanos tu reseña en Google" que abre el enlace en una
  pestaña nueva.
- REQ-036.3 SI no hay enlace guardado, ENTONCES EL SISTEMA NO DEBE mostrar el botón (el mensaje de
  gracias sí).
- REQ-036.4 El botón NO DEBE aparecer en turnos cancelados ni en "no llegó".

### REQ-037 · Cumpleaños del cliente — M
**Como** dueño, **quiero** saber quién cumple años esta semana, **para** saludarlo y que se sienta
reconocido.

- REQ-037.1 La ficha del cliente DEBE admitir día y mes de cumpleaños (sin año), opcional y
  editable por el dueño y por el barbero con alcance sobre la ficha (ADR-016).
- REQ-037.2 Al tomar turno, SI la ficha no tiene cumpleaños, EL SISTEMA DEBE mostrar un campo
  opcional "¿Cuándo cumples años? (opcional)" con día y mes; SI ya lo tiene, NO DEBE volver a
  pedirlo. Un cumpleaños escrito en el formulario nunca reemplaza uno ya guardado.
- REQ-037.3 EL SISTEMA DEBE rechazar fechas imposibles (31 de abril, 30 de febrero) con "Esa fecha
  no existe"; el 29 de febrero es válido.
- REQ-037.4 El dueño DEBE ver la lista "Cumplen esta semana" (hoy y los 6 días siguientes, día de
  Bogotá) junto a "Clientes para recordar", ordenada por fecha, con botón de WhatsApp que usa la
  plantilla "cumpleaños" (REQ-033, variables `{nombre}`, `{negocio}`); en años no bisiestos, quien
  cumple el 29 de febrero aparece el 28.
- REQ-037.5 La lista NO DEBE incluir clientes con "no contactar" (REQ-020.5) ni fichas eliminadas
  (REQ-018.6).
- REQ-037.6 El texto por defecto del aviso de privacidad DEBE mencionar el cumpleaños como dato
  opcional y para qué se usa; el dueño publica la versión nueva con el mecanismo de REQ-002.5.

### REQ-038 · Menú de la barbería y bebida de cortesía — M
**Como** cliente, **quiero** ver lo que venden en la barbería y escoger una bebida de cortesía al
tomar turno, **para** que me la tengan lista cuando llegue.

- REQ-038.1 Cada producto DEBE poder marcarse como "A la venta" (se muestra con precio), "De
  cortesía" (se ofrece gratis con el turno), o ambas, y tener una foto opcional.
- REQ-038.2 La portada `/[slug]` DEBE mostrar "Lo que vendemos" con foto, nombre y precio de los
  productos activos a la venta; solo se muestran (se compran en persona). SI no hay ninguno, la
  sección no aparece.
- REQ-038.3 CUANDO hay productos activos de cortesía, el formulario de turno DEBE ofrecer
  "Bebida de cortesía" con esas opciones y "No, gracias" (seleccionada por defecto); el cliente
  escoge **una** como máximo.
- REQ-038.4 Mientras el turno esté en espera, "Mi turno" DEBE dejar cambiar o quitar la bebida;
  desde que lo llaman ya no se puede cambiar.
- REQ-038.5 La fila del barbero y la del dueño DEBEN mostrar la bebida escogida en cada turno y un
  botón "Servida ✓" que la marca (hora y quién); una vez servida se ve como "Servida ✓" y no se
  puede desmarcar.
- REQ-038.6 `join_queue` y el cambio desde "Mi turno" DEBEN rechazar un producto que no sea de
  cortesía, esté inactivo o sea de otro negocio, con "Esa bebida ya no está disponible".
- REQ-038.7 La cortesía NO DEBE generar cobro, venta ni comisión, ni aparecer en caja (ADR-025).
  Si un producto se acaba, el dueño lo desactiva y deja de ofrecerse; los turnos que ya lo tenían
  lo conservan.

### REQ-039 · Fotos de cortes por barbero — D
**Como** cliente nuevo, **quiero** ver fotos de los cortes de cada barbero, **para** escoger con
quién me corto.

- REQ-039.1 Cada barbero DEBE poder subir, desde el celular, hasta 12 fotos de sus cortes y borrar
  las suyas; el dueño DEBE poder subir y borrar las de cualquier barbero.
- REQ-039.2 SI el barbero ya tiene 12 fotos, ENTONCES EL SISTEMA DEBE impedir subir otra con
  "Ya tienes 12 fotos. Borra una para subir otra".
- REQ-039.3 Antes de subir cada foto, EL SISTEMA DEBE pedir confirmar "El cliente me dio permiso
  de publicar esta foto" (Ley 1581: la imagen es dato personal); sin confirmar no se sube.
- REQ-039.4 EL SISTEMA DEBE reducir la foto en el celular antes de subirla (lado mayor ≤ 1080 px,
  ≤ 300 KB) y rechazar archivos que no sean imagen con "Ese archivo no es una foto".
- REQ-039.5 En el formulario de turno, junto a cada barbero con fotos, DEBE haber "Ver cortes",
  que abre sus fotos (de la más nueva a la más vieja) sin perder lo que el cliente ya escribió.
- REQ-039.6 CUANDO se desactiva un barbero, sus fotos DEBEN dejar de mostrarse al público (se
  conservan por si vuelve).

Fuera de alcance del Hito 5: inventario de productos, pedidos o pagos en línea del menú, regalo de
cumpleaños automático, envío automático por WhatsApp (va en el hito del aviso automático).

---

## 5d. Hito 6 — Aviso automático por WhatsApp

> Estado: **APROBADA** (Henry, 2026-11-01, tras grill). Ver ADR-027. Hasta que Meta apruebe el
> número y las plantillas se construye y prueba con el número de prueba de Meta.

### REQ-040 · Avisos automáticos del turno — M
**Como** cliente, **quiero** que me llegue un WhatsApp cuando falte poco y cuando me llamen, **para**
no depender de que el barbero se acuerde.

- REQ-040.1 CUANDO un turno en espera con permiso (REQ-041) tiene **2 turnos o menos delante** por
  primera vez, EL SISTEMA DEBE enviar el aviso "faltan 2" sin que nadie toque nada, con nombre,
  negocio, tiempo estimado y enlace a "Mi turno".
- REQ-040.2 SI el turno ya tenía 2 o menos delante al crearse, ENTONCES EL SISTEMA NO DEBE enviar
  el aviso "faltan 2".
- REQ-040.3 Un turno DEBE recibir "faltan 2" una sola vez, aunque su posición suba y vuelva a bajar.
- REQ-040.4 MIENTRAS el barbero que lo va a atender esté en pausa, o el cliente vea "Esperando a que
  haya quién te atienda" o no haya tiempo estimado, EL SISTEMA NO DEBE enviar "faltan 2"; CUANDO
  vuelva a haber quién lo atienda y siga con 2 o menos delante, EL SISTEMA DEBE enviarlo.
- REQ-040.5 CUANDO un turno con permiso pasa a `llamado`, EL SISTEMA DEBE enviar el aviso "te están
  llamando" con el tiempo de gracia (REQ-008.1), una sola vez por turno.
- REQ-040.6 CUANDO un aviso se acepta para envío, EL SISTEMA DEBE marcar el turno como "Avisado ✓"
  (REQ-009.3), sin barbero asociado: lo avisó el sistema.
- REQ-040.7 SI el envío de un aviso falla, ENTONCES EL SISTEMA DEBE quitar "Avisado ✓" y volver a
  mostrar "Avisar" con el botón manual de `wa.me` (REQ-009); ningún error de envío DEBE impedir ni
  demorar tomar turno, llamar ni ninguna otra acción de la fila.
- REQ-040.8 El botón manual DEBE seguir disponible en todos los turnos (REQ-009.4), tengan o no
  permiso.
- REQ-040.9 Los textos automáticos son fijos (aprobados por Meta): `/admin/mensajes` DEBE mostrarlos
  solo para leer, y las plantillas de `wa.me` siguen editables (REQ-033).

### REQ-041 · Permiso del cliente para los avisos — M
**Como** cliente, **quiero** decidir si me escriben por WhatsApp, **para** que no me llegue nada que
no pedí.

- REQ-041.1 CUANDO el aviso automático está activo y la ficha no tiene permiso vigente, el formulario
  de turno DEBE mostrar una casilla aparte, **no marcada por defecto**: "Avísame por WhatsApp cuando
  falte poco"; no marcarla NO DEBE impedir tomar turno.
- REQ-041.2 CUANDO el cliente la marca, EL SISTEMA DEBE guardar en la ficha la fecha y hora del
  permiso.
- REQ-041.3 SI la ficha ya tiene permiso vigente, ENTONCES el formulario DEBE mostrar en una línea
  "Te avisamos por WhatsApp cuando falte poco" sin casilla.
- REQ-041.4 CUANDO el barbero o el dueño agregan un turno a mano, EL SISTEMA DEBE enviar avisos solo
  si la ficha ya tiene permiso vigente; la pantalla no DEBE dejar marcar el permiso por el cliente.
- REQ-041.5 Un turno sin celular o sin permiso vigente NO DEBE recibir avisos automáticos.
- REQ-041.6 El aviso de privacidad por defecto DEBE decir que el celular y el nombre pasan por
  WhatsApp (Meta) para enviar estos avisos; se publica con el mecanismo de REQ-002.5.

### REQ-042 · Baja y respuestas del cliente — M
**Como** cliente, **quiero** poder dejar de recibir avisos, **para** que me escriban solo si quiero.

- REQ-042.1 "Mi turno" DEBE ofrecer "No quiero avisos por WhatsApp" mientras la ficha tenga permiso
  vigente y el turno esté activo.
- REQ-042.2 CUANDO el cliente responde "PARAR" (sin importar mayúsculas, tildes ni espacios) al
  número de los avisos, EL SISTEMA DEBE retirar el permiso y confirmarle con un mensaje.
- REQ-042.3 CUANDO se retira el permiso, EL SISTEMA DEBE guardar fecha y hora en la ficha y no enviar
  más avisos, tampoco en un turno ya activo; solo vuelve a recibirlos si marca la casilla en un turno
  futuro.
- REQ-042.4 CUANDO el cliente escribe cualquier otra cosa al número de los avisos, EL SISTEMA DEBE
  responder "Este número solo envía avisos. Para hablar con la barbería escribe al <número>", como
  máximo una vez cada 24 horas por celular.
- REQ-042.5 SI el negocio no tiene número de contacto guardado, ENTONCES la respuesta automática DEBE
  omitir esa parte.

### REQ-043 · Control y activación — M
**Como** dueño, **quiero** ver cuántos avisos van y que el gasto tenga tope, **para** que un error
no dispare mensajes sin parar.

- REQ-043.1 EL SISTEMA DEBE dejar de enviar avisos automáticos al llegar a **3.000 en el mes**
  (día de Bogotá); los turnos vuelven al botón manual.
- REQ-043.2 `/admin/mensajes` DEBE mostrar los avisos enviados y fallidos del mes, y un aviso visible
  si se llegó al tope.
- REQ-043.3 El aviso automático DEBE venir **apagado por defecto** y activarse por negocio; apagado o
  sin credenciales del servidor, todo sigue como hoy con `wa.me` y sin casilla.
- REQ-043.4 Las pruebas automáticas NO DEBEN enviar mensajes reales.
- REQ-043.5 El sistema DEBE rechazar las notificaciones de Meta cuya firma no sea válida.
- REQ-043.6 El aviso automático SOLO DEBE poder activarse en los negocios que el operador de TurnOS
  habilite; el dueño NO DEBE poder habilitar su propio negocio, y en un negocio no habilitado el
  interruptor no aparece (ADR-029).

Fuera de alcance del Hito 6: mensajes automáticos de cumpleaños e inactivos, notificación push,
bandeja para leer o contestar mensajes, y el asistente con IA.

---

## 5e. Hito 7 — Membresía familiar

> Estado: **APROBADA** (Henry, 2026-11-02, tras grill de 25 preguntas). Ver ADR-030.
> Una familia paga una cuota y comparte N cortes durante 30 días; al gastarlos tiene descuento.

### REQ-044 · Plan de membresía — M
**Como** dueño, **quiero** configurar un plan de membresía familiar, **para** que las familias
vuelvan seguido y paguen por adelantado.

- REQ-044.1 Cada negocio DEBE tener un único plan con: precio de la cuota (COP entero), número de
  cortes por periodo (N), porcentaje de descuento al agotarlos (entero 0–100) y qué servicios gastan
  cortes (por defecto solo "Corte").
- REQ-044.2 La membresía DEBE venir **apagada por defecto**; SI falta el precio, N o al menos un
  servicio, ENTONCES EL SISTEMA NO DEBE dejar activarla.
- REQ-044.3 Solo el dueño DEBE poder ver y cambiar el plan.
- REQ-044.4 CUANDO el dueño cambia el plan, EL SISTEMA DEBE aplicarlo a los periodos que empiecen
  después; un periodo ya pagado conserva el precio, N y el descuento con que se pagó.
- REQ-044.5 MIENTRAS la membresía esté apagada, EL SISTEMA NO DEBE ofrecerla en el cobro ni mostrarla
  al cliente; las membresías vigentes se conservan para cuando se vuelva a encender.

### REQ-045 · Cuota y vigencia — M
**Como** dueño, **quiero** cobrar la cuota en la caja, **para** que la plata quede registrada como
cualquier otra venta.

- REQ-045.1 CUANDO el dueño registra la cuota de una familia, EL SISTEMA DEBE crear una venta de
  "Membresía" con los medios de pago de la caja (REQ-023.1), sin barbero y sin comisión, que entra
  completa como ingreso del negocio ese día.
- REQ-045.2 Solo el dueño DEBE poder registrar una cuota. No hay cobro automático ni pago en línea.
- REQ-045.3 Un periodo DEBE durar **30 días** desde el día del pago (Bogotá), con N cortes.
- REQ-045.4 SI el titular paga mientras tiene un periodo vigente, ENTONCES el periodo nuevo DEBE
  empezar el día siguiente al fin del actual, con sus propios N cortes.
- REQ-045.5 CUANDO un periodo vence, EL SISTEMA DEBE dar por perdidos los cortes que sobren; no se
  acumulan.
- REQ-045.6 SI el titular no renueva, ENTONCES la membresía DEBE expirar sin multa ni periodo de
  gracia y los miembros vuelven a precio normal; puede renovar cuando quiera.
- REQ-045.7 El dueño DEBE poder anular la venta de una cuota con las reglas de REQ-026 (solo del día,
  con motivo) y solo si el periodo no tiene cortes usados; al anularla, el periodo desaparece.

### REQ-046 · Familia — M
**Como** dueño, **quiero** inscribir a la familia por celular, **para** saber quién puede usar los
cortes.

- REQ-046.1 Una membresía DEBE tener un titular y hasta **5 personas en total** contando al titular,
  identificadas por su ficha de cliente (celular).
- REQ-046.2 Solo el dueño DEBE poder crear la membresía y agregar o quitar miembros, desde
  "Membresías" en `/admin`; si el celular no tiene ficha, EL SISTEMA DEBE crearla con el nombre.
- REQ-046.3 SI un celular ya está en otra membresía vigente, ENTONCES EL SISTEMA NO DEBE dejar
  agregarlo.
- REQ-046.4 El dueño DEBE poder cambiar miembros en cualquier momento; quitar a alguien no devuelve
  cortes y lo deja libre para entrar a otra familia.

### REQ-047 · Usar la membresía en el cobro — M
**Como** barbero, **quiero** que el cobro aplique la membresía solo, **para** no hacer cuentas.

- REQ-047.1 CUANDO se registra el cobro (con turno o en "Nueva venta") de un miembro con periodo
  vigente y cortes disponibles, y el servicio gasta cortes, EL SISTEMA DEBE ofrecer "Usar membresía"
  marcado por defecto; al aplicarlo, ese servicio queda en $ 0 y gasta un corte del periodo.
- REQ-047.2 SI el periodo vigente no tiene cortes disponibles, ENTONCES EL SISTEMA DEBE aplicar el
  descuento del plan a los servicios que gastan cortes, y no a productos.
- REQ-047.3 El barbero DEBE poder aplicar la membresía aunque no pueda dar descuentos (PA-13): el
  valor lo fija el plan.
- REQ-047.4 En un corte de membresía y en un servicio con el descuento de la membresía, la comisión
  del barbero DEBE calcularse sobre el **precio de lista**; la diferencia la asume el negocio
  (ADR-030).
- REQ-047.5 Una venta DEBE llevar un solo beneficio: si el cliente tiene membresía y premio de
  fidelidad, se aplica la membresía y el premio queda disponible.
- REQ-047.6 No hay límite de cortes por persona dentro de la familia.
- REQ-047.7 Un corte pagado con la membresía NO DEBE sumar sello de fidelidad; un servicio con el
  descuento de la membresía sí suma.
- REQ-047.8 CUANDO se anula una venta que gastó un corte, EL SISTEMA DEBE devolver el corte al
  periodo.

### REQ-048 · Lo que ven el cliente, el barbero y el dueño — M
**Como** cliente de una familia, **quiero** saber cuántos cortes quedan, **para** saber si el mío va
por la membresía.

- REQ-048.1 "Mi turno" de un miembro con periodo vigente DEBE mostrar "Membresía familiar: quedan X
  de N cortes · vence el <día>", sin decir quién usó los demás.
- REQ-048.2 Las filas del barbero y del dueño DEBEN marcar con "Membresía" el turno de un miembro con
  periodo vigente.
- REQ-048.3 El cierre del día (REQ-027) y el resumen semanal (REQ-028) DEBEN mostrar aparte el
  ingreso por cuotas y los cortes de membresía (cantidad y valor de lista); sus comisiones entran a
  la liquidación como las demás.
- REQ-048.4 "Membresías" DEBE listar las que **vencen en los próximos 7 días** con un botón de
  WhatsApp (`wa.me`, manual) y texto editable (REQ-033) para recordar al titular que renueve.
- REQ-048.5 El aviso de privacidad por defecto DEBE decir que el titular entrega el celular de los
  miembros para la membresía; se publica con el mecanismo de REQ-002.5.

Fuera de alcance del Hito 7: varios planes, cobro automático o pago en línea, acumular cortes,
límite por persona, recordatorio automático de pago y beneficios en productos.

---

## 5f. Hito 8 — Citas a hora fija

> Estado: **APROBADA** (Henry, 2026-11-03, tras grill de 15 preguntas). Ver ADR-033.
> El cliente reserva una hora con un barbero; la cita aparta ese hueco y, al llegar, pasa de primera
> en la fila de ese barbero. Los clientes sin cita siguen en la misma fila.

### REQ-049 · Agenda de citas — M
**Como** dueño, **quiero** decidir si hay citas y con qué barberos, **para** que no se coman la fila.

- REQ-049.1 Las citas DEBEN venir **apagadas por defecto**; MIENTRAS estén apagadas, EL SISTEMA NO
  DEBE ofrecer "Reservar cita" ni dejar crear citas; las ya reservadas se conservan.
- REQ-049.2 El dueño DEBE marcar qué barberos reciben citas (por defecto ninguno); un barbero
  inactivo (REQ-016.3) no recibe citas.
- REQ-049.3 EL SISTEMA DEBE ofrecer horas cada **15 minutos** desde la apertura del día (REQ-017.1)
  en las que el servicio elegido termina a más tardar al cierre, con un barbero que reciba citas,
  haga el servicio (REQ-035) y no tenga otra cita que se cruce en ese tiempo.
- REQ-049.4 Una cita DEBE empezar **al menos 1 hora después** de ahora y a más tardar el día que
  queda **7 días** después de hoy (Bogotá).
- REQ-049.5 EL SISTEMA NO DEBE ofrecer horas en un día marcado cerrado en el horario ni en un día
  con la fila cerrada a mano (REQ-012.4).
- REQ-049.6 Solo el dueño DEBE poder encender o apagar las citas y elegir los barberos.

### REQ-050 · Reservar una cita — M
**Como** cliente, **quiero** reservar una hora desde el celular, **para** llegar y que me atiendan.

- REQ-050.1 CUANDO las citas están encendidas, la portada del negocio DEBE mostrar "Reservar cita",
  que lleva a un formulario con servicio, barbero o "El que esté libre", día, hora disponible,
  nombre, celular y el aviso de privacidad (REQ-002).
- REQ-050.2 CUANDO el cliente reserva, EL SISTEMA DEBE guardar la cita con la hora, la duración y el
  precio del servicio de ese momento, crear o actualizar su ficha como al tomar turno (REQ-003) y
  darle el enlace "Mi cita" con un token no adivinable.
- REQ-050.3 SI el cliente eligió "El que esté libre", ENTONCES EL SISTEMA DEBE fijar un barbero que
  cumpla REQ-049.3 a esa hora: el que tenga menos citas ese día y, si empatan, el primero en el
  orden de barberos.
- REQ-050.4 SI dos personas reservan la misma hora con el mismo barbero, ENTONCES solo una DEBE
  quedar con la cita; la otra ve "Esa hora se acaba de ocupar" y las horas actualizadas.
- REQ-050.5 Un celular DEBE tener a lo sumo **una cita pendiente** por negocio; SI ya tiene una,
  ENTONCES EL SISTEMA DEBE mostrarle la que tiene con su enlace en vez de crear otra.
- REQ-050.6 El dueño DEBE poder crear una cita desde "Citas" con nombre y celular, con las mismas
  reglas salvo la hora mínima: puede agendar cualquier hora libre de hoy que no haya pasado; al
  crearla ve un botón de WhatsApp (`wa.me`, texto editable REQ-033) para mandarle el enlace al
  cliente.
- REQ-050.7 Reservar desde la portada DEBE tener el mismo límite de intentos que tomar turno
  (NFR-004: máx. 5 por celular y 30 por IP por hora).

### REQ-051 · Mi cita — M
**Como** cliente, **quiero** ver y cancelar mi cita, **para** no tener que llamar.

- REQ-051.1 "Mi cita" DEBE mostrar negocio, día, hora, barbero, servicio, precio, estado y "Llega
  a tu hora: te esperamos hasta 10 minutos".
- REQ-051.2 MIENTRAS la cita esté pendiente, el cliente DEBE poder cancelarla en cualquier momento,
  con confirmación; la hora queda libre de inmediato. No hay cambio de hora: cancela y reserva otra.
- REQ-051.3 "Agregar al calendario" DEBE descargar un archivo de calendario con la hora, la
  duración, la dirección del negocio y el enlace a "Mi cita".
- REQ-051.4 CUANDO la cita se marca "Llegó", "Mi cita" DEBE llevar a "Mi turno" (REQ-004) del turno
  creado.
- REQ-051.5 SI la cita fue cancelada, perdió la hora o quedó "No vino", ENTONCES "Mi cita" DEBE
  decirlo y ofrecer "Reservar otra".
- REQ-051.6 "Mi cita" NO DEBE mostrar el celular; la pantalla del local (REQ-013) NO DEBE mostrar
  citas que no han llegado.

### REQ-052 · Llegada y prioridad en la fila — M
**Como** barbero, **quiero** que la cita pase de primera cuando llega, **para** cumplirle la hora.

- REQ-052.1 Las filas del barbero (sus citas) y del dueño (todas) DEBEN mostrar las citas pendientes
  de hoy con hora, nombre, servicio, barbero y el botón "Llegó".
- REQ-052.2 CUANDO el barbero de la cita o el dueño marca "Llegó" a más tardar 10 minutos después de
  la hora, EL SISTEMA DEBE crear un turno para ese barbero marcado "Cita HH:MM" que queda delante de
  los turnos sin cita de su fila y detrás de las citas llegadas con hora anterior.
- REQ-052.3 SI pasan 10 minutos de la hora sin "Llegó", ENTONCES la cita DEBE perder la hora: esa
  hora vuelve a estar libre y "Llegó" crea un turno sin cita al final de la fila, con ese barbero
  como preferido.
- REQ-052.4 "Llamar al siguiente" (REQ-007) NO DEBE llamar a un turno sin cita cuyo servicio no
  termine antes de la próxima cita pendiente del barbero; llama al primero de su fila que quepa o a
  una cita llegada. SI ninguno cabe, ENTONCES DEBE decir "Tu próxima cita es a las HH:MM". El dueño
  puede llamar a cualquiera (REQ-012.2).
- REQ-052.5 SI la cita era "El que esté libre" y su barbero está en pausa o no vino cuando se marca
  "Llegó", ENTONCES EL SISTEMA DEBE pasarla a un barbero presente que haga el servicio, si hay.
- REQ-052.6 CUANDO se cierra la fila del día (REQ-014), las citas pendientes que perdieron la hora
  DEBEN quedar "No vino".

### REQ-053 · Estimado con citas — M
**Como** cliente sin cita, **quiero** un tiempo estimado que cuente las citas, **para** no esperar
de más.

- REQ-053.1 El tiempo estimado (REQ-004) DEBE tratar cada cita pendiente de hoy como un hueco
  ocupado de su barbero: un turno sin cita no se simula con ese barbero si su servicio se cruza con
  el hueco; se corre a después de la cita o a otro barbero.
- REQ-053.2 Una cita que perdió la hora NO DEBE contar como hueco.
- REQ-053.3 Un turno de cita llegada DEBE contar en la posición (REQ-004.1) de los turnos que su
  barbero podría atender.

### REQ-054 · Agenda del dueño y avisos — M
**Como** dueño, **quiero** ver y arreglar las citas, **para** avisar a tiempo cuando algo cambia.

- REQ-054.1 "Citas" en `/admin` DEBE listar las citas de hoy y de los 7 días siguientes, por día,
  con hora, cliente, servicio, barbero y estado.
- REQ-054.2 El dueño DEBE poder cancelar una cita pendiente y pasarla a otro barbero que reciba
  citas, haga el servicio y tenga esa hora libre; al cancelar ve un botón de WhatsApp (`wa.me`,
  texto editable REQ-033) para avisarle al cliente.
- REQ-054.3 "Citas de mañana" DEBE mostrar cada cita pendiente del día siguiente con un botón de
  WhatsApp (`wa.me`, texto editable REQ-033) para recordarla.
- REQ-054.4 EL SISTEMA DEBE marcar con un aviso las citas pendientes de hoy cuyo barbero está en
  pausa o no está presente, y las de días que quedaron sin horas por REQ-049.5.
- REQ-054.5 `/admin/mensajes` DEBE tener las plantillas "Confirmar cita", "Recordar cita" y "Cita
  cancelada", con las variables {nombre}, {negocio}, {fecha}, {hora} y {enlace}.
- REQ-054.6 El barbero NO DEBE ver la agenda de otros días ni las citas de otros barberos.

Fuera de alcance del Hito 8: cambiar la hora desde "Mi cita", varios servicios por cita, cobro o
depósito para reservar, recordatorio automático por WhatsApp, citas repetidas y horario distinto
por barbero.

---

## 5g. Hito 9 — Tarjetas de regalo

> Estado: **APROBADA** (Henry, 2026-11-03, tras grill de 12 preguntas con la respuesta recomendada).
> Ver ADR-034. El salto de REQ-049…REQ-054 es intencional: son del Hito 8 (citas), en paralelo.
> Alguien compra en la barbería una tarjeta por un valor en pesos para regalarla; quien la recibe la
> usa como medio de pago, en una o varias visitas, durante un año.

### REQ-055 · Vender una tarjeta de regalo — M
**Como** dueño, **quiero** vender tarjetas de regalo en la caja, **para** que los clientes regalen
un corte y la plata quede registrada.

- REQ-055.1 Solo el dueño DEBE poder vender una tarjeta, desde "Tarjetas de regalo" en `/admin`, con
  un valor libre en pesos entre $ 10.000 y $ 500.000, en miles exactos.
- REQ-055.2 CUANDO el dueño vende una tarjeta, EL SISTEMA DEBE crear una venta de "Tarjeta de
  regalo" con los medios de pago de la caja (REQ-023.1), sin barbero y sin comisión, que entra
  completa como ingreso del negocio ese día.
- REQ-055.3 El dueño DEBE escribir el nombre y el celular de quien compra (si el celular no tiene
  ficha, EL SISTEMA DEBE crearla) y PUEDE escribir el nombre de pila de quien la recibe ("Para").
- REQ-055.4 Cada tarjeta DEBE tener un código de 8 caracteres, único en el negocio, con letras y
  números que no se confunden (sin `0`, `O`, `1`, `I`, `L`), y un enlace con un token no adivinable,
  distinto del código.
- REQ-055.5 La tarjeta DEBE vencer **un año** después del día de la venta (Bogotá), el mismo día y
  mes del año siguiente, incluido ese día. Usarla en partes no alarga el plazo.
- REQ-055.6 La tarjeta DEBE ser al portador: la puede usar cualquiera que tenga el código.

### REQ-056 · Entregar la tarjeta — M
**Como** comprador, **quiero** recibir la tarjeta en el celular, **para** reenviarla o mostrarla.

- REQ-056.1 CUANDO se vende una tarjeta, la pantalla DEBE ofrecer un botón de WhatsApp (`wa.me`, al
  celular del comprador) con un texto editable (REQ-033) que lleva el valor, el enlace y la fecha de
  vencimiento.
- REQ-056.2 El enlace DEBE abrir una página pública de la tarjeta, sin cuenta, con el nombre del
  negocio, "Para" (si lo hay), el código, el saldo, la fecha de vencimiento y las condiciones de uso
  (al portador, se usa en partes, no se devuelve en efectivo, vence el <día>).
- REQ-056.3 La página pública NO DEBE mostrar el nombre ni el celular del comprador, ni en qué se
  gastó el saldo.
- REQ-056.4 El dueño DEBE poder volver a abrir el botón de WhatsApp de cualquier tarjeta vigente.

### REQ-057 · Pagar con la tarjeta en el cobro — M
**Como** barbero, **quiero** cobrar con la tarjeta de regalo, **para** que el cliente no tenga que
pagar en plata lo que ya le regalaron.

- REQ-057.1 El panel de cobro (con turno o en "Nueva venta") DEBE ofrecer el medio de pago "Tarjeta
  de regalo"; al escribir el código, EL SISTEMA DEBE mostrar el saldo y el vencimiento.
- REQ-057.2 SI el código no existe en el negocio, la tarjeta está vencida, anulada o sin saldo,
  ENTONCES EL SISTEMA DEBE rechazar el pago con un mensaje claro y no registrar la venta.
- REQ-057.3 El pago con la tarjeta DEBE ser como máximo su saldo; SI el cobro vale más, ENTONCES el
  resto se paga con otro medio (REQ-023.5). Una venta lleva a lo sumo una tarjeta.
- REQ-057.4 El barbero y el dueño DEBEN poder cobrar con la tarjeta.
- REQ-057.5 La comisión del barbero DEBE calcularse como en cualquier venta (§5.1 y §13.4): el medio
  de pago no la cambia.
- REQ-057.6 La tarjeta DEBE poder pagar lo que queda después de la membresía, el premio de
  fidelidad o un descuento: es un medio de pago, no un beneficio (REQ-047.5 no aplica).
- REQ-057.7 Con la tarjeta NO DEBE pagarse otra tarjeta de regalo ni la cuota de la membresía.
- REQ-057.8 CUANDO dos cobros usan la misma tarjeta a la vez, EL SISTEMA NO DEBE gastar más que el
  saldo.

### REQ-058 · Anular y vencer — M
**Como** dueño, **quiero** reglas claras para anular, **para** que el saldo siempre cuadre.

- REQ-058.1 El dueño DEBE poder anular la venta de una tarjeta con las reglas de REQ-026 (solo del
  día, con motivo) y solo si la tarjeta no se ha usado; al anularla, la tarjeta queda anulada.
- REQ-058.2 CUANDO se anula una venta pagada con una tarjeta, EL SISTEMA DEBE devolver ese pago al
  saldo de la tarjeta.
- REQ-058.3 El saldo NO DEBE devolverse en efectivo ni pasarse a otra tarjeta.
- REQ-058.4 CUANDO la tarjeta vence, el saldo que quede DEBE perderse y la página pública DEBE decir
  "Vencida".

### REQ-059 · Lo que ve el dueño — M
**Como** dueño, **quiero** ver cuánto vendí y cuánto debo en tarjetas, **para** que la caja cuadre.

- REQ-059.1 El cierre del día (REQ-027) y el resumen semanal (REQ-028) DEBEN mostrar aparte
  "Tarjetas de regalo vendidas" (valor) y "Pagado con tarjeta de regalo" (valor).
- REQ-059.2 Lo pagado con tarjeta NO DEBE contar en el efectivo esperado ni como plata que entró ese
  día; el cierre DEBE mostrar "Entró en plata" = total vendido − pagado con tarjeta.
- REQ-059.3 "Tarjetas de regalo" DEBE listar las tarjetas con código, "Para", valor, saldo,
  vencimiento y estado (vigente, agotada, vencida, anulada), y el total "Saldo por usar" de las
  vigentes.
- REQ-059.4 El aviso de privacidad por defecto DEBE decir que se guarda el nombre y el celular de
  quien compra una tarjeta para enviársela; se publica con el mecanismo de REQ-002.5.

Fuera de alcance del Hito 9: venta o pago en línea, tarjetas por servicio ("un corte"), montos fijos,
recargar una tarjeta, bloquear una tarjeta perdida, devolver saldo en efectivo, envío automático por
WhatsApp, tarjetas impresas con diseño y recordatorio de vencimiento.

---

## 5h. Hito 11 — Limpieza y bioseguridad

> Estado: **APROBADA** (Henry, 2026-11-04, tras grill de 21 preguntas con la respuesta recomendada;
> PR #73). Ver ADR-037. Los números saltan: REQ-060…064 son del Hito 11; el Hito 10 (IA en
> WhatsApp) está reservado y el 12 y el 13 se escriben en paralelo. El control de limpieza es
> interno: el cliente no ve nada. No hay horario por barbero ni niveles (Henry, 2026-11-04).

### REQ-060 · Encender el módulo y editar las listas — M
**Como** dueño, **quiero** listas de limpieza a la medida de mi barbería, **para** que todos
limpien lo mismo.

- REQ-060.1 El dueño DEBE poder encender y apagar "Limpieza activada" en `/admin`. Viene apagada;
  MIENTRAS esté apagada, NO DEBE salir ningún aviso, botón ni pantalla de limpieza.
- REQ-060.2 CUANDO el dueño la enciende por primera vez, EL SISTEMA DEBE crear cuatro listas con los
  puntos por defecto: Apertura (6), Cierre (8), Limpieza profunda (4) y Entre clientes (7).
- REQ-060.3 El dueño DEBE poder agregar, renombrar, quitar y ordenar los puntos de cada lista (de 1
  a 80 caracteres, mínimo un punto por lista).
- REQ-060.4 Cada registro y cada revisión DEBEN guardar los puntos como estaban al enviarse;
  CUANDO el dueño cambia una lista, los registros anteriores NO DEBEN cambiar.
- REQ-060.5 SI la lista cambió mientras alguien la llenaba, ENTONCES EL SISTEMA DEBE rechazar el
  envío con "La lista cambió. Vuelve a abrirla" y no guardar nada.

### REQ-061 · Registrar apertura, cierre y limpieza profunda — M
**Como** barbero, **quiero** marcar la lista de limpieza en el celular, **para** dejar constancia
de que el local quedó listo.

- REQ-061.1 Cualquier barbero activo con sesión, o el dueño, DEBE poder registrar la apertura, el
  cierre y la limpieza profunda; EL SISTEMA DEBE guardar quién y a qué hora. Nadie las asigna.
- REQ-061.2 DEBE haber a lo sumo una apertura y un cierre por día (Bogotá) y una profunda por
  semana (lunes a domingo); SI ya existe, ENTONCES EL SISTEMA DEBE mostrar quién la registró y a
  qué hora ("La apertura de hoy ya la registró Carlos a las 9:05 a. m.") y no guardar otra.
- REQ-061.3 Se PUEDE enviar con puntos sin marcar, pero cada punto sin marcar DEBE llevar una nota
  (1 a 200 caracteres); el registro queda "Incompleto".
- REQ-061.4 El cierre DEBE llevar exactamente una foto; sin foto NO DEBE enviarse. La apertura y la
  profunda PUEDEN llevar hasta 3 fotos.
- REQ-061.5 Las fotos DEBEN tomarse con la cámara del celular y reducirse antes de subir como en
  REQ-039.4; antes de la cámara DEBE salir "Toma la foto del local vacío, sin personas".
- REQ-061.6 SI una foto no sube, ENTONCES EL SISTEMA DEBE mostrar "No se pudo subir la foto. Intenta
  de nuevo", no enviar el registro y conservar lo marcado y las notas.
- REQ-061.7 Un barbero DEBE poder registrar el cierre solo desde 1 hora antes de la hora de cierre
  del día hasta la medianoche; antes, EL SISTEMA DEBE mostrar "El cierre se registra desde las
  <hora>". El dueño PUEDE registrarlo a cualquier hora del día.
- REQ-061.8 CUANDO la apertura se registra más de 30 minutos después de la hora de apertura del día,
  EL SISTEMA DEBE marcarla "Tarde".
- REQ-061.9 Un registro enviado NO DEBE poder editarse ni borrarse, ni por el dueño.
- REQ-061.10 El cierre de un día NO DEBE poder registrarse después de la medianoche de ese día.
- REQ-061.11 El barbero DEBE ver en "Limpieza" qué registros de hoy y de esta semana ya se hicieron,
  quién y a qué hora, pero no las revisiones del dueño (REQ-063.4).

### REQ-062 · Avisos dentro de TurnOS — M
**Como** dueño, **quiero** saber sin preguntar si se abrió y se cerró bien, **para** no tener que
estar encima.

- REQ-062.1 MIENTRAS el negocio abre hoy, ya pasó la hora de apertura y no hay apertura registrada,
  EL SISTEMA DEBE mostrar "Apertura pendiente" arriba de la fila del barbero, con un toque que lleva
  a la lista, y en el panel del dueño. Los días que el horario o el dueño marcan cerrados NO DEBE
  salir.
- REQ-062.2 El aviso de apertura NO DEBE impedir llamar ni atender clientes.
- REQ-062.3 SI ayer el negocio abrió y no se registró el cierre, ENTONCES el cierre DEBE quedar "Sin
  registrar" y el panel del dueño DEBE mostrar "Cierre sin registrar" con la fecha, hasta que el
  dueño lo marque como visto (con nota opcional de hasta 200 caracteres). Los barberos NO DEBEN
  ver este aviso.
- REQ-062.4 MIENTRAS la semana no tenga profunda, el panel del dueño DEBE mostrar "Profunda pendiente
  esta semana"; CUANDO termina el domingo sin profunda, la semana DEBE quedar "Sin profunda".
- REQ-062.5 El panel del dueño DEBE resaltar los registros "Incompleto" y las aperturas "Tarde" de
  los últimos 7 días, con sus notas.
- REQ-062.6 La pantalla de fila del barbero DEBE tener el botón "Limpieza"; el dueño DEBE tener
  "Limpieza" en `/admin`.
- REQ-062.7 Los avisos de limpieza NO DEBEN enviarse por WhatsApp ni por ningún canal fuera de
  TurnOS.
- REQ-062.8 Los avisos y el "Sin registrar" DEBEN contar solo desde el día en que se encendió el
  módulo.

### REQ-063 · Revisión del dueño e historial — M
**Como** dueño, **quiero** revisar por sorpresa y ver el historial, **para** saber quién cumple
sin depender de lo que cada uno marca.

- REQ-063.1 El dueño DEBE poder hacer una revisión cuando quiera, varias por día, con la lista de
  Cierre más el grupo "Estaciones entre clientes" (los puntos de la lista Entre clientes).
- REQ-063.2 Cada punto de la revisión DEBE quedar "Bien" o "Falla", con nota y una foto opcionales;
  sin calificar todos los puntos NO DEBE enviarse.
- REQ-063.3 Una falla PUEDE asignarse a un barbero activo; si no se asigna, es una falla general.
- REQ-063.4 Las revisiones, las fallas y el historial DEBEN verse solo por el dueño.
- REQ-063.5 El historial DEBE mostrar, por semana (lunes a domingo, las últimas 8 por defecto) y por
  barbero, los registros completos, incompletos y tarde, las fallas asignadas, los cierres "Sin
  registrar" y si hubo profunda.
- REQ-063.6 Cada registro y revisión del historial DEBE abrirse con sus puntos, notas, quién y a qué
  hora, y sus fotos mientras existan.
- REQ-063.7 EL SISTEMA NO DEBE calcular niveles, puntajes ni consecuencias a partir del historial.

### REQ-064 · Tareas periódicas, fotos privadas y retención — M
**Como** dueño, **quiero** acordarme del mantenimiento y guardar los certificados, **para** estar
al día ante la Secretaría de Salud.

- REQ-064.1 Solo el dueño DEBE poder crear, editar, desactivar y registrar tareas periódicas, cada
  una con nombre (1 a 80 caracteres) y frecuencia en días (1 a 730). Empiezan vacías; EL SISTEMA
  DEBE sugerir "Aire acondicionado" (30), "Botiquín" (30) y "Control de plagas" (180) con un toque
  para agregarlas.
- REQ-064.2 Registrar una tarea DEBE guardar la fecha (hoy o anterior), una nota opcional y un
  adjunto opcional; cada vez queda en el historial de la tarea y la anterior no se reemplaza.
- REQ-064.3 El adjunto DEBE ser una foto (reducida como REQ-039.4) o un PDF de hasta 5 MB; otro
  archivo DEBE rechazarse con "Sube una foto o un PDF".
- REQ-064.4 El próximo vencimiento DEBE ser la última fecha + la frecuencia; una tarea sin registros
  está vencida. El panel del dueño DEBE mostrar las vencidas y las que vencen en los próximos 7 días.
- REQ-064.5 Las fotos y adjuntos de limpieza DEBEN guardarse en un almacenamiento privado: solo los
  ve personal del negocio con sesión (las de revisiones y tareas, solo el dueño), nunca el público.
- REQ-064.6 Las fotos de los registros y de las revisiones DEBEN borrarse solas a los 90 días;
  desde ese día el registro DEBE mostrar "Foto borrada (más de 90 días)". Los registros, las notas y
  los adjuntos de las tareas periódicas NO DEBEN borrarse.

Fuera de alcance del Hito 11: registrar la limpieza entre clientes, asignar o rotar la limpieza,
horario por barbero, niveles o sanciones, avisos por WhatsApp o notificaciones push, modo sin
conexión, inventario de insumos de limpieza (va en el Hito 13) e informes para la Secretaría de Salud.

---

## 5i. Hito 12 — Punto de venta de productos con comisión

> Estado: **APROBADA** (Henry, 2026-11-04, tras grill de 7 preguntas con la respuesta recomendada y
> abogado del diablo sin cambios; PR #75). Ver ADR-038. Los números saltan: REQ-060…064
> son del Hito 11 (limpieza) y REQ-070…074 del Hito 13 (inventario), en paralelo. El dueño o el
> barbero venden los productos de la vitrina (cera, aceite de barba, after shave, helados, bebidas)
> desde una pantalla con fotos; los productos marcados dejan un porcentaje al barbero de la venta.
> Cambia PA-17 y REQ-024.3. Hito construido y aprobado por Henry el 2026-11-05 (ADR-040).

### REQ-065 · Configurar la comisión y la vitrina — M
**Como** dueño, **quiero** decidir qué productos dejan comisión y cuánto, **para** premiar al barbero
que vende la vitrina.

- REQ-065.1 El negocio DEBE tener un "% de comisión por productos" (entero 0–100, **10** por
  defecto) que el dueño cambia en "Negocio". Es uno solo para todos los productos que dan comisión.
- REQ-065.2 Cada producto DEBE tener la casilla "Da comisión al que vende" (apagada por defecto); el
  dueño la cambia en "Productos".
- REQ-065.3 Cada producto PUEDE tener una categoría de texto libre (1 a 30 caracteres, por ejemplo
  "Vitrina", "Bebidas", "Helados"); sin categoría queda solo en "Todos".
- REQ-065.4 CUANDO el dueño cambia el % de comisión por productos o el % de descuento de empleado
  (REQ-068.1), EL SISTEMA DEBE aplicarlo solo a ventas posteriores y guardar el historial (fecha,
  quién, valor anterior y nuevo), como REQ-025.3.
- REQ-065.5 CUANDO el dueño cambia la casilla de un producto, las ventas ya registradas NO DEBEN
  cambiar su comisión.

### REQ-066 · Vender en la vitrina — M
**Como** dueño o barbero, **quiero** vender productos tocando su foto, **para** registrar la venta
rápido y que quede a nombre de quien la hizo.

- REQ-066.1 "Nueva venta" DEBE mostrar la vitrina: los productos activos y a la venta en cuadros con
  foto (o el nombre si no tiene), nombre, precio y botones + y −, y el total. Los productos de
  cortesía que no están a la venta NO DEBEN salir.
- REQ-066.2 SI al menos un producto activo y a la venta tiene categoría, ENTONCES la vitrina DEBE
  mostrar pestañas: "Todos" y una por categoría (orden alfabético); si ninguno tiene, no hay
  pestañas.
- REQ-066.3 CUANDO el dueño registra una venta de productos, EL SISTEMA DEBE pedir "¿Quién vendió?"
  con los barberos activos y "Nadie (el negocio)", sin opción escogida por defecto, y NO DEBE dejar
  confirmar hasta que escoja una.
- REQ-066.4 CUANDO un barbero registra una venta de productos, EL SISTEMA DEBE dejarla a su nombre
  sin preguntar; un barbero NO DEBE poder registrarla a nombre de otro (REQ-023.7).
- REQ-066.5 El panel de cobro del turno (REQ-023.2) DEBE usar la misma vitrina para agregar
  productos; esos productos quedan en la misma venta, a nombre del barbero del turno.
- REQ-066.6 Cada línea de producto de la venta DEBE guardar el producto (`ref_id`) y la cantidad
  (`qty`), como hasta ahora: de ahí descuenta la vitrina el Hito 13.

### REQ-067 · Comisión por productos — M
**Como** barbero, **quiero** ganar un porcentaje de lo que vendo de la vitrina, **para** tener por
qué recomendarla.

- REQ-067.1 CUANDO se crea una venta con barbero, EL SISTEMA DEBE calcular
  `comision_productos = redondear(Σ precio × cantidad de las líneas de productos que dan comisión ×
  % de productos / 100)`, con un solo redondeo por venta al peso más cercano (.5 hacia arriba).
- REQ-067.2 La venta DEBE guardar el % de productos, la base y la comisión de productos, aparte de la
  de servicios; y cada línea de producto DEBE guardar si dio comisión. Cambios posteriores no la
  alteran.
- REQ-067.3 Una venta con "Nadie (el negocio)" o sin barbero DEBE tener comisión de productos 0.
- REQ-067.4 La comisión de productos NO DEBE cambiar por el medio de pago, la membresía, el premio de
  fidelidad ni el descuento de servicios: se calcula solo con las líneas de productos.
- REQ-067.5 La comisión de productos la asume el negocio: el total que paga el cliente no cambia.

### REQ-068 · Compra de un barbero — M
**Como** dueño, **quiero** venderle productos a un barbero con descuento, **para** que los use él
sin que cuente como venta con comisión.

- REQ-068.1 El negocio DEBE tener un "% de descuento de empleado" (entero 0–100, **20** por
  defecto) que el dueño cambia en "Negocio".
- REQ-068.2 SI el % de descuento de empleado es mayor que 0, ENTONCES "Nueva venta" del dueño DEBE
  mostrar el interruptor "Compra de un barbero"; al prenderlo, el dueño escoge qué barbero compra (en
  vez de "¿Quién vendió?"). Solo el dueño DEBE poder registrarla.
- REQ-068.3 En una compra de un barbero, EL SISTEMA DEBE descontar a cada línea
  `redondear(precio × cantidad × % de descuento / 100)` (al peso, .5 hacia arriba) y aceptar solo
  productos (ni servicios, ni cuotas de membresía, ni tarjetas de regalo).
- REQ-068.4 Una compra de un barbero NO DEBE generar comisión para nadie y se paga con los medios de
  la caja en ese momento; no se descuenta de la liquidación.
- REQ-068.5 La compra de un barbero NO DEBE contar como venta de ese barbero en el cierre, la semana
  ni "Mis números".

### REQ-069 · Anular y ver la comisión de productos — M
**Como** dueño y barbero, **queremos** ver la comisión de productos aparte, **para** llegar al
mismo número a mano.

- REQ-069.1 Anular una venta con productos DEBE seguir las reglas de REQ-026 y sacar también su
  comisión de productos de los totales.
- REQ-069.2 La Caja de hoy y el cierre (REQ-027.1, REQ-027.6) DEBEN mostrar, por barbero, servicios y
  productos en renglones aparte y el total a pagar: "Juan: 8 servicios, $ 240.000 vendidos,
  comisión 60 % = $ 144.000 · productos $ 60.000, comisión 10 % = $ 6.000 · total a pagar
  $ 150.000". El renglón de productos sale solo si el barbero vendió productos que dan comisión.
- REQ-069.3 El cierre DEBE mostrar "Compras de barberos $ X (descuento $ Y)" si hubo alguna; las
  ventas "Nadie (el negocio)" y las compras de barberos cuentan en el total de productos.
- REQ-069.4 El resumen semanal (REQ-028.1) DEBE mostrar por barbero la comisión de servicios, la de
  productos y el total.
- REQ-069.5 "Mis números" del barbero (REQ-025.5, REQ-029.1) DEBE mostrar la comisión de productos
  del día y de la semana aparte de la de servicios, y el total, solo de lo suyo.

Fuera de alcance del Hito 12: un % por producto, un barbero distinto por línea en la misma venta,
descuentos en productos fuera de la compra de un barbero, descontar compras de la liquidación
(fiado), topes de compras de barberos, metas o niveles de comisión, stock e inventario (Hito 13) y
lectores de código de barras.

---

## 5j. Hito 13 — Inventario de insumos y vitrina

> Estado: **APROBADA** (Henry, 2026-11-04, tras grill de 20 preguntas con la respuesta
> recomendada; PR #72). Ver ADR-039. Los números saltan: REQ-060…064 son del Hito 11 (limpieza) y
> REQ-065…069 del Hito 12 (punto de venta), en paralelo. La venta de productos (vitrina, comisión,
> descuento de empleado) es del Hito 12; este hito solo lleva el stock.
> Plan operativo de Filo: cada barbero tiene una **estación** con una dotación fija de la casa; la
> bodega la maneja solo el dueño; se repone **envase vacío por envase lleno**; cada lunes se cuenta la
> estación y se compara con lo que debieron gastar sus servicios; una vez al mes se cuenta la bodega.

### REQ-070 · Catálogo de inventario y ubicaciones — M
**Como** dueño, **quiero** un catálogo de insumos y productos con dónde está cada uno, **para**
controlar lo que es de la barbería.

- REQ-070.1 El dueño DEBE poder crear, editar y desactivar ítems de inventario con: nombre,
  grupo (Bioseguridad, Afeitado y barba, Acabado, Lavado y comodidad, Cuidado de máquinas,
  Faciales, Manicure, Mujer y químicos, Productos para la venta), uso ("Uso interno" o "Para la
  venta"), presentación (texto, ej. "Frasco 150 g"), unidad de conteo (ej. "frasco"), precio por
  unidad (COP entero ≥ 0), proveedor (texto, opcional), mínimo y máximo de bodega (enteros, mínimo ≤
  máximo) y, si es de uso interno, la cantidad de la dotación por estación (entero ≥ 0).
- REQ-070.2 Un ítem "Para la venta" DEBE poder enlazarse con un único producto de la caja
  (REQ-024) y tener un mínimo de vitrina; un ítem de uso interno NO DEBE enlazarse con un producto.
- REQ-070.3 Cada negocio DEBE tener una **Bodega**, una **Vitrina** y una **Estación** por cada
  barbero activo ("Estación de Juan"); la estación se crea al crear o activar al barbero y es del
  barbero, no de la silla.
- REQ-070.4 La **dotación** DEBE ser la misma para todas las estaciones: la suma de los ítems de uso
  interno con dotación mayor que 0.
- REQ-070.5 Todas las cantidades DEBEN ser unidades enteras de la presentación; un envase abierto
  cuenta como 1 hasta que se entrega vacío.
- REQ-070.6 SI un ítem se desactiva, ENTONCES EL SISTEMA DEBE sacarlo de la dotación, los conteos
  nuevos y la orden de compra, y conservar su historial.

### REQ-071 · Entradas, transferencias y reposición — M
**Como** dueño, **quiero** registrar lo que entra y lo que muevo, **para** saber cuánto hay en cada
sitio sin contar a cada rato.

- REQ-071.1 El stock de un ítem en un sitio DEBE calcularse a partir de sus movimientos; los
  movimientos son inmutables (no se editan ni se borran) y guardan quién, cuándo, el ítem, la
  cantidad, el origen y el destino.
- REQ-071.2 CUANDO el dueño registra una **entrada a bodega** (ítem, cantidad y precio pagado por
  unidad), EL SISTEMA DEBE sumar a la bodega y actualizar el precio por unidad del ítem.
- REQ-071.3 El dueño DEBE poder **transferir** entre bodega y vitrina (en los dos sentidos), de
  bodega a una estación hasta completar la dotación, y de una estación a la bodega.
- REQ-071.4 CUANDO el dueño registra una **reposición** (barbero, ítem, cantidad), EL SISTEMA DEBE
  exigir la casilla "Recibí el envase vacío" y registrar el consumo de lo vacío en la estación y la
  transferencia de lo lleno de bodega a la estación por la misma cantidad.
- REQ-071.5 SI una transferencia o reposición pide más de lo que hay en el origen, o deja la
  estación por encima de la dotación, ENTONCES EL SISTEMA DEBE rechazarla con un mensaje claro.
- REQ-071.6 Solo el dueño DEBE poder registrar entradas, transferencias, reposiciones, conteos y
  cambios del catálogo.

### REQ-072 · Vitrina y caja — M
**Como** dueño, **quiero** que lo que se vende en caja salga de la vitrina solo, **para** no
registrarlo dos veces.

- REQ-072.1 CUANDO se crea una venta con una línea de producto enlazado a un ítem (REQ-070.2), EL
  SISTEMA DEBE descontar esa cantidad de la vitrina.
- REQ-072.2 CUANDO una venta pasa a anulada, EL SISTEMA DEBE devolver a la vitrina lo que esa venta
  descontó, una sola vez, aunque se intente anular de nuevo; otros cambios de la venta NO DEBEN
  mover stock.
- REQ-072.3 La caja NUNCA DEBE bloquearse por inventario: SI se vende un producto sin stock en la
  vitrina, ENTONCES el stock queda negativo y se muestra en rojo para revisarlo en el conteo.
- REQ-072.4 CUANDO se marca servida una bebida de cortesía (REQ-038) cuyo producto está enlazado a
  un ítem, EL SISTEMA DEBE descontarla de la vitrina como en REQ-072.1.
- REQ-072.5 CUANDO la vitrina de un ítem queda en su mínimo o por debajo, el panel del dueño DEBE
  mostrar "Surtir vitrina" con lo que falta para llegar al mínimo.

### REQ-073 · Consumo esperado y conteos — M
**Como** dueño, **quiero** comparar lo que gasta cada estación con lo que debió gastar, **para**
revisar a tiempo con el barbero.

- REQ-073.1 Para cada ítem de uso interno, el dueño DEBE poder escoger qué servicios lo gastan y,
  por cada uno, el **rendimiento** (cuántos servicios alcanza una unidad, entero ≥ 1) o dejarlo
  "Midiendo".
- REQ-073.2 El consumo esperado de una estación en una ventana DEBE ser, por ítem, Σ (servicios de
  ese barbero en la ventana ÷ rendimiento), contando las líneas de servicio de sus ventas no
  anuladas de la caja (con o sin turno, con membresía o premio).
- REQ-073.3 CUANDO el dueño registra el **conteo semanal** de una estación, EL SISTEMA DEBE tomar
  como ventana el tiempo desde el conteo anterior de esa estación y calcular, por ítem, el consumo
  real (envases vacíos de las reposiciones + diferencia entre el stock calculado y lo contado) y el
  esperado; la diferencia del conteo queda como consumo.
- REQ-073.4 SI el consumo real de un ítem supera el esperado en más del porcentaje de alerta del
  negocio (10 % por defecto, configurable entre 1 y 100) y en al menos una unidad entera, ENTONCES
  EL SISTEMA DEBE marcarlo en rojo en el panel del dueño con "Revisar con <barbero>". Un ítem en
  "Midiendo" no genera alerta.
- REQ-073.5 CUANDO un ítem en "Midiendo" tiene 4 o más conteos semanales con consumo, EL SISTEMA
  DEBE sugerir un rendimiento (servicios ÷ consumo real de esas ventanas, redondeado hacia abajo, al
  menos 1) que el dueño acepta o cambia.
- REQ-073.6 El dueño DEBE poder registrar el **conteo mensual** de la bodega y la vitrina; cada
  diferencia DEBE quedar como ajuste con motivo (Vencido, Dañado, Faltante, Sobrante, Otro) y el
  stock queda igual a lo contado. El primer conteo de cada sitio es el inicial y no pide motivo.
- REQ-073.7 CUANDO un barbero se desactiva, su estación DEBE quedar "Por cerrar" hasta que el dueño
  la cuente: lo contado vuelve a la bodega y la diferencia queda como consumo; después la estación
  queda cerrada con su historial.

### REQ-074 · Compras, costo por servicio y quién ve qué — M
**Como** dueño, **quiero** saber qué comprar y cuánto me cuestan los insumos de cada servicio,
**para** comprar a tiempo y cobrar bien.

- REQ-074.1 CUANDO el dueño abre "Orden de compra", EL SISTEMA DEBE listar los ítems activos cuyo
  stock de bodega + vitrina está en el mínimo o por debajo, con cantidad sugerida = máximo − (bodega
  + vitrina), agrupados por proveedor, con el valor estimado (cantidad × precio por unidad).
- REQ-074.2 La orden DEBE poder compartirse por WhatsApp como texto plano prellenado; no hay compra
  en línea.
- REQ-074.3 El reporte "Costo de insumos por servicio" DEBE mostrar, por servicio activo, Σ (precio
  por unidad ÷ rendimiento) de sus ítems, redondeado al peso, y marcar "Incompleto" si alguno está
  en "Midiendo".
- REQ-074.4 El barbero DEBE ver en "Mi estación" su dotación, el stock de su estación, sus
  reposiciones y el resultado de su último conteo, solo en lectura; NO DEBE ver la bodega, la
  vitrina, los precios ni las estaciones de otros.
- REQ-074.5 Ningún dato de inventario DEBE ser accesible sin cuenta (`anon`).

Fuera de alcance del Hito 13: la venta de productos, su comisión y el descuento de empleado (Hito
12); compras en línea o pedidos al proveedor desde la app; varios proveedores o precios por ítem;
lotes y fechas de vencimiento; códigos de barras; la fecha de apertura del sticker "uso interno";
dotación distinta por barbero; conteos hechos por el barbero; alertas por WhatsApp; recordatorio
automático del conteo o de la compra cada 15 días; margen de la vitrina.

---

## 5k. Hito 14 — Rendimiento percibido y medición

> Estado: **APROBADA** (Henry, 2026-11-06, PR #109). Ver ADR-043. Sale de revisar
> TurnOS contra una lista de 31 optimizaciones: la mayoría ya se cumple o no aplica a este tamaño
> (ADR-043). Quedan dos huecos: no hay pantallas de carga (en 4G se ve en blanco hasta que llega el
> servidor) y no se mide la velocidad de los celulares reales (NFR-001 hoy solo se prueba con
> Lighthouse en el CI). Este hito cambia además el texto de NFR-005: Henry eligió medir con Speed
> Insights anónimo (2026-11-06, ADR-043).

### REQ-075 · Pantallas de carga y velocidad real — M
**Como** cliente o barbero con datos lentos, **quiero** ver de inmediato la forma de la pantalla
mientras llegan los datos, **para** saber que la app respondió y no tocar dos veces.

- REQ-075.1 CUANDO se abre o se navega a la página pública del negocio (`/[slug]`), "Mi turno"
  (`/t/[token]`), "Mi fila" del barbero (`/app/fila`), la fila del dueño (`/admin/fila`) o la Caja de
  hoy (`/admin/caja`) y los datos aún no llegan, EL SISTEMA DEBE mostrar un esqueleto con la forma de
  esa pantalla (bloques grises en el lugar del contenido) en vez de una pantalla en blanco o un
  spinner. Esto aplica también al abrir el link directo, no solo al moverse dentro de la app.
- REQ-075.2 El esqueleto NO DEBE mostrar datos, cifras ni nombres de ejemplo; DEBE anunciar "Cargando…"
  a lectores de pantalla (`aria-busy`) y NO DEBE animarse si el celular pide menos movimiento
  (`prefers-reduced-motion`).
- REQ-075.3 MIENTRAS la app corre en producción, EL SISTEMA DEBE registrar las métricas de velocidad
  de los usuarios reales (LCP, INP, CLS) por ruta, para revisar NFR-001 con datos de campo.
- REQ-075.4 La medición NO DEBE usar cookies ni identificadores del visitante; las rutas con token
  (`/t/…`, `/c/…`, `/regalo/…`, `/invitacion/…`) DEBEN reportarse con el patrón (`/t/[token]`), nunca
  con el token, y la URL reportada NO DEBE llevar parámetros de consulta (`?…`) ni fragmento (`#…`)
  (NFR-005).

Fuera de alcance del Hito 14: actualizar la fila en pantalla antes de que confirme el servidor
("optimistic UI", REQ-011.3 lo prohíbe a propósito, ADR-043); colas de trabajos, Redis, CDN propia o
balanceador; trazas con OpenTelemetry; paginar listas que ya tienen tope (búsqueda de clientes 30/50,
historial 200).

## 5l. Hito 15 — Inicio "Hoy" del dueño

> Estado: **APROBADA** (Henry, 2026-11-06). Ver ADR-046. PA-H15-1 resuelta: día completo. Sale del rediseño visual
> (`docs/diseno/prompt-diseno.md`): hoy el dueño entra directo a la fila (design §6.1) y para ver la
> caja, las citas, la limpieza o el inventario tiene que abrir cada módulo. Con 19 módulos en chips
> desplazables, lo urgente se pierde. Este hito agrega una pantalla de monitoreo y ordena el menú.
> No agrega datos nuevos: todo sale de funciones que ya existen.

### REQ-076 · Inicio "Hoy" — M
**Como** dueño, **quiero** ver en una sola pantalla cómo va el negocio ahora mismo y qué necesita mi
atención, **para** no tener que abrir módulo por módulo.

- REQ-076.1 CUANDO el dueño abre `/admin`, EL SISTEMA DEBE mostrar la pantalla "Hoy" en vez de
  llevarlo a la fila. Un barbero que abra `/admin` sigue yendo a `/app` (REQ-030).
- REQ-076.2 "Hoy" DEBE mostrar la **fila en vivo**: cuántos esperan, el tiempo estimado del próximo
  turno y, por cada barbero activo, su estado: "Libre", "Atendiendo a Juan P. desde hace 12 min",
  "En pausa" o "No vino hoy". Los nombres van cortos (`short_name`); NO DEBEN aparecer celulares.
- REQ-076.3 CUANDO la fila o la caja cambian, "Hoy" DEBE actualizarse en < 3 s sin recargar (mismo
  canal y relectura que la fila, ADR-008; NFR-002).
- REQ-076.4 "Hoy" DEBE mostrar la **caja de hoy**: total cobrado, total por medio de pago, ventas de
  vitrina y número de servicios terminados, con las mismas cifras de la Caja de hoy (REQ-027.1).
  Junto al total DEBE mostrar el total del **mismo día de la semana pasada** (PA-H15-1).
- REQ-076.5 "Hoy" DEBE mostrar las **citas de hoy**: cuántas quedan, las próximas 3 con hora, barbero
  y servicio, y cuáles ya llegaron. SI el módulo de citas está apagado, el bloque NO DEBE aparecer.
- REQ-076.6 "Hoy" DEBE mostrar la lista de **alertas que piden acción**, cada una con un enlace al
  módulo donde se resuelve, en este orden:
  1. Caja de un día anterior con ventas y sin cerrar (REQ-027).
  2. Limpieza: apertura pendiente, registros "Incompleto" o "Tarde" y profunda pendiente de la semana
     (REQ-062.1, REQ-062.4, REQ-062.5).
  3. Inventario: ítems en alerta de existencias o de consumo (REQ-073.4).
  4. Membresías que vencen en los próximos 7 días (REQ-045).
  Un módulo apagado no genera alertas. SIN alertas, el bloque DEBE decir "Todo en orden".
- REQ-076.7 "Hoy" DEBE mostrar cuántos clientes **cumplen años esta semana** y cuántos **hace rato no
  vienen**, con enlace a "Recordar" (REQ-037, REQ-020). NO DEBE listar sus celulares.
- REQ-076.8 "Hoy" DEBE tener accesos directos a "Nueva venta", "Fila" y "Cerrar caja".
- REQ-076.9 En pantallas de 1024 px o más, "Hoy" DEBE mostrar además los **ingresos de la semana en
  curso por día** (barras simples, lunes a domingo): cada barra es el total de la Caja de ese día
  (REQ-027.1) y su suma es el "Vendido" de "Semana" (REQ-028). (Corregido 2026-11-07, ADR-048.)
- REQ-076.10 Cada bloque DEBE cargar por su cuenta: mientras llega, muestra su esqueleto (REQ-075.2);
  SI un bloque falla, ENTONCES muestra "No se pudo cargar" con "Intentar de nuevo" y los demás
  bloques DEBEN seguir visibles.
- REQ-076.11 En el celular el orden DEBE ser: alertas, fila en vivo, caja, citas, recordar.

### REQ-077 · Menú del dueño por grupos — M
**Como** dueño, **quiero** un menú corto con lo de todos los días a la mano y el resto ordenado,
**para** encontrar cada módulo sin desplazar una fila de 19 botones.

- REQ-077.1 En el celular, el dueño DEBE tener una barra inferior fija con "Hoy", "Fila", "Caja",
  "Clientes" y "Más". "Más" DEBE abrir la lista completa de módulos agrupada en **Operación**,
  **Clientes**, **Local** y **Configuración**.
- REQ-077.2 En pantallas de 1024 px o más, el dueño DEBE tener un menú lateral fijo con los mismos
  grupos y módulos.
- REQ-077.3 Los grupos DEBEN ser: Operación (Hoy, Fila, Citas, Caja, Semana); Clientes (Clientes,
  Fidelidad, Recordar, Membresías, Tarjetas de regalo); Local (Limpieza, Productos, Inventario);
  Configuración (Barberos, Servicios, Horario, QR, Mensajes, Negocio, Privacidad).
- REQ-077.4 Ningún módulo que hoy tiene acceso desde el menú DEBE quedar sin él.
- REQ-077.5 El destino actual DEBE verse marcado y anunciarse a lectores de pantalla
  (`aria-current`); cada destino DEBE medir ≥ 48 px (NFR-008).
- REQ-077.6 "Hoy" en el menú DEBE mostrar el número de alertas pendientes de REQ-076.6 cuando haya
  alguna.

Preguntas abiertas del Hito 15:
- **PA-H15-1**: la comparación de REQ-076.4, ¿contra el día completo de la semana pasada (simple, ya
  existe) o contra lo que se llevaba a esta misma hora (más justo a media mañana, necesita una
  consulta nueva)? **Resuelta (Henry, 2026-11-06): día completo**, con el texto "El jueves pasado
  (todo el día): $ X".

Fuera de alcance del Hito 15: el rediseño visual con los colores nuevos (llega cuando estén los
diseños, con su propio requisito); cambiar el menú del barbero; gráficos más allá de las barras de la
semana; alertas por WhatsApp o notificaciones push; metas de venta o comparaciones mensuales;
configurar qué bloques ve el dueño.

---

## 5m. Hito 16 — Sistema visual nuevo

> Estado: **APROBADA** (Henry, 2026-11-07). Ver ADR-047. PA-H16-1…3 resueltas con la recomendación. Sale del lienzo "TurnOS — Rediseño"
> (https://claude.ai/artifact/VK8TXA9Aw9tnZMnrXZ4kPU), hecho con `docs/diseno/prompt-diseno.md`.
> Cambia cómo se ve la app, no qué hace: mismos flujos, mismas funciones, sin migraciones.

### REQ-078 · Sistema visual nuevo — M
**Como** cliente, barbero o dueño, **quiero** que todas las pantallas se vean y se comporten igual,
con lo urgente en rojo y la acción principal en azul marino, **para** saber qué hacer de un vistazo,
también al sol y con una mano.

- REQ-078.1 Los colores de la interfaz DEBEN salir solo de los tokens de `globals.css` (design
  §22.1). Ningún componente DEBE usar colores de la paleta de Tailwind (`blue-200`, `red-50`…) ni
  valores hexadecimales sueltos.
- REQ-078.2 Cada combinación de texto y fondo definida en los tokens DEBE tener contraste ≥ 4.5:1, y
  el borde de los campos ≥ 3:1 contra la tarjeta (NFR-008).
- REQ-078.3 El rojo relleno DEBE usarse solo para "atención ahora": "¡Es tu turno!", turno llamado,
  alertas que piden acción e insignias de conteo. Las acciones destructivas (cancelar, anular,
  borrar, quitar) DEBEN verse en contorno o texto rojo y DEBEN pedir confirmación antes de actuar.
- REQ-078.4 Cada pantalla DEBE mostrar a lo más un botón principal relleno a la vez.
- REQ-078.5 Botones, casillas y destinos del menú DEBEN medir ≥ 48 px de alto; el botón principal de
  la fila del barbero ("Llamar a …", "Empezar corte", "Terminar y cobrar") DEBE medir ≥ 80 px. El
  texto base DEBE ser ≥ 16 px.
- REQ-078.6 En listas y tablas (fila del dueño, clientes, barberos, solicitudes de privacidad), el
  celular DEBE verse enmascarado con `maskPhone` (`••• ••• 0001`, solo los 4 últimos dígitos). El
  número completo solo DEBE verse en la ficha de un cliente y en el campo donde alguien escribe el
  suyo.
- REQ-078.7 Las casillas del PIN NUNCA DEBEN mostrar dígitos: un punto por cada dígito escrito.
- REQ-078.8 MIENTRAS una pantalla carga, EL SISTEMA DEBE mostrar un esqueleto con las mismas medidas
  del contenido, de modo que al llegar los datos nada se desplace (CLS ≤ 0,1).
- REQ-078.9 MIENTRAS se guarda una acción, su botón DEBE quedar deshabilitado con el texto
  "Guardando…" y la acción NO DEBE poder enviarse dos veces.
- REQ-078.10 MIENTRAS no hay conexión, las pantallas de cliente, barbero y dueño DEBEN mostrar la
  franja "Sin conexión. Mostrando lo último que vimos · <hora>" y deshabilitar las acciones que
  necesitan servidor, diciendo por qué (REQ-011).
- REQ-078.11 Una lista vacía DEBE decir qué pasa y qué hacer; un error DEBE decir qué pasó, que los
  datos no se perdieron cuando sea cierto, y ofrecer "Intentar de nuevo".
- REQ-078.12 CUANDO llega por tiempo real un turno o una venta nueva, la fila DEBE entrar con fondo
  resaltado que se desvanece en ≈ 1,2 s, sin reordenar lo que el usuario tiene bajo el dedo.
- REQ-078.13 Las animaciones DEBEN usar solo `transform` y `opacity` y durar entre 150 y 250 ms
  (salvo el desvanecido de REQ-078.12). SI el celular pide movimiento reducido, ENTONCES EL SISTEMA
  DEBE quitar los desplazamientos y dejar solo cambios de opacidad.
- REQ-078.14 La interfaz NO DEBE usar degradados, desenfoque de fondo ni fuentes descargadas: usa
  `system-ui`. Los íconos DEBEN ser SVG de trazo dentro del código.
- REQ-078.15 Cada pantalla DEBE verse sin desplazamiento horizontal en 360 px, 390 px y 1280 px; "Hoy"
  y "Caja" además en 768 px con su disposición de tablet.
- REQ-078.16 Cada pantalla DEBE seguir la estructura de su tablero: orden de los bloques, encabezado,
  listas a todo el ancho con divisores finos y lo que es principal (ADR-051). Lo que el tablero
  muestra y la app no hace no se construye; lo que la app hace y el tablero no muestra se conserva
  sin quitar el lugar de lo que el tablero sí muestra.
- REQ-078.17 CUANDO la silla del barbero está libre y hay alguien esperando, Mi fila DEBE mostrar el
  bloque "Sigue" con el número y el nombre del próximo en grande, y el botón DEBE decir "Llamar a
  <número>". SI al tocarlo el primero ya no es ese turno, ENTONCES EL SISTEMA NO DEBE llamar a nadie
  y DEBE releer la fila. Llamado: "Empezar corte" y "No vino"; en servicio: "Terminar y cobrar".
- REQ-078.18 Los cobros pendientes del barbero DEBEN verse en una sola fila "N cobros pendientes"
  que abre la lista con "Cobrar" en cada uno; NO DEBEN mover la fila de turnos.
- REQ-078.19 CUANDO el barbero termina un turno, el cobro DEBE abrirse en pantalla completa en el
  celular con "Cobrar a <nombre>" y flecha para volver, el servicio en una fila con su descuento, la
  vitrina como lista con "+ Agregar producto", los medios de pago en una rejilla de 3 columnas, y
  el total con "Cobrar $ …" fijos abajo.
- REQ-078.20 Ningún control DEBE mostrar texto propio del navegador (por ejemplo "Choose File"):
  subir una foto DEBE ser un botón en español ("Subir foto", "Tomar foto").

Se mantienen sin cambio: la casilla del aviso de privacidad antes de guardar datos (REQ-002), las
pantallas públicas sin celulares (REQ-013.2) y los textos en español colombiano (NFR-006).

Preguntas abiertas del Hito 16:
- **PA-H16-1**: ¿el Hito 15 ("Hoy" y menú) se construye después de T-160 y T-161 (tokens y
  componentes nuevos), para no hacer "Hoy" dos veces? **Resuelta (Henry, 2026-11-07): sí.**
- **PA-H16-2**: el número enorme de "Mi turno" (120 px) y la pantalla roja de "¡Es tu turno!" a
  pantalla casi completa, ¿se quedan así o quieres probarlos primero con un cliente en Filo?
  **Resuelta (Henry, 2026-11-07): se construyen así y se validan en la prueba de T-168.**
- **PA-H16-3**: ¿se guardan en el repo (`docs/diseno/tableros/`) capturas PNG de los 20 tableros para
  que el diseño no dependa del enlace del lienzo? **Resuelta (Henry, 2026-11-07): sí.**

Fuera de alcance del Hito 16: cambiar flujos, textos de negocio (salvo los del barbero, ADR-051) o funciones; modo oscuro; logo o
marca propia de TurnOS más allá del punto rojo y el nombre; ilustraciones; animaciones de celebración.

---

## 6. Requisitos no funcionales

| ID | Requisito | Criterio verificable |
|---|---|---|
| NFR-001 Rendimiento | Pantallas de cliente y barbero rápidas en móvil | LCP < 3 s en 4G simulado (Lighthouse móvil ≥ 80 en rendimiento); acciones del barbero responden < 1 s en condiciones normales |
| NFR-002 Tiempo real | Cambios de fila visibles a todos los interesados | < 3 s entre el cambio en servidor y la actualización en pantalla (prueba E2E con dos navegadores) |
| NFR-003 Disponibilidad | El negocio no para por una caída corta | Lectura de último estado sin conexión (REQ-011.6); sin dependencia de cron para la operación de la fila |
| NFR-004 Seguridad | Aislamiento por negocio y mínima exposición | RLS en el 100 % de tablas con `business_id` (REQ-031.4); tokens de "Mi turno" ≥ 128 bits aleatorios; sin `service_role` en el cliente; rate limiting en "Tomar turno" (máx. 5 por celular/hora, 30 por IP/hora) |
| NFR-005 Privacidad | Ley 1581 | Aviso versionado y aceptación registrada (REQ-002); supresión (REQ-018.6); pantallas públicas sin celulares (REQ-013.2); sin trackers de terceros en páginas públicas; la medición anónima de velocidad de REQ-075.3 no cuenta como tracker si cumple REQ-075.4 (sin cookies, sin identificadores, sin tokens; ADR-043) |
| NFR-006 Localización | Colombia | `es-CO` en toda la UI; COP sin decimales con punto de miles; `America/Bogota` en servidor y cliente; sin textos en inglés visibles (prueba de lint de textos) |
| NFR-007 Usabilidad | Sin capacitación | Prueba de pasillo: un barbero real completa llamar → en servicio → terminado → cobro sin ayuda en el primer intento; flujo del cliente ≤ 4 campos y 1 pantalla |
| NFR-008 Accesibilidad | Legible al sol y con una mano | Contraste ≥ 4.5:1; botones ≥ 48 px; tamaño de fuente base ≥ 16 px; funciona con zoom 200 % |
| NFR-009 Calidad | Pruebas trazables | Cada CA referenciado por al menos una prueba; CI bloquea merge si fallan unit, integración o E2E; cobertura de lógica de dominio (posición, tiempo, comisión, cierre) 100 % de ramas |
| NFR-010 Datos | Integridad | Montos `integer`; estados como `enum`; transiciones validadas en base de datos (no solo en UI); migraciones versionadas; seed idempotente |
| NFR-011 Escala MVP | Un negocio pequeño, varios en el futuro | Diseñado para 50 negocios × 200 turnos/día sin cambios de arquitectura; 5.000 clientes por negocio con búsqueda < 1 s |
| NFR-012 Observabilidad | Saber qué pasó | Historial de estados por turno (REQ-007.7); registro de errores del servidor; página `/salud` para verificar que app y base de datos responden |
| NFR-013 Costo | Cabe en planes gratuitos/baratos al inicio | Vercel Hobby/Pro + Supabase Free/Pro; sin servicios adicionales de pago en el MVP |

---

## 7. Casos borde consolidados

| # | Caso | Comportamiento esperado | Cubierto por |
|---|---|---|---|
| CB-01 | Cliente no llega al ser llamado | Barbero marca "No llegó"; cliente notificado; vuelve al final si retoma | REQ-008 |
| CB-02 | Cliente cancela | Desde "Mi turno"; fila se recalcula en vivo | REQ-005 |
| CB-03 | Barbero se ausenta | Pausa con decisión sobre sus clientes; conservan posición | REQ-010 |
| CB-04 | Cliente repetido en la fila | Mismo celular con turno activo → no se duplica, se muestra el existente | REQ-003.5 |
| CB-05 | Pérdida de conexión | Franja, reintento, recarga completa, acciones idempotentes | REQ-011 |
| CB-06 | Dos barberos llaman al mismo turno | Solo uno lo obtiene; el otro recibe el siguiente | REQ-007.2 |
| CB-07 | Barbero preferido en pausa o ausente | Cliente lo ve como no disponible; si ya estaba en fila, pasa a "el que esté libre" o espera | REQ-010.2, REQ-016.4 |
| CB-08 | Turnos que quedan al cerrar | Cancelados por cierre, cliente avisado | REQ-014 |
| CB-09 | Cliente llega a la hora de cierre | Advertencia antes de confirmar | REQ-017.3 |
| CB-10 | Celular inválido o con formato raro | Normalización y mensaje claro | REQ-003.2 |
| CB-11 | Cliente sin celular en el local | Dueño lo agrega manualmente sin ficha | REQ-012.3 |
| CB-12 | Cambio de precio con ventas previas | Ventas conservan precio histórico | REQ-015.3 |
| CB-13 | Terminado sin cobro | Marcado "Cobro pendiente" | REQ-023.6 |
| CB-14 | Venta equivocada | Anulación con motivo, no edición | REQ-026 |
| CB-15 | Caja cerrada y aparece una venta | Bloqueo; reapertura con motivo | REQ-027.3 |
| CB-16 | Premio de fidelidad y comisión | Comisión sobre precio de lista; negocio asume el premio | REQ-025.4 |
| CB-17 | Cliente pide borrar sus datos | Anonimización conservando montos | REQ-018.6 |
| CB-18 | Nueva versión del aviso de privacidad | Re-aceptación en el siguiente turno | REQ-002.5 |
| CB-19 | Servicio desactivado con turnos activos | Turnos existentes lo conservan | REQ-015.2 |
| CB-20 | Barbero desactivado con turnos asignados | Turnos pasan a "el que esté libre"; sesión cerrada | REQ-016.3 + REQ-010.2 (regla b) |
| CB-21 | Doble envío de "Tomar turno" por respuesta perdida | Regla de turno activo único por celular | REQ-011.5 |
| CB-22 | Dueño que también corta pelo | Ambos roles en una cuenta | REQ-012.5 |

---

## 8. Fuera de alcance del MVP

Explícitamente **no** se construye en el MVP (el modelo de datos sí debe dejarlo posible):

- ~~Reservas con hora fija (citas).~~ Sale de esta lista: Hito 8, REQ-049 (ADR-033).
- ~~Planes familiares por suscripción.~~ Sale de esta lista: Hito 7, REQ-044 (ADR-030).
- Referidos. La ficha de cliente admitirá `referred_by`.
- ~~WhatsApp Cloud API (envío automático).~~ Sale de esta lista: Hito 6, REQ-040 (ADR-027).
- Varios negocios por dueño en la interfaz. La tabla de membresías ya lo permite (REQ-031.3).
- ~~Control de inventario de productos.~~ Sale de esta lista: Hito 13, REQ-070 (ADR-039).
- Pagos en línea, facturación electrónica DIAN, integración con Nequi/bancos.
- Propinas `[PA-23]`.
- Notificaciones push del navegador (el aviso es por WhatsApp).
- Varios idiomas.
- Aplicación nativa iOS/Android.
- Reportes avanzados o exportación a Excel (se evalúa después del Hito 3).

---

## 9. Preguntas abiertas

Necesito tu respuesta para cerrar estos puntos. Donde propongo un valor por defecto, es solo para
no bloquear la lectura; no es decisión tomada.

| ID | Pregunta | Afecta | Valor por defecto propuesto |
|---|---|---|---|
| PA-01 | ¿Cómo entran dueño y barberos? (a) correo + contraseña, (b) enlace mágico al correo, (c) celular + PIN de 4–6 dígitos. Muchos barberos no usan correo; un PIN es lo más simple pero menos seguro. | REQ-030 | (a) para el dueño; barbero con celular + PIN si Supabase Auth lo permite sin SMS de pago, si no, (a) para ambos |
| PA-02 | ¿Nombre público del negocio, slug de la URL y dominio? (ej. `turnos.app/la-barberia`). ¿Tienes dominio? | REQ-001 | `turnos-os.vercel.app/<slug>` temporal |
| PA-03 | ¿El cliente puede pedir más de un servicio al tomar turno (corte + barba)? Afecta el tiempo estimado. | REQ-003.6 | Un solo servicio; "corte + barba" se crea como servicio combinado |
| PA-04 | ¿El barbero puede llamar a alguien que no sea el primero de su lista (saltar)? ¿Y el dueño reordenar la fila? | REQ-007.8, REQ-012.2 | Barbero: solo el primero; dueño: sí puede reordenar y saltar |
| PA-05 | Tiempo de gracia tras llamar antes de habilitar "No llegó", y qué pasa con el cliente que llega tarde: ¿vuelve al final, o se le da una segunda oportunidad después del siguiente? | REQ-008 | 5 min; vuelve al final |
| PA-06 | Cuando un barbero está en pausa o no vino hoy, ¿se oculta del formulario del cliente o se muestra como "no disponible"? | REQ-003.1, REQ-010.1, REQ-016.4 | Se muestra deshabilitado con etiqueta "No está hoy" / "En pausa" |
| PA-07 | ¿Hay clientes de mostrador que no quieren dar celular? ¿Debe el barbero (no solo el dueño) poder agregarlos a la fila y cobrarles? | REQ-012.3, REQ-023.4 | Sí, dueño y barbero pueden agregar "Cliente sin registro" |
| PA-08 | Pantalla del televisor: ¿la quieres en el MVP o se deja para después? ¿Qué debe mostrar: solo nombres o también tiempos? | REQ-013 | Incluida como deseable (D) al final del Hito 1 |
| PA-09 | ¿La duración de un servicio es igual para todos los barberos, o cada barbero tiene su propio tiempo? | REQ-015.4, REQ-004.5 | Igual para todos; el modelo deja campo de ajuste por barbero para después |
| PA-10 | ¿El barbero puede ver el historial completo de un cliente (incluido lo que le hicieron otros barberos y cuánto pagó), o solo lo suyo? | REQ-018.4 | Ve historial de servicios pero no montos de otros barberos |
| PA-11 | Fidelidad: ¿qué cuenta como visita (cualquier servicio, o solo cortes)? ¿El premio es "corte gratis" exactamente, o un valor? ¿Aplica a niños y adultos por igual? | REQ-019 | Todos los servicios suman; premio = un corte sencillo gratis |
| PA-12 | Recordatorios: ¿cuántos días esperar antes de volver a mostrar a un cliente ya recordado? | REQ-020.4 | 7 días |
| PA-13 | ¿Los barberos pueden dar descuentos al cobrar, o solo el dueño? ¿Hay precios distintos para niños? | REQ-023.2 | Barbero: sin descuento salvo premio; precios de niños = servicios aparte |
| PA-14 | ¿Es común que un cliente pague parte en efectivo y parte en Nequi? | REQ-023.5 | Deseable, no imprescindible |
| PA-15 | ¿Quién maneja la plata? Si el cliente paga en Nequi o transferencia, ¿paga a la cuenta del negocio o a la del barbero? Esto cambia el cierre: hay que saber cuánto le debe el negocio al barbero o el barbero al negocio. | REQ-023.7, REQ-027 | Todo entra a la cuenta/caja del negocio; el negocio liquida la comisión al barbero |
| PA-16 | ¿Necesitas control de inventario de helados y bebidas (cuántos quedan)? | REQ-024.1 | No en el MVP. Resuelta: Hito 13, REQ-070…074 (ADR-039) |
| PA-17 | ¿Las ventas de productos dejan algo al barbero que las vende? | REQ-024.3, REQ-067 | ~~No~~ Sí desde el Hito 12 (ADR-038): los productos marcados dejan el % de productos del negocio (10 % por defecto) al barbero de la venta |
| PA-18 | Comisión: el porcentaje configurado, ¿es lo que se lleva el barbero o lo que deja al negocio? ¿Hay valores típicos (50/50, 60/40)? ¿Se calcula sobre el precio antes o después de descuento? | REQ-025.1 | Es la parte del barbero; sobre el precio después de descuento |
| PA-19 | Cuando el corte es gratis por fidelidad, ¿el barbero igual recibe su comisión (la asume el negocio) o también lo regala? | REQ-025.4 | El negocio la asume |
| PA-20 | ¿Se puede corregir algo después de cerrar la caja? ¿Quién puede reabrir? | REQ-026.2, REQ-027.3 | Solo el dueño, con motivo, queda registrado |
| PA-21 | ¿La semana del negocio va de lunes a domingo? ¿Qué día cierran? | REQ-028.1, REQ-017 | Lunes a domingo |
| PA-22 | ¿El nombre de la app instalada en el celular del cliente es "TurnOS" o el nombre de la barbería? | REQ-032.1 | Nombre de la barbería (marca blanca) |
| PA-23 | ¿Hay propinas y deben registrarse? | Fuera de alcance | No en el MVP |
| PA-24 | Trato al cliente en los textos: ¿"tú" o "usted"? | Toda la UI | "Tú" (más corto); el mensaje de WhatsApp sí puede ser más formal |
| PA-25 | ¿Tienes ya el texto de la política de tratamiento de datos, o lo redactamos como plantilla para que lo revise un abogado? | REQ-002 | Plantilla base, marcada "revisar con abogado" |
| PA-26 | ¿Los 5 barberos trabajan todos los días o rotan? ¿Horario típico (ej. 9 a. m. – 8 p. m.)? Sirve para el seed y la ocupación. | REQ-016.4, REQ-028.2, REQ-034 | 9:00–20:00 lunes a sábado, domingo 10:00–16:00 |
| PA-27 | ¿Cuántos negocios esperas tener en TurnOS en el primer año? Define cuánta inversión en el onboarding de dueños (REQ-030.1). | REQ-030 | 1–5; onboarding mínimo |
