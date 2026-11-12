# Plan de ejecución — Hito 17: modo esencial y un solo negocio (Gamma Club)

Contexto para el arnés principal y para cada agente. La fuente de verdad es `specs/`:
REQ-079 y REQ-080 (`requirements.md` §5n), `design.md` §23, ADR-055 y T-184…T-191 (`tasks.md`).
Si este plan y la spec no coinciden, manda la spec.

Estado: **spec aprobada por Henry el 2026-11-12**. Nada de código está hecho. No se ejecuta ningún agente hasta
que Henry termine la Fase 0.

## 1. Objetivo

Salir a producción con una app liviana centrada en barberos y caja, solo para la barbería
**Gamma Club**. Lo que no se usa se apaga (deja de verse); no se borra código, tablas ni datos.
Sin migraciones.

## 2. Decisiones de Henry (cerradas, no reabrir)

| Tema                 | Decisión                                                                                                                   |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Encendido (dueño)    | Hoy, Fila, Caja, Semana, Clientes, Fidelidad, Productos, Inventario, Barberos, Servicios, Horario, QR, Negocio, Privacidad |
| Encendido (barbero)  | Mi fila, Clientes, Mis números, Mi estación                                                                                |
| Apagado              | Citas, Membresías, Tarjetas de regalo, Recordar, Limpieza, Mensajes, Mis fotos                                             |
| Dónde vive la lista  | En código (`src/lib/domain/modules.ts`), igual para todos. Sin columna ni migración                                        |
| Negocios             | Uno solo. Gamma Club se crea **nuevo** con el enlace `gamma-club`. Registro de negocios cerrado                            |
| Filo                 | Se borra de producción, con procedimiento probado que corre Henry                                                          |
| Alcance de la salida | Menús, "Hoy" y rutas. El recorte del cobro y del formulario de turno queda para después                                    |
| Productos            | Como está hoy                                                                                                              |
| PR #163              | Lo fusiona Claude cuando el CI esté verde                                                                                  |

## 3. Fase 0 — lo que hace Henry antes de lanzar los agentes

Los agentes no arrancan hasta que estén marcados 1, 2 y 3.

- [x] 1. **Aprobar la spec**: leer REQ-079, REQ-080 y ADR-055 en el PR de la spec y fusionarlo (o
      decir "aprobado").
- [x] 2. **PA-H17-3 resuelta (2026-11-12)**: el dueño de Gamma Club usa el mismo correo que el de
      Filo. Por eso Filo se borra **antes** de crear Gamma Club (Fase 3, pasos 1 y 2).
- [x] 3. **Confirmar que el PR #163 quedó fusionado** (Hitos 8, 15 y 16 aprobados).
- [ ] 4. Tener a la mano los datos de Gamma Club: barberos con celular y PIN, servicios con precio
      y duración, porcentaje de comisión, horario, regla de fidelidad y productos. Se cargan en la
      Fase 3; no bloquea a los agentes.

## 4. Fases de los agentes (sin interrupción)

Un agente por tarea, cada uno en su rama y su PR desde `main` al día. El arnés fusiona en el orden
de las olas y solo lanza una ola cuando la anterior está en `main` con CI verde.

| Ola | Tareas (en paralelo dentro de la ola) | Modelo                         | Complejidad | Por qué en esta ola                                |
| --- | ------------------------------------- | ------------------------------ | ----------- | -------------------------------------------------- |
| 1   | T-184 lista de módulos                | Sonnet 5.5                     | Baja        | Todas las demás la importan                        |
| 1   | T-190 borrar un negocio               | Opus 5.5                       | Alta        | Archivos propios; no depende de nada               |
| 2   | T-185 menú del dueño                  | Haiku 5.5                      | Baja        | Solo `admin-nav`, `AdminNav`, layout del dueño     |
| 2   | T-186 menú del barbero                | Haiku 5.5                      | Baja        | Solo `barber-nav`, `BarberNav`, layout del barbero |
| 2   | T-187 "Hoy" sin lo apagado            | Sonnet 5.5                     | Media       | Solo `(hoy)/page.tsx` y `components/admin/today/`  |
| 2   | T-188 rutas apagadas                  | Sonnet 5.5                     | Media       | `src/proxy.ts` y las tres páginas públicas         |
| 3   | T-189 un solo negocio                 | Sonnet 5.5                     | Media       | Toca `src/proxy.ts` otra vez: va después de T-188  |
| 4   | T-191 validación                      | Sonnet 5.5 + revisión Opus 5.5 | Media       | Necesita todo en `main`                            |

Dos escritores nunca tocan el mismo archivo en la misma ola. Los archivos de cada tarea están en
`specs/tasks.md`; un agente que necesite tocar uno fuera de su lista se detiene y avisa al arnés.

### Reglas para cada agente

1. Leer primero `CLAUDE.md`, este plan, su tarea en `specs/tasks.md` y la parte de `design.md` §23
   que le toca. Hacer solo esa tarea.
2. Pruebas primero, con el criterio en el nombre: `it('REQ-079.2 …')`. Luego el código.
3. Antes de abrir el PR: `pnpm lint`, `pnpm typecheck`, `pnpm lint:texts`, `pnpm test`; T-190
   además `pnpm db:test`. Pegar el resultado en el PR.
4. Commit `T-NNN: …` en español, sin atribución de IA, con `git add` por rutas explícitas.
5. **No tocar** `specs/tasks.md`, `specs/traceability.md`, `docs/estado-del-proyecto.md` ni
   `CLAUDE.md`: los actualiza el arnés (regla 6 del arnés). Así las olas en paralelo no chocan.
6. Toda la UI en español colombiano. Sin migraciones en este hito.
7. Si la spec está incompleta o equivocada: detenerse y reportar al arnés; no decidir solo.
8. Nunca producción: ni `supabase db push`, ni SQL remoto, ni despliegues, ni leer `.env*`.

### Reglas para el arnés

1. Lanzar cada ola desde `main` al día; esperar CI verde de cada PR antes de fusionar.
2. Si un PR falla en CI, devolverlo al mismo agente con el registro; al segundo intento fallido,
   usar `/diagnosing-bugs`.
3. Fusionar los PR de una ola uno por uno; si el segundo ya no aplica limpio, el agente lo pone al
   día con `main` (sin `--force` sobre ramas ajenas).
4. No avanzar de ola con un PR abierto de la ola anterior.
5. T-189 no se **despliega** hasta que Henry confirme que Gamma Club existe (se puede fusionar; el
   despliegue es de Henry).
6. Al fusionar cada tarea, marcar `[x]` con nota en `specs/tasks.md`; en T-191 correr
   `pnpm trace --hito=17`, regenerar `specs/traceability.md` y poner al día
   `docs/estado-del-proyecto.md` y `CLAUDE.md`.
7. Lo que requiera a Henry se junta y se le entrega una sola vez, al final de la ola 4.

### Cómo se sabe que cada ola terminó

- Ola 1: `modules.ts` con sus pruebas en `main`; E2E y Lighthouse corren con
  `TURNOS_MODULES=todos` y siguen verdes; `scripts/delete-business.sql` con pgTAP verde y guía.
- Ola 2: en modo esencial, 13 destinos del dueño y 4 del barbero; "Hoy" sin citas, recordar ni
  alertas de limpieza; cada ruta apagada lleva al inicio.
- Ola 3: `/` lleva a `/gamma-club`; `/crear-negocio` lleva a `/entrar`.
- Ola 4: `pnpm trace --hito=17` sin huecos; revisión de código sin hallazgos abiertos; guía de
  prueba en `docs/guia-prueba-hito-17.md`.

## 5. Fase 3 — lo que hace Henry después de los agentes

En este orden, que es obligatorio porque el dueño usa el mismo correo en los dos negocios: el
borrado de Filo también borra su cuenta de dueño, y al crear Gamma Club se registra de nuevo con ese
correo y una contraseña nueva.

- [ ] 1. **Borrar Filo** con `docs/guia-borrar-negocio.md`: correr la simulación, revisar los
      conteos, confirmar con el `slug` exacto y borrar sus archivos en Storage. No tiene vuelta
      atrás.
- [ ] 2. **Crear Gamma Club** en producción desde `/crear-negocio`, con el enlace `gamma-club`.
      Tiene que ser **antes** de desplegar T-189.
- [ ] 3. **Desplegar `main`** a producción. No hay migraciones.
- [ ] 4. **Cargar Gamma Club**: barberos y PIN, servicios, comisión, horario, regla de fidelidad,
      productos, aviso de privacidad.
- [ ] 5. **Prueba en el celular** con `docs/guia-prueba-hito-17.md`: turno, cobro, cierre de caja y
      liquidación de la semana, como dueño y como barbero.
- [ ] 6. **Imprimir el QR** de Gamma Club.
- [ ] 7. **Aprobar el hito** (ADR nuevo).
- [ ] 8. Otro día: inventario (catálogo, dotación por estación, primer conteo).

## 6. Riesgos conocidos

- El E2E corre con todo encendido, así que no recorre la app en modo esencial. Lo cubren las
  pruebas unitarias y la prueba de Henry en el celular.
- Borrar Filo es irreversible y arrastra clientes, ventas y cierres de las pruebas. La simulación
  muestra los conteos antes.
- Si T-189 se despliega antes de crear Gamma Club, ya no hay cómo crearlo desde la app: habría que
  desplegar de nuevo con `TURNOS_MODULES=todos` por un rato.
- El cobro y el formulario de turno conservan opciones de módulos apagados que se esconden solas
  sin datos; no se verificó el pago con tarjeta de regalo ni la bebida de cortesía.
