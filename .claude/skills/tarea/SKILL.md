---
name: tarea
description: Construye una tarea T-NNN de specs/tasks.md de TurnOS con el método SDD completo - pruebas primero, código, puerta de calidad, marcar [x], commit y cómo probarla desde el celular. Usar cuando Henry diga "/tarea T-NNN", "haz la T-NNN" o "sigue con la siguiente tarea".
argument-hint: T-NNN
---

# /tarea T-NNN

Una tarea a la vez, en orden (`CLAUDE.md`, Método). Si no te dan número, toma la primera `[ ]`
del hito en construcción.

1. **Leer.** La tarea en `specs/tasks.md`, cada REQ y sus CA en `specs/requirements.md`, la
   sección del hito en `specs/design.md` y su ADR. Si la spec está incompleta o es incorrecta:
   detente y propón el cambio (usa `/nuevo-req` si es un requisito nuevo).
2. **¿Es la siguiente en orden?** Revisa el orden del hito ("Orden: T-… → …") y que las tareas
   anteriores estén hechas. Si no es la siguiente en orden, avísale a Henry y pregunta antes de
   seguir.
3. **Rama.** Una tarea = una rama. Si estás en `main`, crea `claude/<tarea-corta>`.
4. **Pruebas primero.** Usa el subagente `escritor-pruebas` (o escríbelas tú) con el CA en el
   nombre: `it('REQ-NNN.n …')`, pgTAP `'REQ-NNN.n …'`. Córrelas y confirma que fallan.
5. **Código** hasta que pasen. Convenciones de `CLAUDE.md`: UI en español, dinero `integer`,
   `America/Bogota`, `business_id` + RLS, lógica en SQL `security definer` o `src/lib/domain/`.
   Si cambias SQL, pásale el diff al subagente `revisor-sql`; si cambias textos, a
   `revisor-textos`.
6. **Puerta de calidad.** `pnpm typecheck`, `pnpm lint:texts`, `pnpm lint:design`, `pnpm test`
   (y `pnpm db:test` si tocaste SQL). El hook Stop la corre solo, pero no esperes a él.
7. **Revisión de spec.** Subagente `revisor-spec`: si hay desvíos, anótalos en `tasks.md` o
   `design.md` (ADR si cambia el diseño). Nunca en silencio.
8. **Marcar `[x]`** en `specs/tasks.md` con "Hecha AAAA-MM-DD: …" y la nota del desvío si hubo.
9. **Commit** por rutas explícitas (`git add <archivo>…`), mensaje `T-NNN: <qué>` con los CA
   entre paréntesis, sin atribución de IA. Los hooks bloquean lo demás.
10. **Contarle a Henry cómo probarla desde el celular**: URL (`https://www.gammaclub.co/...` o el
    preview), con qué usuario, qué tocar y qué debe ver. Pasos numerados y cortos.
