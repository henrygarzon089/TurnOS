# Guía de prueba · Hito 28 — Trabaja con nosotros (REQ-102, ADR-079)

## Antes de publicar (Henry)

1. Fusionar el PR del Hito 28.
2. Aplicar la migración `0081_job_applications.sql` en producción **antes** del deploy
   (crea la tabla de postulaciones y el borrado automático a los 12 meses).
3. Desplegar `main` a producción.
4. En **Privacidad** del menú del dueño, agrega este párrafo al aviso y publica la versión nueva
   (revísalo con tu abogado si quieres):

   > **Postulaciones de trabajo.** Si te postulas en "Trabaja con nosotros", tratamos tu nombre,
   > celular, rol, años de experiencia, disponibilidad, enlace a tu trabajo y el mensaje que nos
   > dejes, solo para el proceso de selección y para contactarte por WhatsApp o llamada. No los
   > compartimos con terceros. Se borran automáticamente a los 12 meses, o antes si nos lo pides
   > al 320 714 5752.

## Probar desde el celular

1. Abre https://www.gammaclub.co y baja hasta la franja **"¿Eres barbero o estilista?"**.
   Toca **Conoce la oportunidad**. También está en el pie de la página.
2. En **Trabaja con nosotros** revisa: "Oportunidad laboral", "Barberos & Estilistas", los tres
   beneficios (Horario flexible, % negociable, Únete al club), qué buscamos, el proceso en
   4 pasos y las preguntas frecuentes. Sobre el pago no hay cifras.
3. Toca **Escribir por WhatsApp**: abre WhatsApp al 320 714 5752 con el mensaje listo.
4. Toca **Postularme** y envía el formulario sin escoger "Soy": te dice qué falta y no borra lo
   que escribiste. Llénalo completo, acepta el aviso y envía: sale **"¡Listo!"**.
5. Entra como dueño. En el menú aparece **Postulaciones** con el número de nuevas. Ábrela:
   - Ves nombre, rol, años, disponibilidad, Instagram y mensaje.
   - **Escribir por WhatsApp** abre el chat con un saludo listo.
   - **Marcar contactada** la pasa a "Contactadas"; **Descartar** a "Descartadas".
   - **Borrar datos** pide confirmación y la borra.
6. Si todo está bien, escribe **"apruebo Hito 28"**.
