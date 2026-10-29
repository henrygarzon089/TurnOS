# Matriz de trazabilidad

> Generada por `scripts/traceability.ts` el 2026-10-29.
> Estado: **cubierto** = tareas hechas y prueba existente · **prueba escrita** = prueba existe, tarea sin cerrar · **sin prueba** = falta.

| CA | Requisito | Tareas | Pruebas | Estado |
|---|---|---|---|---|
| REQ-001.1 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | cubierto |
| REQ-001.2 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | qr.spec.ts | cubierto |
| REQ-001.3 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | qr.spec.ts | cubierto |
| REQ-001.4 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | public-queue.test.ts, 0008_public_fns.sql | cubierto |
| REQ-001.5 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | cubierto |
| REQ-002.1 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-002.2 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | customer-flow.spec.ts, public-queue.test.ts | cubierto |
| REQ-002.3 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | 0013_customers_loyalty.sql | cubierto |
| REQ-002.4 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-002.5 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | privacy.spec.ts, 0002_core.sql | cubierto |
| REQ-003.1 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha) | 0005_queue.sql, 0008_public_fns.sql | cubierto |
| REQ-003.2 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha) | customer-flow.spec.ts, public-queue.test.ts, phone.test.ts | cubierto |
| REQ-003.3 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0005_queue.sql, 0008_public_fns.sql | cubierto |
| REQ-003.4 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha) | 0013_customers_loyalty.sql | cubierto |
| REQ-003.5 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0005_queue.sql, 0008_public_fns.sql | cubierto |
| REQ-003.6 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha) | 0012_hito1_gaps.sql | cubierto |
| REQ-003.7 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-004.1 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha) | public-queue.test.ts, queue-estimate.test.ts, 0008_public_fns.sql | cubierto |
| REQ-004.2 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha) | customer-flow.spec.ts, queue-subscription.test.ts | cubierto |
| REQ-004.3 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-004.4 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-004.5 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha) | customer-flow.spec.ts, domain-branches.test.ts, queue-estimate.test.ts, time.test.ts | cubierto |
| REQ-004.6 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-004.7 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | cubierto |
| REQ-005.1 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-005.2 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0006_transitions.sql, 0008_public_fns.sql | cubierto |
| REQ-005.3 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (hecha) | hito1-gaps.spec.ts, public-queue.test.ts | cubierto |
| REQ-006.1 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-006.2 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-006.3 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | 0009_realtime.sql | cubierto |
| REQ-006.4 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-006.5 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-007.1 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | barber-flow.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql | cubierto |
| REQ-007.2 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | call-next-race.test.ts | cubierto |
| REQ-007.3 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | 0006_transitions.sql | cubierto |
| REQ-007.4 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | 0006_transitions.sql | cubierto |
| REQ-007.5 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | barber-flow.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql | cubierto |
| REQ-007.6 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | 0007_queue_ops.sql | cubierto |
| REQ-007.7 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | 0005_queue.sql, 0010_notify.sql | cubierto |
| REQ-007.8 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | 0012_hito1_gaps.sql, 0031_queue_by_service.sql | cubierto |
| REQ-008.1 | Cliente que no llega | T-012 (hecha), T-020 (hecha), T-022 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-008.2 | Cliente que no llega | T-012 (hecha), T-020 (hecha), T-022 (hecha) | barber-flow.spec.ts, 0006_transitions.sql | cubierto |
| REQ-008.3 | Cliente que no llega | T-012 (hecha), T-020 (hecha), T-022 (hecha) | 0013_customers_loyalty.sql | cubierto |
| REQ-008.4 | Cliente que no llega | T-012 (hecha), T-020 (hecha), T-022 (hecha) | 0012_hito1_gaps.sql | cubierto |
| REQ-009.1 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (hecha), T-024 (hecha) | queue-estimate.test.ts | cubierto |
| REQ-009.2 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (hecha), T-024 (hecha) | barber-flow.spec.ts, loyalty-progress.spec.ts, phone.test.ts, wa-me.test.ts | cubierto |
| REQ-009.3 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (hecha), T-024 (hecha) | barber-flow.spec.ts, 0010_notify.sql | cubierto |
| REQ-009.4 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (hecha), T-024 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-009.5 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (hecha), T-024 (hecha) | wa-me.test.ts | cubierto |
| REQ-010.1 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | public-queue.test.ts, rls-core.test.ts, queue-estimate.test.ts, 0003_rls_core.sql, 0007_queue_ops.sql, 0008_public_fns.sql | cubierto |
| REQ-010.2 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-010.3 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-010.4 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | 0007_queue_ops.sql | cubierto |
| REQ-010.5 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | 0007_queue_ops.sql | cubierto |
| REQ-010.6 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | owner-queue.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-011.1 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha) | customer-flow.spec.ts, queue-subscription.test.ts | cubierto |
| REQ-011.2 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha) | queue-subscription.test.ts | cubierto |
| REQ-011.3 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha) | barber-flow.spec.ts, retry.test.ts | cubierto |
| REQ-011.4 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha) | 0004_invitations.sql, 0006_transitions.sql | cubierto |
| REQ-011.5 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha) | 0012_hito1_gaps.sql | cubierto |
| REQ-011.6 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-012.1 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-012.2 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | owner-queue.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql | cubierto |
| REQ-012.3 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | customers.spec.ts, loyalty-progress.spec.ts, owner-queue.spec.ts, 0005_queue.sql, 0007_queue_ops.sql | cubierto |
| REQ-012.4 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | owner-queue.spec.ts, 0008_public_fns.sql | cubierto |
| REQ-012.5 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-013.1 | Pantalla pública para el televisor | T-027 (hecha) | screen.spec.ts, 0002_core.sql, 0011_screen.sql | cubierto |
| REQ-013.2 | Pantalla pública para el televisor | T-027 (hecha) | screen.spec.ts, phone.test.ts, 0011_screen.sql | cubierto |
| REQ-013.3 | Pantalla pública para el televisor | T-027 (hecha) | helpers.ts, screen.spec.ts | cubierto |
| REQ-013.4 | Pantalla pública para el televisor | T-027 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-013.5 | Pantalla pública para el televisor | T-027 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-014.1 | Cierre automático de turnos al final del día | T-014 (hecha), T-020 (hecha), T-030 (hecha) | 0006_transitions.sql, 0008_public_fns.sql, 0020_close_expired_midnight.sql, 0029_override_open.sql | cubierto |
| REQ-014.2 | Cierre automático de turnos al final del día | T-014 (hecha), T-020 (hecha), T-030 (hecha) | 0012_hito1_gaps.sql, 0020_close_expired_midnight.sql, 0029_override_open.sql | cubierto |
| REQ-015.1 | Gestión de servicios | T-004 (hecha), T-008 (hecha) | admin-config.spec.ts, 0002_core.sql, 0003_rls_core.sql | cubierto |
| REQ-015.2 | Gestión de servicios | T-004 (hecha), T-008 (hecha) | admin-config.spec.ts | cubierto |
| REQ-015.3 | Gestión de servicios | T-004 (hecha), T-008 (hecha) | 0005_queue.sql | cubierto |
| REQ-015.4 | Gestión de servicios | T-004 (hecha), T-008 (hecha) | 0028_mvp_gaps.sql | cubierto |
| REQ-016.1 | Gestión de barberos y sillas | T-004 (hecha), T-007 (hecha), T-008 (hecha), T-025 (hecha) | 0028_mvp_gaps.sql | cubierto |
| REQ-016.2 | Gestión de barberos y sillas | T-004 (hecha), T-007 (hecha), T-008 (hecha), T-025 (hecha) | 0002_core.sql | cubierto |
| REQ-016.3 | Gestión de barberos y sillas | T-004 (hecha), T-007 (hecha), T-008 (hecha), T-025 (hecha) | 0003_rls_core.sql, 0004_invitations.sql | cubierto |
| REQ-016.4 | Gestión de barberos y sillas | T-004 (hecha), T-007 (hecha), T-008 (hecha), T-025 (hecha) | admin-config.spec.ts, owner-queue.spec.ts | cubierto |
| REQ-017.1 | Horario y estado del negocio | T-004 (hecha), T-008 (hecha), T-014 (hecha), T-016 (hecha), T-018 (hecha), T-019 (hecha) | admin-config.spec.ts, 0002_core.sql | cubierto |
| REQ-017.2 | Horario y estado del negocio | T-004 (hecha), T-008 (hecha), T-014 (hecha), T-016 (hecha), T-018 (hecha), T-019 (hecha) | owner-queue.spec.ts, 0008_public_fns.sql, 0029_override_open.sql | cubierto |
| REQ-017.3 | Horario y estado del negocio | T-004 (hecha), T-008 (hecha), T-014 (hecha), T-016 (hecha), T-018 (hecha), T-019 (hecha) | queue-estimate.test.ts | cubierto |
| REQ-018.1 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | 0013_customers_loyalty.sql | cubierto |
| REQ-018.2 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | customers.spec.ts, customer-history.test.ts | cubierto |
| REQ-018.3 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | customers.spec.ts, customers.test.ts, 0013_customers_loyalty.sql | cubierto |
| REQ-018.4 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | customers.spec.ts, customers.test.ts, rls-customers.test.ts, customer-history.test.ts, 0014_customers_merge.sql | cubierto |
| REQ-018.5 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | customers.spec.ts, customers.test.ts, customer-history.test.ts, 0014_customers_merge.sql | cubierto |
| REQ-018.6 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | customers-delete.spec.ts, 0013_customers_loyalty.sql, 0014_customers_merge.sql, 0015_anonymize.sql | cubierto |
| REQ-019.1 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (hecha), T-036 (hecha), T-041 (hecha), T-043 (hecha) | loyalty-config.spec.ts, loyalty.test.ts, 0016_loyalty_config.sql | cubierto |
| REQ-019.2 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (hecha), T-036 (hecha), T-041 (hecha), T-043 (hecha) | 0013_customers_loyalty.sql | cubierto |
| REQ-019.3 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (hecha), T-036 (hecha), T-041 (hecha), T-043 (hecha) | loyalty-progress.spec.ts, loyalty.test.ts, 0013_customers_loyalty.sql, 0017_loyalty_progress.sql | cubierto |
| REQ-019.4 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (hecha), T-036 (hecha), T-041 (hecha), T-043 (hecha) | checkout.spec.ts, 0013_customers_loyalty.sql, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-019.5 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (hecha), T-036 (hecha), T-041 (hecha), T-043 (hecha) | loyalty-progress.spec.ts, 0013_customers_loyalty.sql, 0017_loyalty_progress.sql | cubierto |
| REQ-019.6 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (hecha), T-036 (hecha), T-041 (hecha), T-043 (hecha) | loyalty-config.spec.ts, 0013_customers_loyalty.sql, 0016_loyalty_config.sql | cubierto |
| REQ-019.7 | Tarjeta de fidelidad configurable | T-031 (hecha), T-035 (hecha), T-036 (hecha), T-041 (hecha), T-043 (hecha) | loyalty-progress.spec.ts, loyalty.test.ts, 0017_loyalty_progress.sql | cubierto |
| REQ-020.1 | Clientes para recordar (inactivos) | T-024 (hecha), T-031 (hecha), T-037 (hecha) | 0002_core.sql, 0018_reminders.sql | cubierto |
| REQ-020.2 | Clientes para recordar (inactivos) | T-024 (hecha), T-031 (hecha), T-037 (hecha) | reminders.spec.ts, 0013_customers_loyalty.sql, 0018_reminders.sql | cubierto |
| REQ-020.3 | Clientes para recordar (inactivos) | T-024 (hecha), T-031 (hecha), T-037 (hecha) | reminders.spec.ts, reminders.test.ts | cubierto |
| REQ-020.4 | Clientes para recordar (inactivos) | T-024 (hecha), T-031 (hecha), T-037 (hecha) | reminders.spec.ts, 0013_customers_loyalty.sql, 0018_reminders.sql | cubierto |
| REQ-020.5 | Clientes para recordar (inactivos) | T-024 (hecha), T-031 (hecha), T-037 (hecha) | reminders.spec.ts, 0013_customers_loyalty.sql, 0018_reminders.sql | cubierto |
| REQ-021.1 | Clientes nuevos vs. que repiten | T-031 (hecha), T-048 (hecha) | 0013_customers_loyalty.sql, 0027_weekly.sql | cubierto |
| REQ-022.1 | Barbero preferido en la ficha | T-019 (hecha), T-038 (hecha), T-039 (hecha) | preferred-barber.spec.ts, preferred-barber.test.ts | cubierto |
| REQ-023.1 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha) | checkout.spec.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-023.2 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha) | checkout.spec.ts, commission.test.ts, 0022_register_sale.sql | cubierto |
| REQ-023.3 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha) | checkout.spec.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-023.4 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha) | new-sale.spec.ts, 0022_register_sale.sql | cubierto |
| REQ-023.5 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha) | 0021_cash.sql | cubierto |
| REQ-023.6 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha) | checkout.spec.ts, 0006_transitions.sql, 0024_unpaid.sql | cubierto |
| REQ-023.7 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha) | checkout.spec.ts, rls-cash.test.ts, 0022_register_sale.sql | cubierto |
| REQ-024.1 | Vender productos | T-040 (hecha), T-041 (hecha), T-044 (hecha) | admin-config.spec.ts, new-sale.spec.ts | cubierto |
| REQ-024.2 | Vender productos | T-040 (hecha), T-041 (hecha), T-044 (hecha) | new-sale.spec.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-024.3 | Vender productos | T-040 (hecha), T-041 (hecha), T-044 (hecha) | new-sale.spec.ts, commission.test.ts, 0022_register_sale.sql | cubierto |
| REQ-025.1 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | rls-core.test.ts, 0002_core.sql, 0003_rls_core.sql, 0021_cash.sql | cubierto |
| REQ-025.2 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | commission.test.ts, money.test.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-025.3 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-025.4 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | commission.test.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-025.5 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | my-numbers.spec.ts, my-numbers.test.ts, my-numbers.test.ts | cubierto |
| REQ-026.1 | Anular una venta | T-040 (hecha), T-045 (hecha) | cash-day.spec.ts, 0021_cash.sql, 0022_register_sale.sql, 0025_cash_summary.sql | cubierto |
| REQ-026.2 | Anular una venta | T-040 (hecha), T-045 (hecha) | 0021_cash.sql, 0026_close_cash.sql | cubierto |
| REQ-027.1 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha) | cash-day.spec.ts, 0025_cash_summary.sql | cubierto |
| REQ-027.2 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha) | close-cash.spec.ts, 0021_cash.sql, 0025_cash_summary.sql, 0026_close_cash.sql | cubierto |
| REQ-027.3 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha) | close-cash.spec.ts, 0021_cash.sql, 0026_close_cash.sql | cubierto |
| REQ-027.4 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha) | close-cash.spec.ts, cash-closure.test.ts | cubierto |
| REQ-027.5 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha) | time.test.ts, 0005_queue.sql, 0022_register_sale.sql, 0025_cash_summary.sql, 0026_close_cash.sql | cubierto |
| REQ-027.6 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha) | close-cash.spec.ts, cash-closure.test.ts, domain-branches.test.ts | cubierto |
| REQ-028.1 | Resumen semanal | T-011 (hecha), T-048 (hecha) | week.spec.ts, time.test.ts, week.test.ts, 0027_weekly.sql | cubierto |
| REQ-028.2 | Resumen semanal | T-011 (hecha), T-048 (hecha) | week.test.ts, 0027_weekly.sql | cubierto |
| REQ-028.3 | Resumen semanal | T-011 (hecha), T-048 (hecha) | week.spec.ts, week.test.ts | cubierto |
| REQ-028.4 | Resumen semanal | T-011 (hecha), T-048 (hecha) | 0027_weekly.sql | cubierto |
| REQ-029.1 | Vista del barbero sobre sus números | T-042 (hecha), T-047 (hecha), T-050 (hecha) | my-numbers.spec.ts, my-numbers.test.ts, rls-cash.test.ts, 0025_cash_summary.sql, 0027_weekly.sql | cubierto |
| REQ-030.1 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | auth.spec.ts, onboarding.spec.ts, 0002_core.sql | cubierto |
| REQ-030.2 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | onboarding.spec.ts, 0004_invitations.sql, 0028_mvp_gaps.sql, 0029_function_grants.sql | cubierto |
| REQ-030.3 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | auth.spec.ts | cubierto |
| REQ-030.4 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | auth.spec.ts, 0004_invitations.sql | cubierto |
| REQ-031.1 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | rls-cash.test.ts, 0002_core.sql, 0003_rls_core.sql, 0017_loyalty_progress.sql, 0029_function_grants.sql, 0030_barber_services.sql | cubierto |
| REQ-031.2 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | 0008_public_fns.sql, 0009_realtime.sql | cubierto |
| REQ-031.3 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | 0028_mvp_gaps.sql | cubierto |
| REQ-031.4 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | rls-core.test.ts, 0003_rls_core.sql | cubierto |
| REQ-032.1 | PWA instalable | T-001 (hecha), T-010 (en curso), T-029 (hecha) | pwa-usability.spec.ts, pwa.test.ts | prueba escrita |
| REQ-032.2 | PWA instalable | T-001 (hecha), T-010 (en curso), T-029 (hecha) | pwa-usability.spec.ts | prueba escrita |
| REQ-033.1 | Plantillas de mensajes de WhatsApp | T-024 (hecha) | admin-config.spec.ts, render-template.test.ts, 0002_core.sql | cubierto |
| REQ-034.1 | Datos de ejemplo (seed) | T-009 (hecha), T-030 (hecha) | 0009_seed.sql | cubierto |
| REQ-035.1 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0030_barber_services.sql | prueba escrita |
| REQ-035.2 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0030_barber_services.sql | prueba escrita |
| REQ-035.3 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0030_barber_services.sql | prueba escrita |
| REQ-035.4 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0030_barber_services.sql | prueba escrita |
| REQ-035.5 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0030_barber_services.sql | prueba escrita |
| REQ-035.6 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | services-by-barber.spec.ts, public-queue.test.ts, barber-services.test.ts, 0032_estimate_by_service.sql | prueba escrita |
| REQ-035.7 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | services-by-barber.spec.ts, public-queue.test.ts, barber-services.test.ts, 0031_queue_by_service.sql | prueba escrita |
| REQ-035.8 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | public-queue.test.ts, 0031_queue_by_service.sql | prueba escrita |
| REQ-035.9 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | queue-estimate.test.ts, 0030_barber_services.sql, 0031_queue_by_service.sql | prueba escrita |
| REQ-035.10 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | queue-estimate.test.ts, 0031_queue_by_service.sql, 0032_estimate_by_service.sql | prueba escrita |
| REQ-035.11 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0031_queue_by_service.sql | prueba escrita |
| REQ-035.12 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0031_queue_by_service.sql | prueba escrita |
| REQ-035.13 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (pendiente), T-056 (pendiente), T-057 (pendiente) | 0031_queue_by_service.sql | prueba escrita |
