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
  Transferencia, Tarjeta**.
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
  total por medio de pago (Efectivo, Nequi, Transferencia, Tarjeta), total servicios vs. productos,
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

## 6. Requisitos no funcionales

| ID | Requisito | Criterio verificable |
|---|---|---|
| NFR-001 Rendimiento | Pantallas de cliente y barbero rápidas en móvil | LCP < 3 s en 4G simulado (Lighthouse móvil ≥ 80 en rendimiento); acciones del barbero responden < 1 s en condiciones normales |
| NFR-002 Tiempo real | Cambios de fila visibles a todos los interesados | < 3 s entre el cambio en servidor y la actualización en pantalla (prueba E2E con dos navegadores) |
| NFR-003 Disponibilidad | El negocio no para por una caída corta | Lectura de último estado sin conexión (REQ-011.6); sin dependencia de cron para la operación de la fila |
| NFR-004 Seguridad | Aislamiento por negocio y mínima exposición | RLS en el 100 % de tablas con `business_id` (REQ-031.4); tokens de "Mi turno" ≥ 128 bits aleatorios; sin `service_role` en el cliente; rate limiting en "Tomar turno" (máx. 5 por celular/hora, 30 por IP/hora) |
| NFR-005 Privacidad | Ley 1581 | Aviso versionado y aceptación registrada (REQ-002); supresión (REQ-018.6); pantallas públicas sin celulares (REQ-013.2); sin trackers de terceros en páginas públicas |
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

- Reservas con hora fija (citas). El modelo de turno llevará campo de hora programada opcional.
- Planes familiares por suscripción. Habrá entidad cliente y ventas que puedan referenciar un plan.
- Referidos. La ficha de cliente admitirá `referred_by`.
- WhatsApp Cloud API (envío automático). Solo la interfaz `NotificationChannel` (REQ-009.5).
- Varios negocios por dueño en la interfaz. La tabla de membresías ya lo permite (REQ-031.3).
- Control de inventario de productos.
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
| PA-16 | ¿Necesitas control de inventario de helados y bebidas (cuántos quedan)? | REQ-024.1 | No en el MVP |
| PA-17 | ¿Las ventas de productos dejan algo al barbero que las vende? | REQ-024.3 | No |
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
