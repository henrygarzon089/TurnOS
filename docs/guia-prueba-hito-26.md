# Guía de prueba · Hito 26 — Importar de Fresha (REQ-100, ADR-076)

Para Henry, desde el computador (Fresha exporta mejor desde ahí) y luego el celular.

## Antes

1. Revisa que **Citas** esté encendido en la app (sin eso solo se importan clientes).
2. Revisa que los barberos y servicios de la app tengan los mismos nombres que en Fresha. Si no, la
   app te pregunta a cuál equivale cada uno.

## Exportar de Fresha

1. **Clientes**: en Fresha, abre la lista de clientes y busca la opción de exportar o descargar
   (CSV o Excel).
2. **Citas**: abre las citas o la agenda, elige desde hoy hasta la última cita reservada y exporta
   el archivo.
3. Mándame **solo la primera fila** de cada archivo (los títulos de las columnas), sin datos de
   clientes, para confirmar que el lector los reconoce (PA-H26-1).

## Importar

1. En la app: **Clientes** → **Importar de Fresha**.
2. Sube los dos archivos y toca **Revisar**. Mira el resumen: clientes nuevos, los que ya estaban,
   los descartados (sin celular, celular de otro país, sin nombre) y las citas de hoy en adelante.
   Todavía no se guarda nada.
3. Si sale "Nombres que no están en la app", escoge el barbero o servicio equivalente.
4. Toca **Importar**. Revisa la lista "No se importaron": cada cita dice por qué (el barbero ya
   tiene otra cita, el día está cerrado, el cliente ya tiene una cita…). Créalas a mano en Citas.
5. Revisa en **Citas** (agenda) y en **Mi agenda** del barbero que las citas estén.
6. Vuelve a importar los mismos archivos: no debe duplicar nada ("Citas que ya estaban").

## Después (operación, no código)

1. Desactiva las reservas en línea de Fresha el mismo día que importas las citas.
2. Cambia el enlace de "Reservar" en Google, Instagram y WhatsApp a https://www.gammaclub.co.
3. Cancela Fresha cuando no queden citas allá.

Los clientes importados no reciben mensajes hasta que acepten el aviso de privacidad la próxima vez
que tomen turno o reserven.

## Aprobación

Si todo está bien, dime "Aprobado el Hito 26".
