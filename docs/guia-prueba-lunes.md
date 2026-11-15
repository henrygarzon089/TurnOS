# Guía de prueba de Henry · antes de arrancar el martes 17

Una sola pasada, desde el celular, para cerrar los tres hitos que faltan antes de abrir con Pedro
y Stiven: **Citas** (Hito 19, T-211), **fotos y paso a paso** (Hito 20, T-228) y **marca Gamma
Club** (Hito 21, T-245). Toma unos 30 minutos. Todo ya está en producción en
**https://www.gammaclub.co**; no hay nada que desplegar.

Necesitas: tu celular (dueño), otro celular o una ventana de incógnito (para hacer de cliente),
las fotos de Pedro y Stiven (de frente, buena luz), el computador o el televisor para la pantalla
de la fila, y `docs/marca/logos/logo-negocio-256.png` en el celular si todavía no subiste el logo.

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y mándamelo con una
captura.

---

## 1. Instalar la app con la marca nueva

- [ ] Borra de la pantalla de inicio el acceso viejo (el de TurnOS).
- [ ] Abre **https://www.gammaclub.co/entrar** → compartir → **Añadir a pantalla de inicio**.
  - Debe verse: ícono cuadrado navy con el símbolo de Gamma Club y el nombre **Gamma Club**.
- [ ] Entra con tu correo de dueño desde ese ícono.
  - Debe verse: arriba el símbolo con **GAMMA CLUB**; fondo crema, botones navy, letra Montserrat.

## 2. Fotos y logo (Hito 20)

- [ ] Menú → **Negocio** → **Logo y portada**: revisa que estén el logo y la foto del local (si no,
      súbelos).
- [ ] Menú → **Barberos** → toca a **Pedro** → sube su foto. Igual con **Stiven**.
  - Debe verse: la foto recortada en círculo, sin deformarse.
- [ ] Menú → **Servicios** → abre los servicios principales y súbeles foto (opcional; sin foto
      la tarjeta se ve bien igual).
- [ ] (Opcional) Que Pedro entre con su celular y PIN, y en **Mi foto** cambie la suya.

## 3. Encender Citas (Hito 19)

- [ ] Menú → **Citas** → **Recibir citas** activo con **Pedro** y **Stiven** (ya lo encendiste el
      15; solo revisa).
  - Debe verse: la portada del cliente muestra el botón **Reservar una cita**.

## 4. Hacer de cliente (otro celular o incógnito)

- [ ] Abre **https://www.gammaclub.co/gamma-club**.
  - Debe verse: foto del local, tu logo, **GAMMA CLUB**, cuántos esperan, y los botones
    **Tomar turno** y **Reservar una cita**.
- [ ] **Tomar turno**: escoge un servicio (tarjeta con nombre, duración, precio y foto pequeña a la
      derecha) → escoge a Pedro (con su foto) → **Confirmar turno** con un celular de prueba.
  - Debe verse: "Mi turno" con tu número y la flecha para volver a Gamma Club.
- [ ] En tu celular de dueño, **Hoy** y **Fila**: el turno nuevo aparece al instante.
- [ ] En el celular de cliente, **Cancelar turno** (para no dejarlo en la fila).
- [ ] **Reservar una cita** para **mañana** con Stiven → **Confirmar cita**.
  - Debe verse: "Mi cita" con el día, la hora y la foto de Stiven.
- [ ] En tu celular de dueño, **Citas**: la cita sale en la agenda de ese día (también la del
      martes 17 a las 9:15 con Stiven que reservaste el 15).
- [ ] En el celular de cliente, **Cancelar cita**.

## 5. Revisar la marca en el resto (Hito 21)

En todas: fondo crema, tarjetas blancas, navy, letra Montserrat, y nada se corre de lado (gira el
celular también).

- [ ] **Hoy** (dueño): cabecera navy; "Piden tu atención" en rojo solo si hay algo urgente.
- [ ] **Mi fila** (Pedro o Stiven con su celular y PIN): mismos colores y letra.
- [ ] **Televisor**: abre **https://www.gammaclub.co/gamma-club/pantalla** en el computador o el
      TV. Debe verse: fondo navy, símbolo de Gamma Club y el número llamado legible de lejos.
- [ ] Compara con las capturas de `docs/diseno/capturas/hito-21/` si algo te parece raro.

## 6. Aprobar

Si todo salió bien, escríbeme **"Aprobados Hitos 19, 20 y 21"** (o solo los que pasaron) y lo
dejo en sus ADR. Si algo no te gusta, dime la pantalla y lo corrijo antes del martes.

Fuera de esta guía: T-256 (probar el harness de Claude Code, no afecta a la barbería) y T-069
(WhatsApp, espera los pasos de Meta).
