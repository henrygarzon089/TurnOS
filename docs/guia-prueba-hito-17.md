# Guía de prueba de Henry · Hito 17 (modo esencial y Gamma Club)

Para salir a producción con una app liviana, solo para **Gamma Club**. Esta guía sigue el orden de
`docs/plan-hito-17.md` (Fase 3). El orden es obligatorio: el dueño de Gamma Club usa el mismo
correo que el dueño de Filo, así que Filo se borra primero y Gamma Club se crea **antes** de
desplegar.

Qué cambia: el menú del dueño pasa de 20 a 14 destinos, el del barbero de 6 a 4, "Hoy" sale sin
citas ni recordar, las rutas apagadas llevan al inicio, `/` lleva a `/gamma-club` y "Crear negocio"
se cierra. No hay migraciones y no se borra código ni datos de los módulos apagados.

Necesitas: tu celular, otro celular (para el cliente y el QR), el computador, la terminal en la
carpeta principal del repo (`/Users/henrygarzon/Projects/turnOS`, en `main` y al día) y los datos de
Gamma Club a la mano: barberos con celular y PIN de 6 dígitos, servicios con precio y duración,
porcentaje de comisión, horario, regla de fidelidad, productos y el texto del aviso de privacidad.

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y ve a "Si algo falla".

---

## 1. Borrar Filo (no tiene vuelta atrás)

- [ ] Sigue **`docs/guia-borrar-negocio.md`** completa: respaldo, simulación, revisar los conteos,
      confirmar con el enlace exacto (`filo`) y borrar los archivos en Storage.
  - Debe verse: la simulación muestra el negocio **Filo**, el correo de tu cuenta de dueño con `t`
    en "Cuentas del personal", y al repetirla dice `No existe un negocio con el enlace "filo"`.
- [ ] Abre `https://turnos-smoky-nine.vercel.app/filo`. Debe verse: página de "no encontrado".

## 2. Crear Gamma Club (antes de desplegar)

La versión que está en producción todavía deja crear negocios.

- [ ] Abre `https://turnos-smoky-nine.vercel.app/crear-negocio`.
- [ ] Regístrate con tu correo de siempre y una contraseña nueva (la cuenta anterior se borró con
      Filo). Nombre: **Gamma Club**. Enlace: **`gamma-club`** (exacto, sin mayúsculas ni espacios).
  - Debe verse: entras al panel del dueño ("Hoy") y `/gamma-club` abre la página pública del negocio.
- [ ] Guarda la contraseña en tu gestor de contraseñas.

## 3. Desplegar

- [ ] En la carpeta principal del repo, en `main` y al día: `vercel deploy --prod`. No hay
      migraciones que subir.
  - Debe verse: el despliegue termina en "Ready" y no pediste `TURNOS_MODULES` (sin la variable rige
    el modo esencial).
- [ ] Abre `https://turnos-smoky-nine.vercel.app/` en una ventana privada. Debe verse: te lleva a
      `/gamma-club`.

## 4. Cargar Gamma Club (como dueño)

Entra en `/entrar` con tu correo. Desde el menú:

- [ ] **Negocio**: nombre, dirección, teléfono y lo que pida la pantalla.
- [ ] **Barberos**: crea cada barbero con celular y PIN de 6 dígitos y su porcentaje de comisión.
      Anota los PIN en un lugar privado.
- [ ] **Servicios**: nombre, precio en pesos y duración; asígnalos a cada barbero.
- [ ] **Horario**: días y horas de atención.
- [ ] **Fidelidad**: la regla de premio (por ejemplo, cada cuántos cortes).
- [ ] **Productos**: los que vendes (helados, bebidas) con precio y, si quieres, foto y categoría.
- [ ] **Privacidad**: el aviso de privacidad (texto con el que el cliente acepta al tomar turno).
  - Debe verse en cada pantalla: el dato guardado queda al volver a abrirla.

## 5. Prueba en el celular como dueño

Con tu celular, entra a Gamma Club como dueño.

- [ ] **Menú con 14 destinos.** Barra de abajo: Hoy, Fila, Caja, Clientes y "Más". Abre "Más" (o el
      menú lateral en el computador). Debe verse, por grupos:
  - Operación: Hoy, Fila, Caja, Semana.
  - Clientes: Clientes, Fidelidad.
  - Local: Productos, Inventario.
  - Configuración: Barberos, Servicios, Horario, QR, Negocio, Privacidad.
  - **No** deben salir: Citas, Membresías, Tarjetas de regalo, Recordar, Limpieza, Mensajes.
- [ ] **"Hoy" sin lo apagado.** Debe verse: sin bloque de citas, sin "Recordar", sin alertas de
      limpieza; la rejilla de atajos sin huecos en el celular y en el computador.
- [ ] **Pantallas encendidas sin rastros de lo apagado.** Debe verse: en Fidelidad, solo la
      tarjeta (sin el panel "Recordar"); en Fila, sin la tarjeta de limpieza; en Barberos, sin
      "Fotos de cortes".
- [ ] **Rutas apagadas.** Escribe a mano en la barra del navegador
      `https://turnos-smoky-nine.vercel.app/admin/citas` y luego `/admin/limpieza`. Debe verse:
      ambas te llevan a `/admin` (Hoy).
- [ ] **"Crear negocio" cerrado.** Abre `/crear-negocio`. Debe verse: te lleva a `/entrar`, y en
      `/entrar` no hay enlace para crear negocio.
- [ ] **La portada.** Abre `/`. Debe verse: `/gamma-club`, sin botón de "Reservar una cita".
- [ ] **QR.** En **QR**, abre el código con el celular del cliente. Debe verse la página pública de
      Gamma Club con la fila.

## 6. Un turno completo (cliente, barbero y dueño)

Usa tu propio nombre como cliente y anula la venta de prueba al final.

1. **Cliente (otro celular).** Escanea el QR. Debe verse: "N esperando", el formulario con
   "¿Qué te vas a hacer?" y "¿Con quién?". Elige servicio y barbero, escribe nombre y celular,
   acepta la privacidad y toca **Tomar turno**.
   - Debe verse: "Mi turno" con tu número grande, "Vas de N.º" y la barra de pasos.
2. **Barbero (su celular, celular + PIN).** Entra en `/entrar`.
   - [ ] **Barra de abajo con 4 destinos**: Mi fila, Clientes, Números y Mi estación (más "Más" con
         "Nueva venta" y "Salir"). **No** deben salir Limpieza ni Mis fotos.
   - [ ] Abre a mano `https://turnos-smoky-nine.vercel.app/app/limpieza`. Debe verse: te lleva a
         "Mi fila" (`/app/fila`). Igual con `/app/mis-fotos`.
   - [ ] En Mi fila: **Llamar a <número>**. En el celular del cliente debe verse "¡Es tu turno!".
   - [ ] **Empezar corte** → **Terminar y cobrar**.
3. **Cobro con comisión.** En el cobro, revisa servicio y precio, **+ Agregar producto** (un
   helado o bebida), y elige el medio de pago. Toca **Cobrar $ …**.
   - Debe verse: venta registrada con el total correcto; en el cobro no sale la tarjeta de regalo
     como pago si no tienes ninguna.
4. **Fidelidad.** Repite el turno con el mismo cliente hasta cumplir la regla (o mira su ficha en
   **Clientes**). Debe verse: el conteo de cortes sube y, al llegar al premio, aparece el aviso del
   corte gratis.
5. **Venta de un producto suelta.** Barbero: **Más → Nueva venta**, elige un producto y cobra.
   - Debe verse: la venta con "¿Quién vendió?" y la comisión de productos en **Números**.
6. **Números del barbero.** **Números** debe mostrar lo ganado hoy (servicio + comisión).

## 7. Cierre de caja y liquidación (dueño)

- [ ] **Caja**: el resumen del día con efectivo, transferencias y las ventas de arriba. Si ves
      una venta de prueba, ábrela y **Anular**.
- [ ] Cuenta el efectivo y toca **Cerrar caja**. Debe verse: el cierre guardado y la caja del día
      bloqueada (solo tú puedes reabrirla, con motivo).
- [ ] **Semana**: el resumen semanal por barbero con servicios, comisión y lo que debes liquidar.
      Debe verse: el total del barbero coincide con lo que él ve en **Números**.
- [ ] **Inventario** (opcional, otro día): abre la pantalla; el catálogo y el primer conteo se
      cargan después.

## 8. Cierre

- [ ] **Imprime el QR** de Gamma Club (**QR** → imprimir) y pégalo en la barbería.
- [ ] Si todo salió bien, dime "aprobado" para escribir el ADR-056 y cerrar el Hito 17 (T-191).

---

## Si algo falla

- **El menú, "Hoy" o una ruta se ve distinta a lo de esta guía.** Anota qué pantalla es y qué falta
  o sobra; el cambio es de la lista en `src/lib/domain/modules.ts`, sin migraciones.
- **Necesitas algo de lo apagado (citas, limpieza, mensajes, etc.) ya mismo, o la app se comporta
  raro.** Vuelve a encender todo sin tocar código: en Vercel → proyecto `turnos` → _Settings_ →
  _Environment Variables_ → agrega `TURNOS_MODULES` con el valor `todos` (solo Production) y
  **redespliega** (_Deployments_ → el último → _Redeploy_). Con `todos` vuelven los 20 destinos,
  `/` vuelve a la portada de TurnOS y "Crear negocio" vuelve a abrirse. Para volver al modo esencial,
  borra la variable y redespliega.
- **Desplegaste antes de crear Gamma Club y ya no se puede crear.** Pon `TURNOS_MODULES=todos`,
  redespliega, crea Gamma Club en `/crear-negocio`, borra la variable y redespliega de nuevo.
- **No entras como dueño después de borrar Filo.** Tu cuenta se borró con Filo: regístrate de nuevo
  en `/crear-negocio` con el mismo correo (paso 2). Si la versión ya cerró el registro, usa el
  caso anterior.
- **Un barbero de Filo no puede entrar.** Sus cuentas se borraron con Filo: créalo de nuevo en
  **Barberos** con celular y PIN.
- **El borrado de Filo dio error.** No se borró nada (todo va en una transacción); mira
  "Si el borrado falla" en `docs/guia-borrar-negocio.md` y avísame con el error completo.
- **Una venta o un cierre de prueba quedó mal.** Anula la venta desde **Caja**; un cierre solo se
  reabre con motivo.
