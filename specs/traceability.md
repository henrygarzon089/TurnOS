# Matriz de trazabilidad

> Generada por `scripts/traceability.ts` el 2026-10-24.
> Estado: **cubierto** = tareas hechas y prueba existente · **prueba escrita** = prueba existe, tarea sin cerrar · **sin prueba** = falta.

| CA | Requisito | Tareas | Pruebas | Estado |
|---|---|---|---|---|
| REQ-001.1 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (en curso), T-026 (en curso), T-030 (en curso) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | prueba escrita |
| REQ-001.2 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (en curso), T-026 (en curso), T-030 (en curso) | qr.spec.ts | prueba escrita |
| REQ-001.3 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (en curso), T-026 (en curso), T-030 (en curso) | qr.spec.ts | prueba escrita |
| REQ-001.4 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (en curso), T-026 (en curso), T-030 (en curso) | public-queue.test.ts, 0008_public_fns.sql | prueba escrita |
| REQ-001.5 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (en curso), T-026 (en curso), T-030 (en curso) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | prueba escrita |
| REQ-002.1 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (en curso), T-028 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-002.2 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (en curso), T-028 (en curso) | customer-flow.spec.ts, public-queue.test.ts | prueba escrita |
| REQ-002.3 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (en curso), T-028 (en curso) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-002.4 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (en curso), T-028 (en curso) | customer-flow.spec.ts | prueba escrita |
| REQ-002.5 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (en curso), T-028 (en curso) | privacy.spec.ts, 0002_core.sql | prueba escrita |
| REQ-003.1 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (en curso) | 0005_queue.sql, 0008_public_fns.sql | prueba escrita |
| REQ-003.2 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (en curso) | customer-flow.spec.ts, public-queue.test.ts, phone.test.ts | prueba escrita |
| REQ-003.3 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (en curso) | customer-flow.spec.ts, public-queue.test.ts, 0005_queue.sql, 0008_public_fns.sql | prueba escrita |
| REQ-003.4 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (en curso) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-003.5 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (en curso) | customer-flow.spec.ts, public-queue.test.ts, 0005_queue.sql, 0008_public_fns.sql | prueba escrita |
| REQ-003.6 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (en curso) | 0012_hito1_gaps.sql | prueba escrita |
| REQ-003.7 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (en curso) | customer-flow.spec.ts | prueba escrita |
| REQ-004.1 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (en curso), T-016 (hecha), T-017 (hecha), T-020 (en curso) | public-queue.test.ts, queue-estimate.test.ts, 0008_public_fns.sql | prueba escrita |
| REQ-004.2 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (en curso), T-016 (hecha), T-017 (hecha), T-020 (en curso) | customer-flow.spec.ts, queue-subscription.test.ts | prueba escrita |
| REQ-004.3 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (en curso), T-016 (hecha), T-017 (hecha), T-020 (en curso) | customer-flow.spec.ts | prueba escrita |
| REQ-004.4 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (en curso), T-016 (hecha), T-017 (hecha), T-020 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-004.5 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (en curso), T-016 (hecha), T-017 (hecha), T-020 (en curso) | queue-estimate.test.ts, time.test.ts | prueba escrita |
| REQ-004.6 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (en curso), T-016 (hecha), T-017 (hecha), T-020 (en curso) | customer-flow.spec.ts | prueba escrita |
| REQ-004.7 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (en curso), T-016 (hecha), T-017 (hecha), T-020 (en curso) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | prueba escrita |
| REQ-005.1 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-005.2 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (en curso) | customer-flow.spec.ts, public-queue.test.ts, 0006_transitions.sql, 0008_public_fns.sql | prueba escrita |
| REQ-005.3 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (en curso) | hito1-gaps.spec.ts, public-queue.test.ts | prueba escrita |
| REQ-006.1 | Vista de fila del barbero | T-015 (en curso), T-016 (hecha), T-021 (en curso) | barber-flow.spec.ts, 0007_queue_ops.sql | prueba escrita |
| REQ-006.2 | Vista de fila del barbero | T-015 (en curso), T-016 (hecha), T-021 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-006.3 | Vista de fila del barbero | T-015 (en curso), T-016 (hecha), T-021 (en curso) | 0009_realtime.sql | prueba escrita |
| REQ-006.4 | Vista de fila del barbero | T-015 (en curso), T-016 (hecha), T-021 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-006.5 | Vista de fila del barbero | T-015 (en curso), T-016 (hecha), T-021 (en curso) | barber-flow.spec.ts, 0007_queue_ops.sql | prueba escrita |
| REQ-007.1 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | barber-flow.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql | prueba escrita |
| REQ-007.2 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | call-next-race.test.ts | prueba escrita |
| REQ-007.3 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | 0006_transitions.sql | prueba escrita |
| REQ-007.4 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | 0006_transitions.sql | prueba escrita |
| REQ-007.5 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | barber-flow.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql | prueba escrita |
| REQ-007.6 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | 0007_queue_ops.sql | prueba escrita |
| REQ-007.7 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | 0005_queue.sql, 0010_notify.sql | prueba escrita |
| REQ-007.8 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (en curso), T-022 (en curso) | 0012_hito1_gaps.sql | prueba escrita |
| REQ-008.1 | Cliente que no llega | T-012 (hecha), T-020 (en curso), T-022 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-008.2 | Cliente que no llega | T-012 (hecha), T-020 (en curso), T-022 (en curso) | barber-flow.spec.ts, 0006_transitions.sql | prueba escrita |
| REQ-008.3 | Cliente que no llega | T-012 (hecha), T-020 (en curso), T-022 (en curso) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-008.4 | Cliente que no llega | T-012 (hecha), T-020 (en curso), T-022 (en curso) | 0012_hito1_gaps.sql | prueba escrita |
| REQ-009.1 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (en curso), T-024 (en curso) | queue-estimate.test.ts | prueba escrita |
| REQ-009.2 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (en curso), T-024 (en curso) | barber-flow.spec.ts, phone.test.ts, wa-me.test.ts | prueba escrita |
| REQ-009.3 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (en curso), T-024 (en curso) | barber-flow.spec.ts, 0010_notify.sql | prueba escrita |
| REQ-009.4 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (en curso), T-024 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-009.5 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (en curso), T-024 (en curso) | wa-me.test.ts | prueba escrita |
| REQ-010.1 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (en curso), T-023 (en curso), T-025 (en curso) | public-queue.test.ts, rls-core.test.ts, queue-estimate.test.ts, 0003_rls_core.sql, 0007_queue_ops.sql, 0008_public_fns.sql | prueba escrita |
| REQ-010.2 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (en curso), T-023 (en curso), T-025 (en curso) | barber-flow.spec.ts, 0007_queue_ops.sql | prueba escrita |
| REQ-010.3 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (en curso), T-023 (en curso), T-025 (en curso) | barber-flow.spec.ts, 0007_queue_ops.sql | prueba escrita |
| REQ-010.4 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (en curso), T-023 (en curso), T-025 (en curso) | 0007_queue_ops.sql | prueba escrita |
| REQ-010.5 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (en curso), T-023 (en curso), T-025 (en curso) | 0007_queue_ops.sql | prueba escrita |
| REQ-010.6 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (en curso), T-023 (en curso), T-025 (en curso) | owner-queue.spec.ts, 0007_queue_ops.sql | prueba escrita |
| REQ-011.1 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (en curso), T-017 (hecha), T-020 (en curso), T-022 (en curso) | customer-flow.spec.ts, queue-subscription.test.ts | prueba escrita |
| REQ-011.2 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (en curso), T-017 (hecha), T-020 (en curso), T-022 (en curso) | queue-subscription.test.ts | prueba escrita |
| REQ-011.3 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (en curso), T-017 (hecha), T-020 (en curso), T-022 (en curso) | barber-flow.spec.ts, retry.test.ts | prueba escrita |
| REQ-011.4 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (en curso), T-017 (hecha), T-020 (en curso), T-022 (en curso) | 0004_invitations.sql, 0006_transitions.sql | prueba escrita |
| REQ-011.5 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (en curso), T-017 (hecha), T-020 (en curso), T-022 (en curso) | 0012_hito1_gaps.sql | prueba escrita |
| REQ-011.6 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (en curso), T-017 (hecha), T-020 (en curso), T-022 (en curso) | customer-flow.spec.ts | prueba escrita |
| REQ-012.1 | Vista del dueño sobre la fila | T-006 (en curso), T-012 (hecha), T-013 (hecha), T-025 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-012.2 | Vista del dueño sobre la fila | T-006 (en curso), T-012 (hecha), T-013 (hecha), T-025 (en curso) | owner-queue.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql | prueba escrita |
| REQ-012.3 | Vista del dueño sobre la fila | T-006 (en curso), T-012 (hecha), T-013 (hecha), T-025 (en curso) | customers.spec.ts, owner-queue.spec.ts, 0005_queue.sql, 0007_queue_ops.sql | prueba escrita |
| REQ-012.4 | Vista del dueño sobre la fila | T-006 (en curso), T-012 (hecha), T-013 (hecha), T-025 (en curso) | owner-queue.spec.ts, 0008_public_fns.sql | prueba escrita |
| REQ-012.5 | Vista del dueño sobre la fila | T-006 (en curso), T-012 (hecha), T-013 (hecha), T-025 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-013.1 | Pantalla pública para el televisor | T-027 (en curso) | screen.spec.ts, 0002_core.sql, 0011_screen.sql | prueba escrita |
| REQ-013.2 | Pantalla pública para el televisor | T-027 (en curso) | screen.spec.ts, phone.test.ts, 0011_screen.sql | prueba escrita |
| REQ-013.3 | Pantalla pública para el televisor | T-027 (en curso) | screen.spec.ts | prueba escrita |
| REQ-013.4 | Pantalla pública para el televisor | T-027 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-013.5 | Pantalla pública para el televisor | T-027 (en curso) | hito1-gaps.spec.ts | prueba escrita |
| REQ-014.1 | Cierre automático de turnos al final del día | T-014 (hecha), T-020 (en curso), T-030 (en curso) | 0006_transitions.sql, 0008_public_fns.sql | prueba escrita |
| REQ-014.2 | Cierre automático de turnos al final del día | T-014 (hecha), T-020 (en curso), T-030 (en curso) | 0012_hito1_gaps.sql | prueba escrita |
| REQ-015.1 | Gestión de servicios | T-004 (hecha), T-008 (en curso) | admin-config.spec.ts, 0002_core.sql, 0003_rls_core.sql | prueba escrita |
| REQ-015.2 | Gestión de servicios | T-004 (hecha), T-008 (en curso) | admin-config.spec.ts | prueba escrita |
| REQ-015.3 | Gestión de servicios | T-004 (hecha), T-008 (en curso) | 0005_queue.sql | prueba escrita |
| REQ-015.4 | Gestión de servicios | T-004 (hecha), T-008 (en curso) | — | sin prueba |
| REQ-016.1 | Gestión de barberos y sillas | T-004 (hecha), T-007 (en curso), T-008 (en curso), T-025 (en curso) | — | sin prueba |
| REQ-016.2 | Gestión de barberos y sillas | T-004 (hecha), T-007 (en curso), T-008 (en curso), T-025 (en curso) | 0002_core.sql | prueba escrita |
| REQ-016.3 | Gestión de barberos y sillas | T-004 (hecha), T-007 (en curso), T-008 (en curso), T-025 (en curso) | 0003_rls_core.sql, 0004_invitations.sql | prueba escrita |
| REQ-016.4 | Gestión de barberos y sillas | T-004 (hecha), T-007 (en curso), T-008 (en curso), T-025 (en curso) | admin-config.spec.ts, owner-queue.spec.ts | prueba escrita |
| REQ-017.1 | Horario y estado del negocio | T-004 (hecha), T-008 (en curso), T-014 (hecha), T-016 (hecha), T-018 (en curso), T-019 (en curso) | admin-config.spec.ts, 0002_core.sql | prueba escrita |
| REQ-017.2 | Horario y estado del negocio | T-004 (hecha), T-008 (en curso), T-014 (hecha), T-016 (hecha), T-018 (en curso), T-019 (en curso) | 0008_public_fns.sql | prueba escrita |
| REQ-017.3 | Horario y estado del negocio | T-004 (hecha), T-008 (en curso), T-014 (hecha), T-016 (hecha), T-018 (en curso), T-019 (en curso) | queue-estimate.test.ts | prueba escrita |
| REQ-018.1 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-018.2 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (pendiente) | customers.spec.ts, customer-history.test.ts | prueba escrita |
| REQ-018.3 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (pendiente) | customers.spec.ts, customers.test.ts, 0013_customers_loyalty.sql | prueba escrita |
| REQ-018.4 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (pendiente) | customers.spec.ts, customers.test.ts, rls-customers.test.ts, customer-history.test.ts, 0014_customers_merge.sql | prueba escrita |
| REQ-018.5 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (pendiente) | customers.spec.ts, customers.test.ts, customer-history.test.ts, 0014_customers_merge.sql | prueba escrita |
| REQ-018.6 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (pendiente) | customers-delete.spec.ts, 0013_customers_loyalty.sql, 0014_customers_merge.sql, 0015_anonymize.sql | prueba escrita |
| REQ-019.1 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (pendiente), T-036 (pendiente), T-041 (pendiente), T-043 (pendiente) | — | sin prueba |
| REQ-019.2 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (pendiente), T-036 (pendiente), T-041 (pendiente), T-043 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-019.3 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (pendiente), T-036 (pendiente), T-041 (pendiente), T-043 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-019.4 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (pendiente), T-036 (pendiente), T-041 (pendiente), T-043 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-019.5 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (pendiente), T-036 (pendiente), T-041 (pendiente), T-043 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-019.6 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (pendiente), T-036 (pendiente), T-041 (pendiente), T-043 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-019.7 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (pendiente), T-036 (pendiente), T-041 (pendiente), T-043 (pendiente) | — | sin prueba |
| REQ-020.1 | Clientes para recordar (inactivos) | T-024 (en curso), T-031 (hecha), T-037 (pendiente) | 0002_core.sql | prueba escrita |
| REQ-020.2 | Clientes para recordar (inactivos) | T-024 (en curso), T-031 (hecha), T-037 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-020.3 | Clientes para recordar (inactivos) | T-024 (en curso), T-031 (hecha), T-037 (pendiente) | — | sin prueba |
| REQ-020.4 | Clientes para recordar (inactivos) | T-024 (en curso), T-031 (hecha), T-037 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-020.5 | Clientes para recordar (inactivos) | T-024 (en curso), T-031 (hecha), T-037 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-021.1 | Clientes nuevos vs. que repiten | T-031 (hecha), T-048 (pendiente) | 0013_customers_loyalty.sql | prueba escrita |
| REQ-022.1 | Barbero preferido en la ficha | T-019 (en curso), T-038 (pendiente), T-039 (pendiente) | — | sin prueba |
| REQ-023.1 | Cobrar un servicio | T-040 (pendiente), T-041 (pendiente), T-042 (pendiente), T-043 (pendiente), T-044 (pendiente), T-050 (pendiente) | — | sin prueba |
| REQ-023.2 | Cobrar un servicio | T-040 (pendiente), T-041 (pendiente), T-042 (pendiente), T-043 (pendiente), T-044 (pendiente), T-050 (pendiente) | — | sin prueba |
| REQ-023.3 | Cobrar un servicio | T-040 (pendiente), T-041 (pendiente), T-042 (pendiente), T-043 (pendiente), T-044 (pendiente), T-050 (pendiente) | — | sin prueba |
| REQ-023.4 | Cobrar un servicio | T-040 (pendiente), T-041 (pendiente), T-042 (pendiente), T-043 (pendiente), T-044 (pendiente), T-050 (pendiente) | — | sin prueba |
| REQ-023.5 | Cobrar un servicio | T-040 (pendiente), T-041 (pendiente), T-042 (pendiente), T-043 (pendiente), T-044 (pendiente), T-050 (pendiente) | — | sin prueba |
| REQ-023.6 | Cobrar un servicio | T-040 (pendiente), T-041 (pendiente), T-042 (pendiente), T-043 (pendiente), T-044 (pendiente), T-050 (pendiente) | 0006_transitions.sql | prueba escrita |
| REQ-023.7 | Cobrar un servicio | T-040 (pendiente), T-041 (pendiente), T-042 (pendiente), T-043 (pendiente), T-044 (pendiente), T-050 (pendiente) | — | sin prueba |
| REQ-024.1 | Vender productos | T-040 (pendiente), T-041 (pendiente), T-044 (pendiente) | admin-config.spec.ts | prueba escrita |
| REQ-024.2 | Vender productos | T-040 (pendiente), T-041 (pendiente), T-044 (pendiente) | — | sin prueba |
| REQ-024.3 | Vender productos | T-040 (pendiente), T-041 (pendiente), T-044 (pendiente) | — | sin prueba |
| REQ-025.1 | Comisión configurable por barbero | T-008 (en curso), T-040 (pendiente), T-041 (pendiente), T-047 (pendiente) | rls-core.test.ts, 0002_core.sql, 0003_rls_core.sql | prueba escrita |
| REQ-025.2 | Comisión configurable por barbero | T-008 (en curso), T-040 (pendiente), T-041 (pendiente), T-047 (pendiente) | money.test.ts | prueba escrita |
| REQ-025.3 | Comisión configurable por barbero | T-008 (en curso), T-040 (pendiente), T-041 (pendiente), T-047 (pendiente) | — | sin prueba |
| REQ-025.4 | Comisión configurable por barbero | T-008 (en curso), T-040 (pendiente), T-041 (pendiente), T-047 (pendiente) | — | sin prueba |
| REQ-025.5 | Comisión configurable por barbero | T-008 (en curso), T-040 (pendiente), T-041 (pendiente), T-047 (pendiente) | — | sin prueba |
| REQ-026.1 | Anular una venta | T-040 (pendiente), T-045 (pendiente) | — | sin prueba |
| REQ-026.2 | Anular una venta | T-040 (pendiente), T-045 (pendiente) | — | sin prueba |
| REQ-027.1 | Cierre de caja diario | T-040 (pendiente), T-045 (pendiente), T-046 (pendiente) | — | sin prueba |
| REQ-027.2 | Cierre de caja diario | T-040 (pendiente), T-045 (pendiente), T-046 (pendiente) | — | sin prueba |
| REQ-027.3 | Cierre de caja diario | T-040 (pendiente), T-045 (pendiente), T-046 (pendiente) | — | sin prueba |
| REQ-027.4 | Cierre de caja diario | T-040 (pendiente), T-045 (pendiente), T-046 (pendiente) | — | sin prueba |
| REQ-027.5 | Cierre de caja diario | T-040 (pendiente), T-045 (pendiente), T-046 (pendiente) | time.test.ts, 0005_queue.sql | prueba escrita |
| REQ-027.6 | Cierre de caja diario | T-040 (pendiente), T-045 (pendiente), T-046 (pendiente) | — | sin prueba |
| REQ-028.1 | Resumen semanal | T-011 (hecha), T-048 (pendiente) | time.test.ts | prueba escrita |
| REQ-028.2 | Resumen semanal | T-011 (hecha), T-048 (pendiente) | — | sin prueba |
| REQ-028.3 | Resumen semanal | T-011 (hecha), T-048 (pendiente) | — | sin prueba |
| REQ-028.4 | Resumen semanal | T-011 (hecha), T-048 (pendiente) | — | sin prueba |
| REQ-029.1 | Vista del barbero sobre sus números | T-042 (pendiente), T-047 (pendiente), T-050 (pendiente) | — | sin prueba |
| REQ-030.1 | Acceso del personal (dueño y barberos) | T-006 (en curso), T-007 (en curso), T-030 (en curso) | auth.spec.ts, onboarding.spec.ts, 0002_core.sql | prueba escrita |
| REQ-030.2 | Acceso del personal (dueño y barberos) | T-006 (en curso), T-007 (en curso), T-030 (en curso) | onboarding.spec.ts, 0004_invitations.sql | prueba escrita |
| REQ-030.3 | Acceso del personal (dueño y barberos) | T-006 (en curso), T-007 (en curso), T-030 (en curso) | auth.spec.ts | prueba escrita |
| REQ-030.4 | Acceso del personal (dueño y barberos) | T-006 (en curso), T-007 (en curso), T-030 (en curso) | auth.spec.ts, 0004_invitations.sql | prueba escrita |
| REQ-031.1 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (pendiente) | 0002_core.sql, 0003_rls_core.sql | prueba escrita |
| REQ-031.2 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (pendiente) | 0008_public_fns.sql, 0009_realtime.sql | prueba escrita |
| REQ-031.3 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (pendiente) | — | sin prueba |
| REQ-031.4 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (pendiente) | rls-core.test.ts, 0003_rls_core.sql | prueba escrita |
| REQ-032.1 | PWA instalable | T-001 (hecha), T-010 (en curso), T-029 (pendiente) | — | sin prueba |
| REQ-032.2 | PWA instalable | T-001 (hecha), T-010 (en curso), T-029 (pendiente) | — | sin prueba |
| REQ-033.1 | Plantillas de mensajes de WhatsApp | T-024 (en curso) | admin-config.spec.ts, render-template.test.ts, 0002_core.sql | prueba escrita |
| REQ-034.1 | Datos de ejemplo (seed) | T-009 (hecha), T-030 (en curso) | 0009_seed.sql | prueba escrita |
