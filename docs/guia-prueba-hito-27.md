# Guía de Henry · Hito 27 (web de Gamma Club en gammaclub.co)

Para aprobar T-304: que https://www.gammaclub.co muestre la web de la barbería, que desde ella se
pueda reservar una cita y tomar turno, y que Google la pueda encontrar.

Necesitas: tu celular, el computador con acceso a Vercel y a Supabase, y 15 minutos.

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y mándamelo.

---

## 0. Antes de publicar: datos que me faltan

- [ ] **WhatsApp del local**: pásame el número (ej. `300 123 4567`). Mientras tanto la web no
      muestra el botón "Escríbenos por WhatsApp"; lo demás funciona igual.
- [ ] **Instagram**: la web enlaza a `@urusbarbershop.col`. Si Gamma Club tiene su propia cuenta,
      dime cuál.
- [ ] **Dirección**: sale de **Negocio** en la app. Revisa que diga el local y "Mall San Remo,
      Sabaneta" completo, porque con ella se arma el botón "Cómo llegar" de Google Maps.
- [ ] **Reseñas de Google**: el botón "Déjanos tu reseña" sale solo si ya está el enlace en
      **Negocio** (enlace de reseñas en Google, REQ-036).

## 1. Publicar (lo haces tú o la sesión principal si se lo pides)

1. [ ] Revisa y fusiona el PR del Hito 27 en `main` (con el CI en verde: E2E móvil y Lighthouse).
2. [ ] Aplica la migración **antes** del deploy, desde la carpeta del proyecto en `main`:

   ```bash
   supabase db push
   ```

   Debe aplicar solo `0080_public_site.sql` (es de solo lectura: una función nueva, sin tablas).

3. [ ] Despliega `main` a producción (como los hitos anteriores) y espera a que
       https://www.gammaclub.co cargue.
4. [ ] En Vercel → proyecto `turnos` → **Analytics** → **Enable** (Web Analytics). Revisa ahí
       mismo el cupo de eventos de tu plan. Si algún día quieres apagarla sin desplegar, crea la
       variable `TURNOS_WEB_ANALYTICS=off` en Vercel y vuelve a desplegar.

## 2. Probar desde el celular

- [ ] Abre **https://www.gammaclub.co**. Ya **no** salta a la fila: ves la foto del local, el
      nombre, si está **Abierto hasta …** o **Cerrado · abre …**, y los botones **Reservar una cita**
      y **Tomar turno**, sin bajar.
- [ ] Baja: **Servicios** (con fotos, precios y duración), **Cómo funciona**, **Nuestro equipo**,
      **Fidelidad** (la regla de tus 10 visitas), **Menú**, **Horario y ubicación** y
      **Contacto**.
- [ ] Al bajar aparece abajo una barra fija con **Reservar una cita**.
- [ ] Toca **Reservar una cita** → te lleva a la reserva de siempre. Reserva una de prueba y
      cancélala desde "Mi cita".
- [ ] Vuelve y toca **Tomar turno** → te lleva a `/gamma-club`, la fila de siempre.
- [ ] Toca **Cómo llegar** → abre Google Maps en el local.
- [ ] Arriba a la derecha, **Entrar** te lleva al ingreso del dueño y los barberos.
- [ ] Cambia el precio de un servicio en la app y recarga la web: el precio nuevo sale de una.
      (Déjalo como estaba.)
- [ ] El QR del local sigue llevando a la fila (`/gamma-club`), sin cambios.

## 3. Que Google la encuentre

1. [ ] Entra a https://search.google.com/search-console, agrega la propiedad
       `https://www.gammaclub.co` (verifica con el registro DNS que te pide, donde compraste el
       dominio).
2. [ ] En **Sitemaps**, envía `https://www.gammaclub.co/sitemap.xml`.
3. [ ] En **Inspección de URLs**, pega `https://www.gammaclub.co/` y toca **Solicitar
       indexación**.
4. [ ] Prueba los datos de la barbería en https://search.google.com/test/rich-results con
       `https://www.gammaclub.co/`: debe aparecer **Negocio local** sin errores.
5. [ ] En tu **Perfil de Empresa de Google** (Google Maps), pon `https://www.gammaclub.co` como
       sitio web.
6. [ ] En Instagram, cambia el enlace de la biografía a `https://www.gammaclub.co`.

## 4. Aprobar

- [ ] Si todo salió bien, escríbeme "apruebo Hito 27". Si algo no, dime qué y lo corrijo.
