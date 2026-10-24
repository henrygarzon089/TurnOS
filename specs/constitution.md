# TurnOS — Constitución del proyecto

> Estado: **APROBADA v1.0** (Henry, 2026-10-23)
> Fecha: 2026-10-23
> Este documento define los principios no negociables de TurnOS. Cualquier requisito, diseño,
> tarea o línea de código que los contradiga está mal, no la constitución. Cambiar un principio
> requiere una entrada en `decisions.md` y aprobación explícita del dueño del producto (Henry).

## 1. Propósito

TurnOS es un software multi-negocio para negocios de servicios de barrio en Colombia. Resuelve un
problema concreto: que un cliente pueda tomar su turno sin estar físicamente esperando en el local,
y que el negocio tenga orden en su fila, en sus clientes y en su caja.

El primer cliente real es una barbería en Sabaneta (Antioquia): 5 sillas, barberos independientes
que dejan un porcentaje al negocio, y venta de helados y bebidas. Sus usuarios finales son familias
de una unidad residencial de más de 2.000 familias y de colegios cercanos; en especial papás con
niños que no quieren esperar en el local.

Cada decisión se evalúa primero contra esa barbería. Lo que no sirve allí no entra al MVP.

## 2. Principios (no negociables)

### P1. El cliente no instala nada ni crea contraseñas
- El cliente se identifica únicamente con **nombre y número de celular**.
- No hay registro, login, contraseña, OTP ni app nativa para el cliente.
- Todo el contacto saliente con el cliente pasa por **WhatsApp** (en el MVP, enlaces `wa.me` con
  mensaje prellenado; después, WhatsApp Cloud API).
- Consecuencia de diseño: el celular es la clave natural del cliente dentro de un negocio, y los
  enlaces que recibe el cliente deben ser seguros sin autenticación (tokens no adivinables).

### P2. Simplicidad radical
- Un dueño de barbería sin conocimientos técnicos debe poder usar TurnOS **sin capacitación**.
- Cada pantalla tiene una acción principal obvia. Si una función necesita manual, se rediseña o se
  elimina.
- Lenguaje de la interfaz: español cotidiano colombiano, sin jerga técnica ("Llamar al siguiente",
  no "Avanzar cola").
- Se prefiere una buena opción por defecto antes que una configuración.

### P3. Móvil primero, PWA, funciona en celulares de gama media
- La interfaz se diseña primero para el celular del barbero y del cliente; el escritorio es
  secundario.
- La app es una PWA instalable, rápida en redes móviles irregulares.
- Las acciones críticas del barbero (llamar, en servicio, terminado) deben completarse con un toque
  y tolerar pérdida momentánea de conexión sin perder ni duplicar información.

### P4. Multi-tenant desde el primer día
- Todas las tablas de negocio llevan `business_id`.
- Row Level Security (RLS) en Postgres aísla cada negocio. Ninguna consulta de aplicación depende
  de "acordarse" de filtrar por negocio: la base de datos lo garantiza.
- El modelo de datos soporta desde el inicio que un dueño tenga varios negocios, aunque el MVP solo
  exponga uno.

### P5. Colombia por defecto
- Interfaz 100% en español.
- Moneda: pesos colombianos (COP), **sin decimales**, con separador de miles (`$ 25.000`).
- Zona horaria: `America/Bogota` para todo cálculo de "hoy", cierres de caja y semanas.
- Celulares colombianos (10 dígitos, inician en 3) normalizados a formato E.164 (`+57…`).

### P6. Protección de datos personales (Ley 1581 de 2012)
- Antes de guardar nombre y celular, el cliente ve un aviso de privacidad y lo acepta de forma
  explícita; se registra fecha y versión del aviso aceptado.
- Se recolecta el mínimo necesario para prestar el servicio.
- El negocio (responsable del tratamiento) puede atender solicitudes de consulta y supresión de un
  cliente; el sistema lo hace posible sin intervención técnica.
- Las pantallas públicas (televisor del local) nunca muestran celulares ni nombres completos.

### P7. La especificación es la fuente de verdad
- `requirements.md` define QUÉ, `design.md` define CÓMO, `tasks.md` define el plan.
- Si el código y la especificación no coinciden, se corrige uno de los dos de forma explícita y
  registrada, nunca en silencio.
- No se escribe código de aplicación sin que la especificación, el diseño y el plan de tareas
  correspondientes estén aprobados.
- Cada decisión relevante queda en `decisions.md` con contexto, opciones consideradas y razón.

### P8. Calidad verificable
- Toda funcionalidad tiene pruebas derivadas directamente de sus criterios de aceptación.
- Para cada tarea se escriben primero las pruebas y luego el código.
- Un hito no se cierra sin una matriz de trazabilidad REQ → tareas → pruebas → estado, y ningún
  requisito del hito puede quedar sin prueba que lo cubra.
- Las migraciones de base de datos están versionadas y son reproducibles desde cero con datos de
  ejemplo (seed).

### P9. El dinero se trata con cuidado
- Montos siempre en enteros (COP sin decimales); nunca `float`.
- Todo movimiento de caja es un registro inmutable: corregir es anular y volver a registrar, no
  editar.
- Las comisiones se calculan con una regla explícita, documentada y con ejemplos numéricos en el
  diseño, de modo que dueño y barbero lleguen al mismo número a mano.

### P10. Tiempo real donde importa, simple donde no
- La posición en la fila y el estado del turno se actualizan en tiempo real (Supabase Realtime).
- Todo lo demás (reportes, listas de clientes, cierres) puede ser consulta normal; no se añade
  complejidad en tiempo real sin un requisito que la justifique.

## 3. Stack técnico (fijo para el MVP)

| Capa | Decisión |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind CSS, PWA, mobile-first |
| Backend / datos | Supabase: Postgres, Auth (solo para personal del negocio), Realtime, Edge Functions |
| Despliegue | Vercel (app) + Supabase (datos) |
| Idioma de código | Identificadores y comentarios en inglés; textos de interfaz en español |
| Pruebas | Unit + integración (contra Supabase local) + end-to-end en viewport móvil |

Cambiar un elemento del stack es una decisión de arquitectura: va a `decisions.md`.

## 4. Roles

| Rol | Descripción | Autenticación |
|---|---|---|
| Dueño / administrador | Ve y configura todo el negocio: servicios, barberos, comisiones, caja, reportes, clientes | Supabase Auth |
| Barbero | Ve su fila, atiende turnos, registra sus servicios cobrados y consulta sus comisiones | Supabase Auth |
| Cliente | Toma turno, ve su posición; sin cuenta | Nombre + celular; enlace con token |

## 5. Definición de "terminado" para cualquier entrega

Una funcionalidad está terminada cuando:
1. Sus criterios de aceptación en `requirements.md` están aprobados.
2. Existen pruebas que cubren cada criterio y pasan.
3. Funciona en un celular real (Android gama media y iPhone) desde el navegador.
4. Los textos están en español y los montos en COP sin decimales.
5. La migración (si aplica) corre desde cero junto con el seed.
6. La tarea está marcada en `tasks.md` y la trazabilidad está actualizada.

## 6. Fuera del alcance del MVP (pero el modelo de datos debe soportarlo)

Reservas con hora fija, planes familiares por suscripción, referidos, WhatsApp Cloud API y varios
negocios por dueño. Ninguna decisión de modelo de datos del MVP puede hacer imposible o muy
costoso agregar estas funciones después.
