# Guía de prueba de Henry · Hito 24 (descripción de los productos del menú)

Para aprobar T-273: que puedas escribir una descripción corta de un producto desde el celular y
que el cliente la vea en el menú. La migración `0077` ya está aplicada en producción y `main`
(`6c4d4c0`) ya está desplegado (2026-11-17).

Necesitas: tu celular (dueño) y otro celular o una ventana privada para hacer de cliente.

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y mándamelo.

---

## 1. Base de datos y despliegue (ya hecho)

- [x] El PR #202 está en verde y fusionado en `main`.
- [x] La migración `0077_product_description.sql` está aplicada en producción.
- [x] `main` está desplegado en https://www.gammaclub.co.

## 2. Descripción de un producto

- [ ] Entra a **https://www.gammaclub.co/entrar** → Menú → **Productos** → **Editar** en un
      producto que esté "A la venta".
- [ ] Debajo de producto y precio está **Descripción**, con "Opcional. La ve el cliente en el
      menú." y el contador **0/140**.
- [ ] Escribe una frase corta (por ejemplo, "Cera mate de fijación fuerte, sin brillo"). El
      contador sube.
- [ ] Toca **Guardar**: la hoja se cierra.

## 3. El cliente la ve en el menú

- [ ] En el otro celular abre **https://www.gammaclub.co/gamma-club** → **Ver menú**.
  - Debe verse: la descripción en gris debajo del nombre del producto, con el precio a la
    derecha. Los productos sin descripción se ven igual que antes.
- [ ] Toma un turno y, en **Mi turno**, toca **Ver menú del local**: la misma descripción.
- [ ] Las bebidas de cortesía al tomar turno se ven igual que antes (sin descripción).

## 4. Borrar

- [ ] Borra el texto de la descripción y guarda: la fila del menú vuelve a verse como antes.
- [ ] Después escribe las descripciones definitivas de los productos de Gamma Club.

## 5. Aprobación

- [x] Si todo salió bien, dime "Hito 24 aprobado" y lo dejo anotado (ADR nuevo y T-273).
