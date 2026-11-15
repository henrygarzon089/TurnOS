---
name: cerrar-hito
description: Prepara el cierre de un hito de TurnOS - matriz de trazabilidad sin huecos, estado del proyecto al día y guía de prueba para Henry. Usar cuando Henry diga "/cerrar-hito N", "cierra el hito N" o al terminar la última tarea de construcción de un hito.
argument-hint: N
---

# /cerrar-hito N

Tú preparas el cierre; **no apruebas el hito**: solo Henry aprueba, y su aprobación queda en un
ADR nuevo con sus palabras.

1. **Matriz.** Corre `pnpm trace --hito=N`. Si hay CA sin prueba, lístalos (CA → tarea) y
   detente: un hito no cierra con huecos. Si el hito no está en `HITOS` de
   `scripts/traceability.ts`, agrégalo con su rango de REQ y súmalo a
   `tests/unit/traceability.test.ts`.
2. **Tareas.** Todas las de construcción del hito en `[x]` en `specs/tasks.md`; la de validación
   queda `[ ]` hasta que Henry pruebe.
3. **Verificación completa.** `pnpm typecheck`, `pnpm lint`, `pnpm lint:texts`,
   `pnpm lint:design`, `pnpm test`, `pnpm test:integration` y `pnpm db:test` si hay SQL. Las E2E
   las corre el CI.
4. **Estado.** Pon al día `docs/estado-del-proyecto.md`: qué quedó del hito, migraciones nuevas
   (y si ya están en producción), pendientes de Henry. Actualiza "Estado actual" de `CLAUDE.md`
   en una o dos líneas.
5. **Guía de prueba para Henry** (`docs/guia-prueba-hito-N.md`): pasos numerados para hacerlos
   desde el celular, con URL, usuario y lo que debe ver en cada paso, y al final "si todo salió
   bien, dime 'Aprobado'".
6. Commit `Hito N: …` por rutas explícitas y cuéntale a Henry qué falta de su lado.
