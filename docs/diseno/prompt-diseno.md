# Prompt de diseño — TurnOS

Copia todo lo que está debajo de la línea en la herramienta de diseño.

---

Diseña el sistema visual y todas las pantallas de **TurnOS**, una web app (PWA) para negocios de
servicios de barrio en Colombia. El primer cliente es una barbería de 5 sillas en Sabaneta con
barberos independientes a comisión, que además vende helados, bebidas y productos. TurnOS ya está
construida y funcionando: esto es un rediseño visual, no un producto nuevo. Respeta los flujos,
los textos y las funciones que describo; mejora la jerarquía, la claridad y el acabado.

## 1. Quién lo usa y dónde

- **Cliente**: papás con niños, vecinos de una unidad de más de 2.000 familias. Escanea un QR, toma
  turno con nombre y celular, y espera en su casa. No instala nada, no crea contraseña. Celular de
  gama media o baja, datos móviles 4G irregulares, a veces al sol.
- **Barbero**: trabaja de pie, con una mano y a veces con las manos ocupadas. Celular propio de gama
  media. Necesita un toque para llamar, empezar y terminar.
- **Dueño**: revisa todo desde el celular durante el día y desde un computador al cerrar. Sin
  conocimientos técnicos: ninguna pantalla puede necesitar manual.
- **Televisor del local**: muestra la fila en grande, leíble a 4 metros.

## 2. Orden de trabajo

1. **Móvil primero (360–430 px)**: es lo más importante. Diseña cada pantalla en 390 px.
2. **Escritorio (1280–1440 px)**: la misma pantalla aprovechando el ancho, sin inventar funciones.
3. Tablet (768 px) solo donde cambie de verdad la disposición (dashboard y caja).

## 3. Marca y color

Dos colores de marca, usados con disciplina:

| Token                 | Hex       | Uso                                                                                                                                                                                             |
| --------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `brand` (azul marino) | `#0E1E3D` | Color dominante: barra superior, botón principal, títulos, menú activo, encabezados de tabla. Contraste con blanco ≈ 16:1.                                                                      |
| `accent` (rojo)       | `#C21E2F` | Acento escaso: "¡Es tu turno!", alertas que piden acción, contadores, el punto de "en vivo", una línea o detalle de marca. Contraste con blanco ≈ 6:1. Nunca como fondo de grandes superficies. |

Reglas:

- El rojo **no** puede significar dos cosas a la vez. Las acciones destructivas (anular venta,
  cancelar turno, borrar) usan el rojo solo en **contorno o texto**, siempre con confirmación; el
  rojo **relleno** queda para "atención ahora" (es tu turno, alerta de caja, falla de limpieza).
- Una pantalla tiene **un solo** botón relleno azul marino (la acción principal).
- Completa la paleta con neutros fríos que combinen con el marino (fondo casi blanco, tarjetas
  blancas, bordes grises suaves, texto secundario gris azulado) y con verde y ámbar oscuros para
  "listo" y "advertencia". Todo par texto/fondo con contraste ≥ 4.5:1.
- Entrega la paleta como tokens con nombre semántico (`surface`, `card`, `ink`, `muted`, `line`,
  `brand`, `brand-ink`, `accent`, `ok`, `warn`, `danger`, `called`). La app usa Tailwind 4 con
  `@theme` en `globals.css`, así que los tokens se convierten directo en clases (`bg-brand`).
- La marca de cada negocio (nombre y logo) aparece en sus páginas públicas; TurnOS se ve discreto.
  No uses logos ni nombres de otras marcas.

## 4. Principios de diseño

- **Una acción principal obvia por pantalla.** Si algo necesita explicación, rediséñalo.
- **Español colombiano cotidiano** en todo texto visible: "Llamar al siguiente", "Tomar turno",
  "Caja de hoy", "Cerrar caja". Nada en inglés. Dinero en pesos sin decimales: `$ 25.000`.
  Horas en formato 12 h colombiano: `3:40 p. m.`
- **Legible al sol y con una mano**: texto base ≥ 16 px, botones y zonas táctiles ≥ 48 px, acciones
  principales al alcance del pulgar (parte baja de la pantalla), funciona con zoom al 200 %.
- **Estilo de herramienta de trabajo, no de página de marketing**: sobrio, preciso, denso donde hace
  falta (caja, inventario), muy aireado donde el usuario está nervioso o apurado (tomar turno, es tu
  turno). Nada de héroes con fotos de stock, gradientes, "glassmorphism" ni tarjetas decorativas.
- **Privacidad visible**: la pantalla del televisor y las páginas públicas nunca muestran celulares
  ni nombres completos (solo "Juan P." y el número de turno).

## 5. Rendimiento: el diseño debe poder construirse liviano

Estas reglas son obligatorias porque el usuario típico tiene un celular de gama media con datos
lentos. Diseña dentro de ellas, no las rompas por estética.

- **Fuentes del sistema** (system-ui). No uses fuentes externas.
- **Iconos**: un solo juego de línea, simples, como SVG en línea. Nada de librerías de iconos
  pesadas ni ilustraciones grandes.
- **Imágenes** solo donde aportan (logo del negocio, fotos de cortes, fotos de la vitrina, foto de
  limpieza), siempre con tamaño fijo reservado (sin saltos de diseño) y en miniatura en las listas.
  Ninguna imagen de fondo.
- **Sin efectos caros**: nada de `backdrop-filter`/desenfoque, sombras grandes en capas, videos,
  carruseles automáticos ni parallax. Sombras mínimas o bordes de 1 px.
- **Movimiento**: solo `transform` y `opacity`, de 150 a 250 ms, con propósito (confirmar una
  acción, aparecer un aviso, cambiar de estado un turno). Todo movimiento se apaga si el celular pide
  menos movimiento. Nada animado en bucle salvo el esqueleto de carga y el punto de "en vivo".
- **Nada de layout shift**: reserva el espacio de cada bloque (imágenes, cifras, listas, avisos).
- **Gama alta**: puede tener transiciones un poco más ricas, pero la gama media no puede perder nada
  de función ni de claridad por eso.

## 6. Estados que cada pantalla debe tener dibujados

Para cada pantalla entrega, además del estado normal:

1. **Esqueleto de carga**: la forma exacta de la pantalla con bloques grises, sin datos, cifras ni
   nombres de ejemplo. Brillo suave que se detiene con movimiento reducido. Nunca pantalla en blanco
   ni spinner a pantalla completa. Es obligatorio en: página del negocio, Mi turno, Mi fila del
   barbero, Fila del dueño y Caja de hoy; deseable en todas.
2. **Guardando**: el botón tocado cambia a "Guardando…" al instante y queda deshabilitado (evita doble
   toque). La app **no** muestra el resultado antes de que el servidor confirme: si falla, el estado
   vuelve atrás con un mensaje claro.
3. **Sin conexión / red lenta**: barra discreta "Sin conexión. Mostrando lo último que vimos" con la
   hora de la última actualización; los botones que necesitan red se ven deshabilitados con el motivo.
4. **Vacío**: mensaje útil con la acción siguiente ("Todavía no hay turnos. Comparte el QR").
5. **Error**: qué pasó y qué hacer, en lenguaje cotidiano, con botón "Intentar de nuevo".
6. **Tiempo real**: cuando la fila cambia sola (otro barbero llamó, alguien tomó turno), el cambio se
   nota con un resaltado breve, sin mover lo que el usuario está tocando.

## 7. Seguridad que se ve en la interfaz

- Confirmación explícita (hoja inferior en móvil, diálogo en escritorio) para anular ventas, cerrar o
  reabrir caja (reabrir pide motivo), cancelar turnos, borrar clientes y cambiar porcentajes.
- Datos sensibles ocultos por defecto: celulares enmascarados (`300 *** 0001`) en listas; se ven
  completos solo en el detalle del cliente y para el dueño.
- El PIN del barbero en 6 casillas grandes, sin mostrar los dígitos.
- Aviso de privacidad (Ley 1581) visible y aceptado con casilla antes de guardar nombre y celular.
- Nunca pedir datos que no se usan. El cliente da solo nombre y celular.

## 8. Pantallas

### 8.1 Cliente (público, sin login) — prioridad máxima

- **Página del negocio** `/[slug]` (llega por QR): logo y nombre del negocio, cuántos esperan y
  tiempo estimado por barbero, elegir servicio y barbero (o "el primero libre"), nombre, celular,
  casilla de privacidad y de avisos por WhatsApp, botón "Tomar turno". Máximo 4 campos y una
  pantalla. Acceso a "Reservar una cita" y al menú del local.
- **Mi turno** `/t/[token]`: el número de turno enorme, posición en la fila, tiempo estimado,
  barbero, estado (en espera → ¡es tu turno! → en servicio → terminado). "¡Es tu turno!" es el
  momento rojo de la app: tiene que verse desde lejos. Botón "Cancelar turno". Al terminar:
  invitación a dejar reseña en Google y progreso de fidelidad ("Te faltan 3 cortes para el gratis").
  Muestra la bebida de cortesía si aplica.
- **Reservar cita** `/[slug]/cita`: servicio, barbero, día, horas libres en botones grandes,
  nombre y celular, confirmar.
- **Mi cita** `/c/[token]`: fecha, hora, barbero, servicio, "Ya llegué", cancelar.
- **Tarjeta de regalo** `/regalo/[token]`: tarjeta visual con el valor, saldo, para quién, de
  quién, vigencia. Pensada para compartirse por WhatsApp.
- **Privacidad** `/[slug]/privacidad`: aviso legible, versión y fecha.
- **Pantalla del televisor** `/[slug]/pantalla`: horizontal 1920×1080, fondo azul marino, turnos
  por barbero, "Llamando a: 12 · Juan P. → Silla 3" con el rojo, siguientes en la fila. Sin
  celulares ni apellidos completos. Leíble a 4 metros.

### 8.2 Acceso

- **Entrar** `/entrar`: dueño con correo y contraseña; barbero con celular y PIN de 6 dígitos (dos
  pestañas claras).
- **Invitación** `/invitacion/[token]`: el barbero acepta la invitación y crea su PIN.
- **Crear negocio** `/crear-negocio`: nombre, enlace (`/mi-barberia`), ciudad.

### 8.3 Barbero (app del personal, móvil)

Navegación inferior fija con 4–5 destinos.

- **Mi fila** `/app/fila` (inicio): quién sigue, con el botón gigante "Llamar al siguiente" al
  alcance del pulgar. El turno en curso con "Empezar" → "Terminar" → cobro. Solo puede llamar al
  primero de su fila. Citas que llegan marcadas como "Cita 3:30 p. m.". Aviso de limpieza
  pendiente arriba si aplica.
- **Cobro** (al terminar): servicio y precio, descuento, fidelidad ("Corte gratis") o "Usar
  membresía", tarjeta de regalo, productos de la vitrina vendidos en el mismo cobro, medio de pago
  (Efectivo, Nequi, Daviplata, Transferencia, Tarjeta, o dividido). Total grande. Botón "Cobrar".
- **Clientes** `/app/clientes` y detalle `/app/clientes/[id]`: buscador, historial de cortes,
  fidelidad, cumpleaños, membresía, notas.
- **Mis números** `/app/mis-numeros`: lo que lleva hoy y la semana (servicios, comisión,
  productos vendidos, compras con descuento).
- **Mis fotos** `/app/mis-fotos`: subir y ordenar fotos de sus cortes (portafolio).
- **Limpieza** `/app/limpieza`: apertura, cierre y limpieza profunda de su estación con lista
  de chequeo y foto.
- **Mi estación** `/app/estacion`: insumos de su estación, reportar envase vacío para
  reposición.

### 8.4 Dueño — dashboard de monitoreo

El dueño hoy entra directo a la fila. El rediseño agrega un **inicio de monitoreo** ("Hoy") que
resume el negocio en vivo y lleva a cada módulo. Todas las funciones de abajo ya existen: el
dashboard las organiza, no inventa nuevas.

**Inicio "Hoy"** (nuevo):

- Fila en vivo: cuántos esperan, tiempo estimado, estado de cada silla (libre, atendiendo a quién y
  desde hace cuánto, en pausa).
- Caja de hoy: total, por medio de pago, ventas de vitrina, comparado con el mismo día de la
  semana pasada.
- Citas de hoy: próximas y llegadas.
- Alertas que piden acción (en rojo, ordenadas por urgencia): limpieza vencida o con falla, insumo
  por agotarse, caja de ayer sin cerrar, membresías por vencer, consumo raro en un conteo.
- Clientes para recordar: cumpleaños de la semana y clientes que hace rato no vienen.
- Accesos directos a las acciones frecuentes: "Nueva venta", "Llamar al siguiente", "Cerrar caja".

Móvil: tarjetas apiladas por prioridad (fila y alertas primero), cifras grandes. Escritorio:
**rejilla tipo panel de control** de 12 columnas con menú lateral fijo, la fila en vivo como bloque
principal, caja y alertas a la derecha, gráfico simple de ingresos de la semana.

**Menú del dueño** (agrupa los 19 módulos actuales): en móvil, navegación inferior con Hoy, Fila,
Caja, Clientes y "Más"; en escritorio, menú lateral agrupado así:

- **Operación**: Fila (reordenar, saltar, mover entre barberos), Citas (agenda por barbero y día),
  Caja (caja de hoy, nueva venta, anular, cierre de caja, cierres anteriores por fecha), Semana
  (resumen semanal y liquidación de comisiones por barbero).
- **Clientes**: Clientes, Fidelidad (regla de cortes y premio), Recordar (cumpleaños e inactivos con
  mensaje de WhatsApp), Membresías (plan familiar, familias, cuotas), Tarjetas de regalo (vender,
  anular, saldo).
- **Local**: Limpieza (revisión de fotos y fallas por barbero, tareas periódicas, PDF), Productos
  (vitrina con fotos y categorías, comisión de productos), Inventario (catálogo, conteo, orden de
  compra, costo por servicio).
- **Configuración**: Barberos (invitar, porcentaje, servicios de cada uno), Servicios, Horario,
  QR (descargar e imprimir), Mensajes (plantillas y avisos de WhatsApp), Negocio (datos, logo,
  reseña de Google, bebida de cortesía), Privacidad (aviso y solicitudes de supresión).

Para cada módulo diseña la vista de lista/tabla en escritorio y su equivalente en tarjetas en móvil.
Las tablas largas (clientes, inventario, ventas) tienen búsqueda, filtros simples y cifras alineadas
a la derecha con números tabulares.

## 9. Componentes a entregar

Sistema de componentes con sus estados (normal, tocado, foco visible, deshabilitado, guardando,
error): botón principal, secundario, destructivo y de texto; campo de texto, celular con prefijo +57,
dinero en pesos, PIN de 6 dígitos; selector de servicio y barbero en tarjetas; chip de estado del
turno (en espera, llamado, en servicio, terminado, cancelado, no vino); tarjeta de turno; fila de
tabla; tarjeta de métrica del dashboard; alerta; aviso emergente; hoja inferior (móvil) y diálogo
(escritorio); barra de sin conexión; esqueletos; estado vacío; navegación inferior y lateral;
encabezado del negocio con logo.

## 10. Lo que necesito de vuelta

1. Tokens de color, tipografía (escala con system-ui), espaciado, radios y sombras, con su contraste
   verificado.
2. La librería de componentes con estados.
3. Las pantallas en este orden: cliente (8.1) → barbero (8.3) → dashboard del dueño (8.4) → acceso
   (8.2) → resto de módulos del dueño. Cada una en móvil y escritorio, con sus esqueletos y estados
   del punto 6.
4. Notas de implementación cortas por pantalla: qué bloque carga primero, qué se reserva para evitar
   saltos y qué movimiento lleva.
