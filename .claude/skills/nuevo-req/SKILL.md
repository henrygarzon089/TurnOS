---
name: nuevo-req
description: Redacta un requisito nuevo de TurnOS como propuesta - REQ con CA en EARS, ADR, sección de diseño y tareas con los siguientes números libres - y se detiene a esperar la aprobación de Henry. Usar cuando Henry pida una funcionalidad nueva, un cambio de reglas o diga "/nuevo-req".
argument-hint: <qué quiere Henry>
---

# /nuevo-req

La spec es la fuente de verdad: nada se construye sin un REQ aprobado.

1. **Entender.** Si la petición es ambigua, propón `/grill-with-docs` o haz 2–4 preguntas
   concretas antes de escribir. Si es una decisión cara (precios, pagos, datos de clientes),
   propón `/abogado-del-diablo`.
2. **Números libres.** Corre `pnpm next-ids` (mira `main` y todas las ramas remotas). Usa el
   siguiente REQ y ADR libres, un bloque nuevo de tareas (T-NN0) y el siguiente número de hito.
   Así dos ramas en paralelo no toman el mismo número.
3. **Redactar como propuesta**, en el formato de los vecinos:
   - `specs/requirements.md`: `### REQ-NNN · Título — M/S/C` con CA `REQ-NNN.n` en EARS
     ("Cuando…, el sistema DEBE…"), verificables; preguntas abiertas `PA-HNN-n` con propuesta;
     "Fuera de alcance".
   - `specs/decisions.md`: `## ADR-NNN` con Estado **propuesta**, Contexto, Decisión,
     Alternativas, Consecuencias.
   - `specs/design.md`: datos, RLS, estados, algoritmos, pruebas por capa.
   - `specs/tasks.md`: `## Hito NN` con orden, tareas `### [ ] T-NNN · …` con sus REQ, modelo
     y complejidad, y la de validación al final.
4. Commit `Spec: …, propuesta` en una rama propia.
5. **Detente.** Resume la propuesta para Henry en pocas líneas y espera la aprobación. No
   escribas pruebas ni código hasta que diga que sí; entonces marca el ADR como aceptado con sus
   palabras y la fecha.
