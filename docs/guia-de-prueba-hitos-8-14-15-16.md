# Guía de prueba de Henry · Hitos 8, 14, 15 y 16

Para cerrar los hitos construidos que esperan tu prueba y aprobación. Todo se prueba en
producción (https://turnos-smoky-nine.vercel.app) **después de desplegar `main`**. Ninguno de estos
hitos trae migraciones nuevas: basta `vercel deploy --prod` desde `main`.

Necesitas: tu celular, otro celular (o el de alguien de la barbería) y el computador. Usa turnos y
ventas de prueba con tu propio nombre; anula las ventas de prueba al final (Caja → la venta →
"Anular") para que no queden en la caja del día.

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y me lo dices.

---

## 1. Hito 16 · sistema visual nuevo (T-168, aprobación ADR-050)

Qué se busca en todas las pantallas: un solo botón azul marino relleno por pantalla, el rojo solo
para lo que pide atención ahora, botones fáciles de tocar con el pulgar, nada que se salga de la
pantalla y los mismos textos de siempre.

### Cliente (celular, sin entrar)

- [ ] Abrir el QR del negocio (o `/<negocio>`): marca arriba, "N esperando" con una línea por
      barbero y el formulario en la misma pantalla (T-173): "¿Qué te vas a hacer?", "¿Con quién?"
      con "El primero libre" primero, nombre, celular y la privacidad en una línea.
- [ ] "Tomar turno" fijo abajo, con "Reservar una cita" y "Ver menú" debajo (si existen). "Ver
      menú" abre la hoja con la dirección y lo que vendemos. Un enlace viejo a `/<negocio>/turno`
      lleva a la portada.
- [ ] En el computador: la fila como tabla a la izquierda y "Tomar turno" en una tarjeta a la
      derecha.
- [ ] "Mi turno": número grande; "Cancelar mi turno" abre una hoja; elegir "No, seguir en la fila".
- [ ] Modo avión: aparece la franja "Sin conexión" con la hora y los botones quedan deshabilitados
      con el motivo. Al quitarlo, la franja se va sola.
- [ ] Agrandar el texto del celular al máximo: nada se sale de la pantalla.

### Barbero (celular, celular + PIN)

- [ ] Entrar: seis casillas con puntos para el PIN; un PIN equivocado muestra el error en rojo.
- [ ] Mi fila (T-169, como el tablero Barbero-Fila): franja azul con tu nombre, tu estado y
      "Pausar"; bloque "Sigue" con el número grande y "Después · N más" debajo.
- [ ] "Llamar a <número>" → "Empezar corte" (o "No vino") → "Terminar y cobrar" → cobro con el
      total y "Registrar" abajo.
- [ ] Tocar un turno abre su hoja con "Avisar por WhatsApp".
- [ ] "Cobrar después": queda la fila "1 cobro pendiente"; tocarla abre la lista con "Cobrar".
- [ ] Modo avión: el botón de llamar queda deshabilitado con el motivo.
- [ ] Menú de abajo con íconos: Mi fila, Clientes, Números, Limpieza (punto rojo si falta la
      apertura) y Más (Mis fotos, Mi estación, "+ Nueva venta" y "Salir").

### Dueño (celular y computador)

- [ ] Fila: tocar un turno → "Cancelar turno" → "No, dejarlo" (no cancelar uno real).
- [ ] Caja: "Cerrar caja" → escribir el efectivo → ver "Cuadra" o "Faltan $ …" → "Todavía no".
- [ ] "+ Nueva venta" con el texto del celular al máximo: los medios de pago quedan en una columna
      y nada se sale.
- [ ] Con el otro celular registrar una venta: entra resaltada en tu caja.
- [ ] Más → Barberos: "Editar" a uno, cambiar el % y ver la pregunta de confirmación (cancelarla).
- [ ] Clientes y Membresías: los celulares salen como `300 *** 0001`.
- [ ] Computador: `/entrar?rol=dueno` sale como tarjeta centrada; la fila sale por carriles (uno
      por barbero); la caja tiene el resumen a la izquierda.

### En la barbería (PA-H16-2)

- [ ] Una mañana normal con los barberos usando la app nueva. Anota si alguien se confundió con
      algún botón.

## 2. Hito 15 · "Hoy" del dueño (T-154, aprobación ADR-049)

- [ ] Celular, entrar como dueño → "Hoy": "Piden tu atención" (o "Todo en orden"), fila en vivo,
      caja de hoy, citas de hoy (si están encendidas) y "Para recordar".
- [ ] Si hay alertas, el número sale en rojo junto a "Hoy" en la barra de abajo.
- [ ] Barra fija con "Fila", "Cerrar caja" y "Nueva venta" (esta abre la hoja ahí mismo).
- [ ] Con el otro celular tomar un turno por el QR y hacer una venta: "Hoy" cambia solo en menos de
      3 segundos (cuenta con el reloj).
- [ ] Computador (pantalla ancha): menú lateral e "Ingresos de la semana". La barra de cada día da
      la misma cifra que la Caja de ese día, y la suma da el "Vendido" de Semana.

## 3. Hito 14 · rendimiento (T-133, aprobación ADR-044)

- [x] Región: Supabase en `us-east-1` y funciones de Vercel en `iad1`, coinciden (verificado el
      2026-11-08).
- [ ] Al navegar entre pantallas del personal se ve el esqueleto (cajas grises) y después la
      pantalla, sin pantallazo en blanco.
- [ ] Vercel → proyecto `turnos` → Speed Insights: con unos días de uso del Hito 16, comparar con
      los números del Hito 14 (que no empeoren). Esto también cierra T-168.

## 4. Hito 8 · citas a hora fija (T-087, aprobación ADR-035)

- [ ] `/filo` → Más → Citas: encender las citas y marcar los barberos que las reciben.
- [ ] Desde un celular, en la portada, "Reservar una cita": elegir barbero, día y hora.
- [ ] En "Mi cita", "Agregar al calendario" y ver que queda en el calendario del celular.
- [ ] Cuando llegue la persona: el barbero toca "Llegó" en "Mis citas de hoy" y la llama.
- [ ] Cancelar otra cita desde "Mi cita" y otra desde la agenda del dueño; revisar el mensaje de
      WhatsApp que se ofrece.

---

## Cuando termines

Dime qué hitos quedaron bien y qué falló. Con tu visto bueno escribo los ADR de aprobación
(ADR-035 Hito 8, ADR-044 Hito 14, ADR-049 Hito 15, ADR-050 Hito 16) y marco las tareas `[x]`.

Pendientes que no son de estos hitos: los pasos de Meta del Hito 6 (T-069), encender en Filo lo de
los Hitos 7, 9, 11, 12 y 13, y proteger `main` en GitHub (T-010).
