# Guía de prueba de Henry · Hito 25 (Mi agenda del barbero)

Para aprobar T-283: que Pedro y Stiven vean desde su celular las citas que tienen reservadas hoy y
los próximos 7 días, y que ninguno vea las del otro.

Necesitas: tu celular (dueño) y el celular de un barbero (o el tuyo entrando con su celular y PIN).

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y mándamelo.

---

## 1. Desplegar (lo hace la sesión principal si se lo pides)

- [ ] La migración `0078_barber_agenda.sql` quedó aplicada en producción **antes** del deploy.
- [ ] El deploy de `main` quedó en https://www.gammaclub.co.

## 2. Reservar una cita para mañana

- [ ] Desde otro celular o en incógnito, entra a **https://www.gammaclub.co/gamma-club** →
      **Reservar una cita** → escoge un servicio, **Stiven** y una hora de **mañana**.

## 3. El barbero ve su agenda

- [ ] Entra como **Stiven** (`/entrar`, celular y PIN). En la barra de abajo debe estar
      **Agenda**, de segunda, después de "Mi fila". "Mi estación" quedó en **Más**.
- [ ] Toca **Agenda**. Debe verse **Mañana** con la cita: la hora de inicio y fin, el nombre del
      cliente y "Corte · 30 min" (o el servicio que escogiste). No sale el celular del cliente.
- [ ] Abajo dice "Para cambiar o cancelar una cita, habla con el dueño." y no hay botones para
      cancelar ni mover.

## 4. El otro barbero no la ve

- [ ] Entra como **Pedro** y toca **Agenda**: la cita de Stiven **no** sale.

## 5. Se pone al día sola

- [ ] Con la Agenda de Stiven abierta, cancela la cita desde tu celular de dueño (**Citas** → la
      cita → **Cancelar**). En unos segundos debe desaparecer de la Agenda de Stiven sin recargar.

## 6. Aprobar

Si todo salió bien, escríbeme **"Aprobado Hito 25"** y lo dejo en un ADR nuevo.
Aprobado por Henry el 2026-11-18 (ADR-075).
