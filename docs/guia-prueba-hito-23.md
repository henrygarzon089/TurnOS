# Guía de prueba de Henry · Hito 23 (descripción de los servicios y del negocio)

Para aprobar T-264: que puedas escribir una descripción corta de cada servicio y otra del negocio
desde el celular, y que el cliente las vea donde toca. Hay una migración nueva (`0076`) que se
aplica en producción **antes** de desplegar.

Necesitas: tu celular (dueño) y otro celular o una ventana privada para hacer de cliente.

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y mándamelo.

---

## 1. Base de datos y despliegue (lo haces tú)

- [ ] El PR #199 está en verde y fusionado en `main`.
- [ ] Aplica la migración `supabase/migrations/0076_descriptions.sql` en producción
      (`supabase db push`). Solo agrega dos columnas opcionales y no cambia datos.
- [ ] Despliega `main` a producción en Vercel y espera "Ready".

## 2. Descripción de un servicio

- [ ] Entra a **https://www.gammaclub.co/entrar** → Menú → **Servicios** → **Editar** en "Corte".
- [ ] Debajo de nombre, minutos y precio está **Descripción**, con "Opcional. La ve el cliente al
      escoger el servicio." y el contador **0/140**.
- [ ] Escribe, por ejemplo, "Corte con máquina y tijera, lavado y peinado". El contador sube.
- [ ] Toca **Guardar**: la hoja se cierra.

## 3. El cliente ve la descripción al escoger

- [ ] En el otro celular abre **https://www.gammaclub.co/gamma-club** → **Tomar turno**.
  - Debe verse: en la tarjeta de "Corte", la descripción en gris debajo de "30 min" y arriba del
    precio. Los servicios sin descripción se ven igual que antes.
- [ ] Vuelve y toca **Reservar una cita**: la misma descripción en la tarjeta de "Corte".

## 4. Descripción del negocio

- [ ] Menú → **Negocio** → arriba de "Dirección" está **Descripción del negocio**, con "Opcional.
      Sale en la portada, debajo del nombre." y el contador **0/200**.
- [ ] Escribe una frase sobre Gamma Club y toca **Guardar**: sale "Guardado.".
- [ ] En el otro celular recarga **/gamma-club**: la frase sale en gris debajo del nombre y del
      "Abierto hasta …".
- [ ] Toca **Tomar turno**: durante los pasos la frase ya no sale (la cabecera queda pequeña).

## 5. Borrar

- [ ] Borra el texto de la descripción de "Corte" y guarda: la tarjeta vuelve a verse como antes.
- [ ] Si quieres, haz lo mismo con la del negocio. Después escribe las descripciones definitivas.

## 6. Aprobación

- [ ] Si todo salió bien, dime "Hito 23 aprobado" y lo dejo anotado (ADR nuevo y T-264).
