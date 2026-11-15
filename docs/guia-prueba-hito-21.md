# Guía de prueba de Henry · Hito 21 (marca Gamma Club en la app)

Para aprobar T-245: que la app se vea como Gamma Club (logo, colores y letra del manual) en tu
celular, igual que en el local. No hay migraciones ni datos que cambiar: solo se ve distinto.

Necesitas: tu celular (dueño), el celular de un barbero o el tuyo con su PIN, el computador con el
televisor o un navegador grande, y el archivo `docs/marca/logos/logo-negocio-256.png` (pásatelo al
celular por WhatsApp o AirDrop). Para comparar, tienes las capturas en
`docs/diseno/capturas/hito-21/`.

Marca cada casilla. Si algo falla, anota la pantalla, qué tocaste y qué pasó, y mándamelo.

---

## 1. Desplegar

- [ ] El PR #192 está en verde y fusionado en `main` (si me lo pides, lo fusiono yo).
- [ ] En Vercel, el despliegue de producción de ese commit terminó en "Ready".

## 2. Logo del negocio

- [ ] Entra a **https://www.gammaclub.co/entrar** con tu correo de dueño.
- [ ] Menú → **Negocio** → tarjeta **Logo y portada** → sube `logo-negocio-256.png`.
  - Debe verse: el logo navy con el tornillo rojo, sin cortarse.

## 3. Reinstalar la app (el ícono cambia solo al reinstalar)

- [ ] Borra el ícono viejo de TurnOS de la pantalla de inicio.
- [ ] Abre **https://www.gammaclub.co/entrar** → compartir → **Añadir a pantalla de inicio**.
  - Debe verse: ícono cuadrado navy con el símbolo de Gamma Club y el nombre **Gamma Club**.

## 4. Revisar cada pantalla contra el manual

En todas: fondo crema, tarjetas blancas, botones y cabeceras en navy, letra **Montserrat** y nada
se corre de lado (prueba girando el celular). La pestaña del navegador dice `<pantalla> · Gamma Club`.

- [ ] **Portada** (`/gamma-club`, desde otro celular o en incógnito): tu logo encima de la foto del
      local, sin "Fila con TurnOS". Toca **Tomar turno**: los pasos de servicio y barbero se ven
      con la misma letra y colores.
- [ ] **Entrar** (`/entrar`): arriba el símbolo con **GAMMA CLUB** en mayúsculas espaciadas.
- [ ] **Hoy** (dueño): cabecera navy, "Piden tu atención" en rojo solo si hay algo urgente, y
      **nada se corre de lado** (es lo que arreglamos en T-244).
- [ ] **Mi fila** (barbero, con su celular y PIN): mismos colores y letra.
- [ ] **Televisor** (`/gamma-club/pantalla` en el computador o el TV): fondo navy, símbolo de
      Gamma Club, el número llamado se lee de lejos.
- [ ] Si te llega por WhatsApp una invitación de barbero nueva, dice "Gamma Club", no "TurnOS".

## 5. Aprobar

Si todo salió bien, escríbeme **"Aprobado Hito 21"** y lo dejo en un ADR nuevo. Si algo no te
gusta (un color, un tamaño), dímelo con la pantalla y lo corrijo antes de aprobar.
