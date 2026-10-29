# Propuesta — mejoras para los clientes de la barbería (borrador, 2026-10-28)

> Aprobado el Hito 5 (ADR-025, 2026-10-28): ya está en `specs/` (REQ-036…039, `design.md` §11,
> T-058…T-063). Este documento queda como registro de la comparación y de los hitos futuros.

## Cambio de enfoque (necesita ADR)

TurnOS es para **una sola barbería** (la de Henry), no un producto para vender. Consecuencias:

- No se diseña pensando en otros negocios, precios ni planes. Lo multi-negocio que ya existe se
  queda (funciona y no estorba), pero no se extiende.
- Cada idea se mide por una sola pregunta: **¿mejora la experiencia del cliente de la barbería?**

## Orden acordado ("lo rápido primero")

| Hito | Qué                                                                                          | Por qué en este orden                                    |
| ---- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| 5    | Reseña en Google · Cumpleaños · Menú de la barbería con bebida de cortesía · Fotos de cortes | Baratos, sin costos externos, el cliente los nota de una |
| 6    | Aviso automático "ya casi es tu turno"                                                       | Depende de decidir el canal (ver abajo)                  |
| 7    | Membresía familiar                                                                           | Toca caja y comisiones: hay que diseñarla con cuidado    |
| 8    | Citas a hora fija mezcladas con la fila                                                      | Cambia el algoritmo de la fila                           |
| 9    | Gift cards                                                                                   | Solo si los clientes las piden                           |
| 10   | Asistente con IA en WhatsApp (agenda y recordatorios)                                        | Necesita el canal del Hito 6 ya funcionando              |

---

## Hito 5 — borrador de requisitos

### REQ-036 · Reseña en Google después del corte — M

- REQ-036.1 El dueño DEBE poder guardar el enlace de reseñas de Google de la barbería en
  `/admin/negocio`.
- REQ-036.2 CUANDO un turno pasa a terminado y hay enlace guardado, "Mi turno" DEBE mostrar
  "Gracias por venir" y un botón "Déjanos tu reseña en Google".
- REQ-036.3 SI no hay enlace guardado, EL SISTEMA NO DEBE mostrar el botón.
- REQ-036.4 Pregunta: ¿el mensaje de WhatsApp de "gracias" (si se envía) también lleva el enlace?

### REQ-037 · Cumpleaños del cliente — M

- REQ-037.1 La ficha del cliente DEBE admitir día y mes de cumpleaños (sin año), opcional.
- REQ-037.2 El cliente PUEDE escribirlo al tomar turno (campo opcional, una sola vez: si ya está,
  no se vuelve a pedir).
- REQ-037.3 El dueño DEBE ver la lista "Cumplen esta semana" junto a "Clientes para recordar", con
  botón de WhatsApp y una plantilla editable `{nombre}`, `{negocio}` (REQ-033).
- REQ-037.4 El aviso de privacidad (REQ-002) DEBE mencionar el cumpleaños como dato opcional y
  para qué se usa. Cambiar el aviso sube su versión.
- Pregunta: ¿hay un regalo de cumpleaños fijo (descuento, bebida, corte gratis) o solo el saludo?

### REQ-038 · Menú de la barbería y bebida de cortesía — M

- REQ-038.1 Cada producto DEBE poder marcarse como "cortesía" (se ofrece gratis con el turno) o
  "a la venta" (se muestra con precio), o ambas.
- REQ-038.2 La página pública `/[slug]` DEBE mostrar "Lo que vendemos" con foto opcional, nombre
  y precio de los productos activos a la venta. Solo se muestran; se compran en persona.
- REQ-038.3 Al tomar turno, el cliente PUEDE escoger **una** bebida de cortesía de la lista (o
  "No, gracias"). Puede cambiarla desde "Mi turno" mientras esté en espera.
- REQ-038.4 La fila del barbero y la del dueño DEBEN mostrar la bebida escogida en el turno, para
  servirla cuando el cliente llegue, y un toque "Servida ✓".
- REQ-038.5 La cortesía NO DEBE generar cobro ni comisión. Pregunta: ¿se registra en caja como
  salida a $0 para saber cuántas se regalan al mes?
- Fuera de este hito: control de existencias (inventario). Si un producto se acaba, el dueño lo
  desactiva y deja de aparecer.

### REQ-039 · Fotos de cortes por barbero — D

- REQ-039.1 Cada barbero (y el dueño) DEBE poder subir hasta N fotos de sus cortes desde el
  celular.
- REQ-039.2 En el formulario de turno, tocar un barbero DEBE mostrar sus fotos.
- REQ-039.3 Antes de subir una foto donde se vea la cara del cliente, la app DEBE pedir confirmar
  que el cliente dio permiso (Ley 1581: la imagen es dato personal).
- Pregunta: ¿cuántas fotos por barbero? (propuesta: 12)
- Técnica: Supabase Storage, imágenes reducidas en el celular antes de subir.

---

## Hitos 7 en adelante — lo que ya sabemos

### Membresía familiar (Hito 7)

Henry escogió una mezcla: **cuota mensual con N cortes compartidos** + **descuento** para los
miembros. Propuesta para discutir:

- Un titular paga una cuota al mes; inscribe a su familia (papá, mamá, hijos, hermanas…) por
  celular.
- La familia comparte N cortes al mes. Al gastarlos, cada miembro sigue con X % de descuento hasta
  el mes siguiente.
- Preguntas: ¿cuántos cortes y cuánto vale? ¿máximo de miembros? ¿los cortes que sobran se
  acumulan? ¿qué pasa si no paga a tiempo? ¿cuánto se le paga al barbero por un corte de
  membresía? (hoy: comisión sobre servicio después de descuento — ADR de comisiones aplica).

### Citas a hora fija (Hito 8), Gift cards (Hito 9)

Se especifican cuando lleguemos; preguntas abiertas en su momento.

---

## Aviso automático e IA en WhatsApp — opciones (para decidir antes del Hito 6)

Verificado en la documentación de Meta (28-oct-2026):

- Desde el 1-jul-2025 Meta cobra **por mensaje entregado**; lo que escribe el cliente no se cobra.
- **Desde el 1-oct-2026** (hace un mes) se cobran también los mensajes dentro de la ventana de 24 h
  que abre el cliente; queda un cupo de **1.000 mensajes de servicio gratis al mes por número**.
- Colombia tiene tarifa propia en COP (desde abril 2026); el valor exacto está en la tabla de
  tarifas de Meta y hay que mirarlo antes de decidir.

| Opción                                                              | Costo                                                                                                     | Cómo funciona                                                                                                                | Contras                                                                                                      |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| A. Como hoy (`wa.me`, el barbero toca)                              | Gratis                                                                                                    | Se abre WhatsApp con el mensaje listo                                                                                        | Depende de que el barbero se acuerde                                                                         |
| B. Notificación del celular (push)                                  | Gratis                                                                                                    | "Mi turno" pide permiso y avisa solo                                                                                         | En iPhone solo si el cliente instaló la app en la pantalla de inicio                                         |
| C. WhatsApp oficial directo con Meta (Cloud API, sin intermediario) | Gratis los primeros 1.000 mensajes de servicio al mes si el cliente escribe primero; luego tarifa de Meta | Al tomar turno el cliente envía "Hola" al número de la barbería (abre la ventana de 24 h) y desde ahí los avisos salen solos | Trámite de verificación con Meta, tarjeta registrada, el número no puede seguir en la app normal de WhatsApp |
| D. Librerías no oficiales (simulan WhatsApp Web)                    | Gratis                                                                                                    | Un servidor manda mensajes desde el número                                                                                   | Viola las reglas de WhatsApp: **riesgo de que bloqueen el número de la barbería**. No recomendado            |

Cómo lo hacen las apps que vimos: revenden la API oficial con margen. AgendaPro: 50 gratis y
luego $10.000 por cada 50 (≈ $200 por mensaje). Beunik: paquetes desde USD 6 por 150. Bukea dice
"ilimitado" (probablemente absorbe el costo). Ir directo con Meta evita ese margen.

**Recomendación:** B + C combinadas. Push para quien instaló la app (gratis) y WhatsApp oficial para
el resto, haciendo que el cliente escriba primero al tomar turno. Una barbería de 5 sillas con ~40
turnos al día y 2 avisos por turno manda ~2.000 mensajes al mes: la mitad entra en el cupo gratis;
el resto depende de la tarifa colombiana (verificar). La IA del Hito 10 usa el mismo número y la
misma ventana, más el costo del modelo de IA.

Fuentes: [Meta — precios de la plataforma de WhatsApp](https://developers.facebook.com/docs/whatsapp/pricing),
[OneSignal — push web en iOS](https://documentation.onesignal.com/docs/web-push-for-ios),
[Pushpad — requisitos de iOS para push](https://pushpad.xyz/blog/ios-special-requirements-for-web-push-notifications).
