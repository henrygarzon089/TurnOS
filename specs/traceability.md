# Matriz de trazabilidad

> Generada por `scripts/traceability.ts` el 2026-11-09.
> Estado: **cubierto** = tareas hechas y prueba existente · **prueba escrita** = prueba existe, tarea sin cerrar · **sin prueba** = falta.

| CA | Requisito | Tareas | Pruebas | Estado |
|---|---|---|---|---|
| REQ-001.1 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | cubierto |
| REQ-001.2 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | qr.spec.ts | cubierto |
| REQ-001.3 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | qr.spec.ts | cubierto |
| REQ-001.4 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | public-queue.test.ts, public-view.test.ts, 0008_public_fns.sql | cubierto |
| REQ-001.5 | Acceso a la fila por QR o enlace | T-014 (hecha), T-017 (hecha), T-018 (hecha), T-026 (hecha), T-030 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql | cubierto |
| REQ-002.1 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | hito1-gaps.spec.ts, public-home.test.tsx | cubierto |
| REQ-002.2 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | customer-flow.spec.ts, public-queue.test.ts | cubierto |
| REQ-002.3 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | 0013_customers_loyalty.sql | cubierto |
| REQ-002.4 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-002.5 | Aviso de privacidad y aceptación (Ley 1581) | T-019 (hecha), T-028 (hecha) | privacy.spec.ts, 0002_core.sql | cubierto |
| REQ-003.1 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha), T-173 (hecha) | public-home.test.tsx, 0005_queue.sql, 0008_public_fns.sql | cubierto |
| REQ-003.2 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha), T-173 (hecha) | customer-flow.spec.ts, public-queue.test.ts, phone.test.ts, ui-components.test.tsx | cubierto |
| REQ-003.3 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha), T-173 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0005_queue.sql, 0008_public_fns.sql | cubierto |
| REQ-003.4 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha), T-173 (hecha) | 0013_customers_loyalty.sql | cubierto |
| REQ-003.5 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha), T-173 (hecha) | customer-flow.spec.ts, public-queue.test.ts, 0005_queue.sql, 0008_public_fns.sql | cubierto |
| REQ-003.6 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha), T-173 (hecha) | 0012_hito1_gaps.sql | cubierto |
| REQ-003.7 | Tomar turno | T-003 (hecha), T-011 (hecha), T-014 (hecha), T-017 (hecha), T-019 (hecha), T-173 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-004.1 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha), T-174 (pendiente) | public-queue.test.ts, queue-estimate.test.ts, 0008_public_fns.sql | prueba escrita |
| REQ-004.2 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha), T-174 (pendiente) | customer-flow.spec.ts, queue-subscription.test.ts | prueba escrita |
| REQ-004.3 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha), T-174 (pendiente) | customer-flow.spec.ts | prueba escrita |
| REQ-004.4 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha), T-174 (pendiente) | hito1-gaps.spec.ts | prueba escrita |
| REQ-004.5 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha), T-174 (pendiente) | customer-flow.spec.ts, domain-branches.test.ts, queue-estimate.test.ts, time.test.ts | prueba escrita |
| REQ-004.6 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha), T-174 (pendiente) | customer-flow.spec.ts | prueba escrita |
| REQ-004.7 | Ver mi turno en tiempo real | T-003 (hecha), T-014 (hecha), T-015 (hecha), T-016 (hecha), T-017 (hecha), T-020 (hecha), T-053 (hecha), T-174 (pendiente) | customer-flow.spec.ts, public-queue.test.ts, 0008_public_fns.sql, 0033_customer_experience.sql | prueba escrita |
| REQ-005.1 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-005.2 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (hecha) | customer-flow.spec.ts, helpers.ts, public-queue.test.ts, 0006_transitions.sql, 0008_public_fns.sql | cubierto |
| REQ-005.3 | Cancelar mi turno | T-012 (hecha), T-017 (hecha), T-020 (hecha) | hito1-gaps.spec.ts, public-queue.test.ts | cubierto |
| REQ-006.1 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-006.2 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-006.3 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | 0009_realtime.sql | cubierto |
| REQ-006.4 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-006.5 | Vista de fila del barbero | T-015 (hecha), T-016 (hecha), T-021 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-007.1 | Llamar al siguiente, en servicio, terminado | T-011 (hecha), T-012 (hecha), T-013 (hecha), T-021 (hecha), T-022 (hecha) | barber-flow.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql, 0069_call_expected.sql | cubierto |
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
| REQ-009.5 | Aviso por WhatsApp cuando faltan 2 turnos | T-016 (hecha), T-021 (hecha), T-024 (hecha) | cloud-api.test.ts, wa-me.test.ts | cubierto |
| REQ-010.1 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | public-queue.test.ts, rls-core.test.ts, queue-estimate.test.ts, 0003_rls_core.sql, 0007_queue_ops.sql, 0008_public_fns.sql | cubierto |
| REQ-010.2 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-010.3 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | barber-flow.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-010.4 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | 0007_queue_ops.sql | cubierto |
| REQ-010.5 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | 0007_queue_ops.sql | cubierto |
| REQ-010.6 | Barbero que se ausenta (pausa) | T-013 (hecha), T-016 (hecha), T-020 (hecha), T-023 (hecha), T-025 (hecha) | owner-queue.spec.ts, 0007_queue_ops.sql | cubierto |
| REQ-011.1 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha), T-182 (hecha) | customer-flow.spec.ts, queue-subscription.test.ts | cubierto |
| REQ-011.2 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha), T-182 (hecha) | queue-subscription.test.ts | cubierto |
| REQ-011.3 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha), T-182 (hecha) | barber-flow.spec.ts, retry.test.ts | cubierto |
| REQ-011.4 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha), T-182 (hecha) | 0004_invitations.sql, 0006_transitions.sql | cubierto |
| REQ-011.5 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha), T-182 (hecha) | 0012_hito1_gaps.sql | cubierto |
| REQ-011.6 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha), T-182 (hecha) | customer-flow.spec.ts | cubierto |
| REQ-011.7 | Pérdida de conexión | T-011 (hecha), T-012 (hecha), T-015 (hecha), T-017 (hecha), T-020 (hecha), T-022 (hecha), T-182 (hecha) | queue-subscription.test.ts | cubierto |
| REQ-012.1 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-012.2 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | owner-queue.spec.ts, 0006_transitions.sql, 0007_queue_ops.sql, 0046_appointments_queue.sql | cubierto |
| REQ-012.3 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | customers.spec.ts, google-review.spec.ts, loyalty-progress.spec.ts, owner-queue.spec.ts, 0005_queue.sql, 0007_queue_ops.sql | cubierto |
| REQ-012.4 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | owner-queue.spec.ts, 0008_public_fns.sql | cubierto |
| REQ-012.5 | Vista del dueño sobre la fila | T-006 (hecha), T-012 (hecha), T-013 (hecha), T-025 (hecha) | hito1-gaps.spec.ts | cubierto |
| REQ-013.1 | Pantalla pública para el televisor | T-027 (hecha), T-176 (pendiente) | screen.spec.ts, 0002_core.sql, 0011_screen.sql | prueba escrita |
| REQ-013.2 | Pantalla pública para el televisor | T-027 (hecha), T-176 (pendiente) | screen.spec.ts, public-home.test.tsx, public-view.test.ts, 0011_screen.sql | prueba escrita |
| REQ-013.3 | Pantalla pública para el televisor | T-027 (hecha), T-176 (pendiente) | helpers.ts, screen.spec.ts | prueba escrita |
| REQ-013.4 | Pantalla pública para el televisor | T-027 (hecha), T-176 (pendiente) | hito1-gaps.spec.ts | prueba escrita |
| REQ-013.5 | Pantalla pública para el televisor | T-027 (hecha), T-176 (pendiente) | hito1-gaps.spec.ts | prueba escrita |
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
| REQ-018.5 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | customers.spec.ts, customers.test.ts, customer-history.test.ts, 0014_customers_merge.sql, 0035_merge_customers_birthday.sql, 0041_memberships.sql, 0049_appointments_customer.sql, 0055_merge_customers_sales.sql, 0056_merge_customers_gift_cards.sql | cubierto |
| REQ-018.6 | Ficha de cliente por celular | T-031 (hecha), T-032 (hecha), T-033 (hecha), T-034 (hecha), T-039 (hecha) | customers-delete.spec.ts, 0013_customers_loyalty.sql, 0014_customers_merge.sql, 0015_anonymize.sql, 0033_customer_experience.sql, 0036_whatsapp_notifications.sql, 0038_whatsapp_inbound.sql, 0041_memberships.sql, 0043_membership_reports.sql | cubierto |
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
| REQ-020.5 | Clientes para recordar (inactivos) | T-024 (hecha), T-031 (hecha), T-037 (hecha) | reminders.spec.ts, 0013_customers_loyalty.sql, 0018_reminders.sql, 0043_membership_reports.sql | cubierto |
| REQ-021.1 | Clientes nuevos vs. que repiten | T-031 (hecha), T-048 (hecha) | 0013_customers_loyalty.sql, 0027_weekly.sql | cubierto |
| REQ-022.1 | Barbero preferido en la ficha | T-019 (hecha), T-038 (hecha), T-039 (hecha) | preferred-barber.spec.ts, preferred-barber.test.ts | cubierto |
| REQ-023.1 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha), T-140 (hecha) | checkout.spec.ts, daviplata.test.ts, 0021_cash.sql, 0022_register_sale.sql, 0068_daviplata.sql | cubierto |
| REQ-023.2 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha), T-140 (hecha) | checkout.spec.ts, commission.test.ts, 0022_register_sale.sql | cubierto |
| REQ-023.3 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha), T-140 (hecha) | checkout.spec.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-023.4 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha), T-140 (hecha) | new-sale.spec.ts, 0022_register_sale.sql | cubierto |
| REQ-023.5 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha), T-140 (hecha) | 0021_cash.sql | cubierto |
| REQ-023.6 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha), T-140 (hecha) | checkout.spec.ts, 0006_transitions.sql, 0024_unpaid.sql | cubierto |
| REQ-023.7 | Cobrar un servicio | T-040 (hecha), T-041 (hecha), T-042 (hecha), T-043 (hecha), T-044 (hecha), T-050 (hecha), T-140 (hecha) | checkout.spec.ts, rls-cash.test.ts, 0022_register_sale.sql | cubierto |
| REQ-024.1 | Vender productos | T-040 (hecha), T-041 (hecha), T-044 (hecha) | admin-config.spec.ts, new-sale.spec.ts, product-form.test.ts | cubierto |
| REQ-024.2 | Vender productos | T-040 (hecha), T-041 (hecha), T-044 (hecha) | new-sale.spec.ts, 0021_cash.sql, 0022_register_sale.sql, 0065_inventory_sales_hook.sql | cubierto |
| REQ-024.3 | Vender productos | T-040 (hecha), T-041 (hecha), T-044 (hecha) | new-sale.spec.ts, commission.test.ts, 0022_register_sale.sql | cubierto |
| REQ-025.1 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | rls-core.test.ts, 0002_core.sql, 0003_rls_core.sql, 0021_cash.sql | cubierto |
| REQ-025.2 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | commission.test.ts, money.test.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-025.3 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-025.4 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | commission.test.ts, 0021_cash.sql, 0022_register_sale.sql | cubierto |
| REQ-025.5 | Comisión configurable por barbero | T-008 (hecha), T-040 (hecha), T-041 (hecha), T-047 (hecha) | my-numbers.spec.ts, my-numbers.test.ts, my-numbers.test.ts | cubierto |
| REQ-026.1 | Anular una venta | T-040 (hecha), T-045 (hecha) | cash-day.spec.ts, 0021_cash.sql, 0022_register_sale.sql, 0025_cash_summary.sql, 0042_membership_checkout.sql, 0043_membership_reports.sql, 0055_merge_customers_sales.sql | cubierto |
| REQ-026.2 | Anular una venta | T-040 (hecha), T-045 (hecha) | 0021_cash.sql, 0026_close_cash.sql, 0042_membership_sales.sql, 0051_gift_cards.sql, 0055_merge_customers_sales.sql | cubierto |
| REQ-027.1 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha), T-140 (hecha) | cash-day.spec.ts, today.spec.ts, daviplata.test.ts, 0025_cash_summary.sql, 0068_daviplata.sql | cubierto |
| REQ-027.2 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha), T-140 (hecha) | close-cash.spec.ts, 0021_cash.sql, 0025_cash_summary.sql, 0026_close_cash.sql | cubierto |
| REQ-027.3 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha), T-140 (hecha) | close-cash.spec.ts, 0021_cash.sql, 0026_close_cash.sql | cubierto |
| REQ-027.4 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha), T-140 (hecha) | close-cash.spec.ts, cash-closure.test.ts | cubierto |
| REQ-027.5 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha), T-140 (hecha) | time.test.ts, 0005_queue.sql, 0022_register_sale.sql, 0025_cash_summary.sql, 0026_close_cash.sql | cubierto |
| REQ-027.6 | Cierre de caja diario | T-040 (hecha), T-045 (hecha), T-046 (hecha), T-140 (hecha) | close-cash.spec.ts, cash-closure.test.ts, domain-branches.test.ts | cubierto |
| REQ-028.1 | Resumen semanal | T-011 (hecha), T-048 (hecha) | week.spec.ts, time.test.ts, week.test.ts, 0027_weekly.sql | cubierto |
| REQ-028.2 | Resumen semanal | T-011 (hecha), T-048 (hecha) | week.test.ts, 0027_weekly.sql | cubierto |
| REQ-028.3 | Resumen semanal | T-011 (hecha), T-048 (hecha) | week.spec.ts, week.test.ts | cubierto |
| REQ-028.4 | Resumen semanal | T-011 (hecha), T-048 (hecha) | 0027_weekly.sql | cubierto |
| REQ-029.1 | Vista del barbero sobre sus números | T-042 (hecha), T-047 (hecha), T-050 (hecha) | my-numbers.spec.ts, my-numbers.test.ts, rls-cash.test.ts, 0025_cash_summary.sql, 0027_weekly.sql | cubierto |
| REQ-030.1 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | auth.spec.ts, onboarding.spec.ts, 0002_core.sql | cubierto |
| REQ-030.2 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | onboarding.spec.ts, 0004_invitations.sql, 0028_mvp_gaps.sql, 0029_function_grants.sql | cubierto |
| REQ-030.3 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | auth.spec.ts | cubierto |
| REQ-030.4 | Acceso del personal (dueño y barberos) | T-006 (hecha), T-007 (hecha), T-030 (hecha) | auth.spec.ts, 0004_invitations.sql | cubierto |
| REQ-031.1 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | rls-cash.test.ts, 0002_core.sql, 0003_rls_core.sql, 0017_loyalty_progress.sql, 0029_function_grants.sql, 0030_barber_services.sql, 0033_customer_experience.sql | cubierto |
| REQ-031.2 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | 0008_public_fns.sql, 0009_realtime.sql | cubierto |
| REQ-031.3 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | 0028_mvp_gaps.sql | cubierto |
| REQ-031.4 | Aislamiento multi-negocio | T-004 (hecha), T-005 (hecha), T-032 (hecha), T-042 (hecha) | rls-core.test.ts, 0003_rls_core.sql | cubierto |
| REQ-032.1 | PWA instalable | T-001 (hecha), T-010 (en curso), T-029 (hecha) | pwa-usability.spec.ts, pwa.test.ts | prueba escrita |
| REQ-032.2 | PWA instalable | T-001 (hecha), T-010 (en curso), T-029 (hecha) | pwa-usability.spec.ts | prueba escrita |
| REQ-033.1 | Plantillas de mensajes de WhatsApp | T-024 (hecha) | admin-config.spec.ts, render-template.test.ts, 0002_core.sql | cubierto |
| REQ-034.1 | Datos de ejemplo (seed) | T-009 (hecha), T-030 (hecha) | 0009_seed.sql | cubierto |
| REQ-035.1 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | services-by-barber.spec.ts, 0030_barber_services.sql | cubierto |
| REQ-035.2 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | services-by-barber.spec.ts, 0030_barber_services.sql | cubierto |
| REQ-035.3 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | services-by-barber.spec.ts, 0030_barber_services.sql | cubierto |
| REQ-035.4 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | 0030_barber_services.sql | cubierto |
| REQ-035.5 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | 0030_barber_services.sql | cubierto |
| REQ-035.6 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | services-by-barber.spec.ts, public-queue.test.ts, barber-services.test.ts, 0032_estimate_by_service.sql | cubierto |
| REQ-035.7 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | services-by-barber.spec.ts, public-queue.test.ts, barber-services.test.ts, 0031_queue_by_service.sql | cubierto |
| REQ-035.8 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | public-queue.test.ts, 0031_queue_by_service.sql | cubierto |
| REQ-035.9 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | barber-queue-by-service.spec.ts, queue-estimate.test.ts, 0030_barber_services.sql, 0031_queue_by_service.sql | cubierto |
| REQ-035.10 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | barber-queue-by-service.spec.ts, queue-estimate.test.ts, 0031_queue_by_service.sql, 0032_estimate_by_service.sql | cubierto |
| REQ-035.11 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | services-by-barber.spec.ts, 0031_queue_by_service.sql | cubierto |
| REQ-035.12 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | 0031_queue_by_service.sql | cubierto |
| REQ-035.13 | Servicios por barbero | T-051 (hecha), T-052 (hecha), T-053 (hecha), T-054 (hecha), T-055 (hecha), T-056 (hecha), T-057 (hecha) | 0031_queue_by_service.sql | cubierto |
| REQ-036.1 | Reseña en Google después del corte | T-058 (hecha), T-059 (hecha), T-063 (hecha), T-174 (pendiente) | google-review.spec.ts, review-link.test.ts, 0033_customer_experience.sql | prueba escrita |
| REQ-036.2 | Reseña en Google después del corte | T-058 (hecha), T-059 (hecha), T-063 (hecha), T-174 (pendiente) | google-review.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | prueba escrita |
| REQ-036.3 | Reseña en Google después del corte | T-058 (hecha), T-059 (hecha), T-063 (hecha), T-174 (pendiente) | google-review.spec.ts, 0033_customer_experience.sql | prueba escrita |
| REQ-036.4 | Reseña en Google después del corte | T-058 (hecha), T-059 (hecha), T-063 (hecha), T-174 (pendiente) | google-review.spec.ts, 0033_customer_experience.sql | prueba escrita |
| REQ-037.1 | Cumpleaños del cliente | T-058 (hecha), T-060 (hecha) | birthdays.spec.ts, birthday.test.ts, 0033_customer_experience.sql, 0035_merge_customers_birthday.sql | cubierto |
| REQ-037.2 | Cumpleaños del cliente | T-058 (hecha), T-060 (hecha) | birthdays.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-037.3 | Cumpleaños del cliente | T-058 (hecha), T-060 (hecha) | birthdays.spec.ts, public-queue.test.ts, birthday.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-037.4 | Cumpleaños del cliente | T-058 (hecha), T-060 (hecha) | birthdays.spec.ts, birthday.test.ts, 0002_core.sql, 0009_seed.sql, 0033_customer_experience.sql | cubierto |
| REQ-037.5 | Cumpleaños del cliente | T-058 (hecha), T-060 (hecha) | birthdays.spec.ts, 0033_customer_experience.sql | cubierto |
| REQ-037.6 | Cumpleaños del cliente | T-058 (hecha), T-060 (hecha) | 0009_seed.sql, 0033_customer_experience.sql, 0039_whatsapp_screens.sql | cubierto |
| REQ-038.1 | Menú de la barbería y bebida de cortesía | T-058 (hecha), T-061 (hecha), T-173 (hecha) | menu-courtesy.spec.ts, product-form.test.ts, resize.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-038.2 | Menú de la barbería y bebida de cortesía | T-058 (hecha), T-061 (hecha), T-173 (hecha) | menu-courtesy.spec.ts, public-queue.test.ts, product-form.test.ts, public-home.test.tsx, 0033_customer_experience.sql | cubierto |
| REQ-038.3 | Menú de la barbería y bebida de cortesía | T-058 (hecha), T-061 (hecha), T-173 (hecha) | menu-courtesy.spec.ts, public-queue.test.ts, 0009_seed.sql, 0033_customer_experience.sql | cubierto |
| REQ-038.4 | Menú de la barbería y bebida de cortesía | T-058 (hecha), T-061 (hecha), T-173 (hecha) | menu-courtesy.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-038.5 | Menú de la barbería y bebida de cortesía | T-058 (hecha), T-061 (hecha), T-173 (hecha) | menu-courtesy.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-038.6 | Menú de la barbería y bebida de cortesía | T-058 (hecha), T-061 (hecha), T-173 (hecha) | menu-courtesy.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-038.7 | Menú de la barbería y bebida de cortesía | T-058 (hecha), T-061 (hecha), T-173 (hecha) | menu-courtesy.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-039.1 | Fotos de cortes por barbero | T-058 (hecha), T-062 (hecha), T-063 (hecha) | barber-photos.spec.ts, barber-photos.test.ts, 0029_function_grants.sql, 0033_customer_experience.sql | cubierto |
| REQ-039.2 | Fotos de cortes por barbero | T-058 (hecha), T-062 (hecha), T-063 (hecha) | barber-photos.spec.ts, 0033_customer_experience.sql | cubierto |
| REQ-039.3 | Fotos de cortes por barbero | T-058 (hecha), T-062 (hecha), T-063 (hecha) | barber-photos.spec.ts, barber-photos.test.ts | cubierto |
| REQ-039.4 | Fotos de cortes por barbero | T-058 (hecha), T-062 (hecha), T-063 (hecha) | barber-photos.spec.ts, barber-photos.test.ts, resize.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-039.5 | Fotos de cortes por barbero | T-058 (hecha), T-062 (hecha), T-063 (hecha) | barber-photos.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-039.6 | Fotos de cortes por barbero | T-058 (hecha), T-062 (hecha), T-063 (hecha) | barber-photos.spec.ts, public-queue.test.ts, 0033_customer_experience.sql | cubierto |
| REQ-040.1 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | dispatch.test.ts, after-queue-change.test.ts, cloud-api.test.ts, queue-actions.test.ts, queue-notifications.test.ts, 0037_notification_queue.sql | prueba escrita |
| REQ-040.2 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | dispatch.test.ts, queue-actions.test.ts, queue-notifications.test.ts, 0036_whatsapp_notifications.sql | prueba escrita |
| REQ-040.3 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | dispatch.test.ts, queue-notifications.test.ts, 0036_whatsapp_notifications.sql, 0037_notification_queue.sql | prueba escrita |
| REQ-040.4 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | dispatch.test.ts, queue-notifications.test.ts | prueba escrita |
| REQ-040.5 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | dispatch.test.ts, queue-actions.test.ts, queue-notifications.test.ts, 0036_whatsapp_notifications.sql, 0037_notification_queue.sql | prueba escrita |
| REQ-040.6 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | whatsapp-notices.spec.ts, dispatch.test.ts, 0036_whatsapp_notifications.sql | prueba escrita |
| REQ-040.7 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | dispatch.test.ts, whatsapp-webhook.test.ts, after-queue-change.test.ts, cloud-api.test.ts, whatsapp-webhook-route.test.ts, whatsapp-webhook.test.ts, 0036_whatsapp_notifications.sql, 0037_notification_queue.sql | prueba escrita |
| REQ-040.8 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | whatsapp-notices.spec.ts, dispatch.test.ts, after-queue-change.test.ts | prueba escrita |
| REQ-040.9 | Avisos automáticos del turno | T-064 (hecha), T-065 (hecha), T-066 (hecha), T-067 (hecha), T-068 (hecha), T-069 (pendiente) | whatsapp-notices.spec.ts, whatsapp-screens.test.ts | prueba escrita |
| REQ-041.1 | Permiso del cliente para los avisos | T-064 (hecha), T-068 (hecha) | whatsapp-notices.spec.ts, public-queue.test.ts, 0036_whatsapp_notifications.sql, 0039_whatsapp_screens.sql | cubierto |
| REQ-041.2 | Permiso del cliente para los avisos | T-064 (hecha), T-068 (hecha) | whatsapp-notices.spec.ts, public-queue.test.ts, 0036_whatsapp_notifications.sql | cubierto |
| REQ-041.3 | Permiso del cliente para los avisos | T-064 (hecha), T-068 (hecha) | whatsapp-notices.spec.ts, public-queue.test.ts, 0039_whatsapp_screens.sql | cubierto |
| REQ-041.4 | Permiso del cliente para los avisos | T-064 (hecha), T-068 (hecha) | whatsapp-notices.spec.ts, 0036_whatsapp_notifications.sql | cubierto |
| REQ-041.5 | Permiso del cliente para los avisos | T-064 (hecha), T-068 (hecha) | dispatch.test.ts, 0036_whatsapp_notifications.sql, 0039_whatsapp_screens.sql | cubierto |
| REQ-041.6 | Permiso del cliente para los avisos | T-064 (hecha), T-068 (hecha) | 0039_whatsapp_screens.sql | cubierto |
| REQ-042.1 | Baja y respuestas del cliente | T-064 (hecha), T-067 (hecha), T-068 (hecha) | whatsapp-notices.spec.ts, public-queue.test.ts, 0036_whatsapp_notifications.sql, 0039_whatsapp_screens.sql | cubierto |
| REQ-042.2 | Baja y respuestas del cliente | T-064 (hecha), T-067 (hecha), T-068 (hecha) | whatsapp-webhook.test.ts, whatsapp-webhook.test.ts, 0036_whatsapp_notifications.sql, 0038_whatsapp_inbound.sql | cubierto |
| REQ-042.3 | Baja y respuestas del cliente | T-064 (hecha), T-067 (hecha), T-068 (hecha) | whatsapp-notices.spec.ts, dispatch.test.ts, whatsapp-webhook.test.ts, 0036_whatsapp_notifications.sql, 0038_whatsapp_inbound.sql | cubierto |
| REQ-042.4 | Baja y respuestas del cliente | T-064 (hecha), T-067 (hecha), T-068 (hecha) | whatsapp-notices.spec.ts, whatsapp-webhook.test.ts, cloud-api.test.ts, whatsapp-screens.test.ts, whatsapp-webhook.test.ts, 0036_whatsapp_notifications.sql, 0038_whatsapp_inbound.sql | cubierto |
| REQ-042.5 | Baja y respuestas del cliente | T-064 (hecha), T-067 (hecha), T-068 (hecha) | whatsapp-webhook.test.ts, whatsapp-screens.test.ts, whatsapp-webhook.test.ts, 0038_whatsapp_inbound.sql | cubierto |
| REQ-043.1 | Control y activación | T-064 (hecha), T-065 (hecha), T-067 (hecha), T-068 (hecha), T-070 (hecha), T-069 (pendiente) | 0036_whatsapp_notifications.sql | prueba escrita |
| REQ-043.2 | Control y activación | T-064 (hecha), T-065 (hecha), T-067 (hecha), T-068 (hecha), T-070 (hecha), T-069 (pendiente) | whatsapp-notices.spec.ts, whatsapp-screens.test.ts, 0036_whatsapp_notifications.sql | prueba escrita |
| REQ-043.3 | Control y activación | T-064 (hecha), T-065 (hecha), T-067 (hecha), T-068 (hecha), T-070 (hecha), T-069 (pendiente) | whatsapp-notices.spec.ts, dispatch.test.ts, public-queue.test.ts, after-queue-change.test.ts, cloud-api.test.ts, whatsapp-screens.test.ts, whatsapp-webhook-route.test.ts, 0036_whatsapp_notifications.sql, 0037_notification_queue.sql, 0039_whatsapp_screens.sql | prueba escrita |
| REQ-043.4 | Control y activación | T-064 (hecha), T-065 (hecha), T-067 (hecha), T-068 (hecha), T-070 (hecha), T-069 (pendiente) | whatsapp-notices.spec.ts, dispatch.test.ts, whatsapp-webhook.test.ts, cloud-api.test.ts | prueba escrita |
| REQ-043.5 | Control y activación | T-064 (hecha), T-065 (hecha), T-067 (hecha), T-068 (hecha), T-070 (hecha), T-069 (pendiente) | whatsapp-webhook-route.test.ts, whatsapp-webhook.test.ts | prueba escrita |
| REQ-043.6 | Control y activación | T-064 (hecha), T-065 (hecha), T-067 (hecha), T-068 (hecha), T-070 (hecha), T-069 (pendiente) | whatsapp-notices.spec.ts, whatsapp-screens.test.ts, 0040_whatsapp_allowed.sql | prueba escrita |
| REQ-044.1 | Plan de membresía | T-071 (hecha), T-074 (hecha), T-077 (hecha) | membership.test.ts, 0041_memberships.sql | cubierto |
| REQ-044.2 | Plan de membresía | T-071 (hecha), T-074 (hecha), T-077 (hecha) | memberships.spec.ts, memberships.test.ts, membership.test.ts, 0041_memberships.sql | cubierto |
| REQ-044.3 | Plan de membresía | T-071 (hecha), T-074 (hecha), T-077 (hecha) | memberships.test.ts, 0041_memberships.sql | cubierto |
| REQ-044.4 | Plan de membresía | T-071 (hecha), T-074 (hecha), T-077 (hecha) | 0041_memberships.sql, 0042_membership_sales.sql | cubierto |
| REQ-044.5 | Plan de membresía | T-071 (hecha), T-074 (hecha), T-077 (hecha) | memberships.test.ts, membership.test.ts, 0042_membership_checkout.sql, 0042_membership_sales.sql, 0043_membership_reports.sql | cubierto |
| REQ-045.1 | Cuota y vigencia | T-072 (hecha), T-074 (hecha) | memberships.spec.ts, memberships.test.ts, 0042_membership_checkout.sql, 0042_membership_sales.sql | cubierto |
| REQ-045.2 | Cuota y vigencia | T-072 (hecha), T-074 (hecha) | 0042_membership_sales.sql | cubierto |
| REQ-045.3 | Cuota y vigencia | T-072 (hecha), T-074 (hecha) | 0042_membership_sales.sql | cubierto |
| REQ-045.4 | Cuota y vigencia | T-072 (hecha), T-074 (hecha) | 0042_membership_sales.sql, 0043_membership_reports.sql | cubierto |
| REQ-045.5 | Cuota y vigencia | T-072 (hecha), T-074 (hecha) | 0042_membership_sales.sql | cubierto |
| REQ-045.6 | Cuota y vigencia | T-072 (hecha), T-074 (hecha) | 0042_membership_sales.sql, 0043_membership_reports.sql | cubierto |
| REQ-045.7 | Cuota y vigencia | T-072 (hecha), T-074 (hecha) | 0042_membership_sales.sql | cubierto |
| REQ-046.1 | Familia | T-071 (hecha), T-074 (hecha) | 0041_memberships.sql | cubierto |
| REQ-046.2 | Familia | T-071 (hecha), T-074 (hecha) | memberships.spec.ts, memberships.test.ts, 0041_memberships.sql | cubierto |
| REQ-046.3 | Familia | T-071 (hecha), T-074 (hecha) | membership.test.ts, 0041_memberships.sql | cubierto |
| REQ-046.4 | Familia | T-071 (hecha), T-074 (hecha) | memberships.test.ts, membership.test.ts, 0041_memberships.sql | cubierto |
| REQ-047.1 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | membership-checkout.spec.ts, membership.test.ts, 0042_membership_checkout.sql | cubierto |
| REQ-047.2 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | commission.test.ts, membership.test.ts, 0042_membership_checkout.sql | cubierto |
| REQ-047.3 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | membership-checkout.spec.ts, 0042_membership_checkout.sql | cubierto |
| REQ-047.4 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | commission.test.ts, 0042_membership_checkout.sql | cubierto |
| REQ-047.5 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | membership-checkout.spec.ts, membership.test.ts, 0042_membership_checkout.sql | cubierto |
| REQ-047.6 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | 0042_membership_checkout.sql | cubierto |
| REQ-047.7 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | 0042_membership_checkout.sql | cubierto |
| REQ-047.8 | Usar la membresía en el cobro | T-073 (hecha), T-075 (hecha) | 0042_membership_checkout.sql | cubierto |
| REQ-048.1 | Lo que ven el cliente, el barbero y el dueño | T-074 (hecha), T-075 (hecha), T-076 (hecha), T-077 (hecha) | membership-checkout.spec.ts, memberships.test.ts, membership.test.ts, 0043_membership_reports.sql | cubierto |
| REQ-048.2 | Lo que ven el cliente, el barbero y el dueño | T-074 (hecha), T-075 (hecha), T-076 (hecha), T-077 (hecha) | membership-checkout.spec.ts, memberships.test.ts, 0043_membership_reports.sql | cubierto |
| REQ-048.3 | Lo que ven el cliente, el barbero y el dueño | T-074 (hecha), T-075 (hecha), T-076 (hecha), T-077 (hecha) | membership-reports.spec.ts, cash-closure.test.ts, membership.test.ts, 0043_membership_reports.sql | cubierto |
| REQ-048.4 | Lo que ven el cliente, el barbero y el dueño | T-074 (hecha), T-075 (hecha), T-076 (hecha), T-077 (hecha) | memberships.spec.ts, memberships.test.ts, membership.test.ts, 0002_core.sql, 0043_membership_reports.sql | cubierto |
| REQ-048.5 | Lo que ven el cliente, el barbero y el dueño | T-074 (hecha), T-075 (hecha), T-076 (hecha), T-077 (hecha) | 0043_membership_reports.sql | cubierto |
| REQ-049.1 | Agenda de citas | T-078 (hecha), T-081 (hecha), T-087 (en curso) | appointments-settings.spec.ts, appointments.test.ts, 0045_appointments.sql | prueba escrita |
| REQ-049.2 | Agenda de citas | T-078 (hecha), T-081 (hecha), T-087 (en curso) | appointments-settings.spec.ts, appointments.test.ts, 0045_appointments.sql | prueba escrita |
| REQ-049.3 | Agenda de citas | T-078 (hecha), T-081 (hecha), T-087 (en curso) | 0045_appointments.sql, 0048_appointment_public_info.sql | prueba escrita |
| REQ-049.4 | Agenda de citas | T-078 (hecha), T-081 (hecha), T-087 (en curso) | appointments.test.ts, 0045_appointments.sql, 0048_appointment_public_info.sql | prueba escrita |
| REQ-049.5 | Agenda de citas | T-078 (hecha), T-081 (hecha), T-087 (en curso) | 0045_appointments.sql, 0046_appointments_queue.sql, 0048_appointment_public_info.sql | prueba escrita |
| REQ-049.6 | Agenda de citas | T-078 (hecha), T-081 (hecha), T-087 (en curso) | appointments-settings.spec.ts, appointments.test.ts, 0045_appointments.sql | prueba escrita |
| REQ-050.1 | Reservar una cita | T-078 (hecha), T-082 (hecha), T-085 (hecha) | appointments-public.spec.ts, appointments.test.ts, appointments.test.ts, 0048_appointment_public_info.sql | cubierto |
| REQ-050.2 | Reservar una cita | T-078 (hecha), T-082 (hecha), T-085 (hecha) | appointments.test.ts, 0045_appointments.sql, 0049_appointments_customer.sql | cubierto |
| REQ-050.3 | Reservar una cita | T-078 (hecha), T-082 (hecha), T-085 (hecha) | appointments.test.ts, 0045_appointments.sql | cubierto |
| REQ-050.4 | Reservar una cita | T-078 (hecha), T-082 (hecha), T-085 (hecha) | appointments.test.ts, appointments.test.ts, 0045_appointments.sql | cubierto |
| REQ-050.5 | Reservar una cita | T-078 (hecha), T-082 (hecha), T-085 (hecha) | appointments.test.ts, 0045_appointments.sql | cubierto |
| REQ-050.6 | Reservar una cita | T-078 (hecha), T-082 (hecha), T-085 (hecha) | appointments-agenda.spec.ts, appointments.test.ts, appointments.test.ts, 0045_appointments.sql | cubierto |
| REQ-050.7 | Reservar una cita | T-078 (hecha), T-082 (hecha), T-085 (hecha) | appointments.test.ts | cubierto |
| REQ-051.1 | Mi cita | T-080 (hecha), T-083 (hecha) | appointments-public.spec.ts, appointments.test.ts, appointments.test.ts | cubierto |
| REQ-051.2 | Mi cita | T-080 (hecha), T-083 (hecha) | appointments-public.spec.ts, appointments.test.ts, 0045_appointments.sql | cubierto |
| REQ-051.3 | Mi cita | T-080 (hecha), T-083 (hecha) | appointments-public.spec.ts, appointments.test.ts | cubierto |
| REQ-051.4 | Mi cita | T-080 (hecha), T-083 (hecha) | appointments.test.ts | cubierto |
| REQ-051.5 | Mi cita | T-080 (hecha), T-083 (hecha) | appointments.test.ts, appointments.test.ts | cubierto |
| REQ-051.6 | Mi cita | T-080 (hecha), T-083 (hecha) | appointments-public.spec.ts, appointments.test.ts | cubierto |
| REQ-052.1 | Llegada y prioridad en la fila | T-079 (hecha), T-084 (hecha) | appointments-queue.spec.ts, 0046_appointments_queue.sql | cubierto |
| REQ-052.2 | Llegada y prioridad en la fila | T-079 (hecha), T-084 (hecha) | appointments-queue.spec.ts, appointments.test.ts, appointments.test.ts, queue-actions.test.ts, 0046_appointments_queue.sql | cubierto |
| REQ-052.3 | Llegada y prioridad en la fila | T-079 (hecha), T-084 (hecha) | 0046_appointments_queue.sql | cubierto |
| REQ-052.4 | Llegada y prioridad en la fila | T-079 (hecha), T-084 (hecha) | appointments-queue.spec.ts, appointments.test.ts, queue-actions.test.ts, 0046_appointments_queue.sql | cubierto |
| REQ-052.5 | Llegada y prioridad en la fila | T-079 (hecha), T-084 (hecha) | 0046_appointments_queue.sql | cubierto |
| REQ-052.6 | Llegada y prioridad en la fila | T-079 (hecha), T-084 (hecha) | 0046_appointments_queue.sql | cubierto |
| REQ-053.1 | Estimado con citas | T-080 (hecha), T-084 (hecha) | appointments.test.ts, appointments.test.ts, 0046_appointments_queue.sql | cubierto |
| REQ-053.2 | Estimado con citas | T-080 (hecha), T-084 (hecha) | appointments.test.ts, appointments.test.ts, 0046_appointments_queue.sql | cubierto |
| REQ-053.3 | Estimado con citas | T-080 (hecha), T-084 (hecha) | appointments.test.ts, 0046_appointments_queue.sql | cubierto |
| REQ-054.1 | Agenda del dueño y avisos | T-079 (hecha), T-084 (hecha), T-085 (hecha), T-086 (hecha), T-087 (en curso) | appointments.test.ts, appointments.test.ts | prueba escrita |
| REQ-054.2 | Agenda del dueño y avisos | T-079 (hecha), T-084 (hecha), T-085 (hecha), T-086 (hecha), T-087 (en curso) | appointments-agenda.spec.ts, appointments.test.ts, 0045_appointments.sql | prueba escrita |
| REQ-054.3 | Agenda del dueño y avisos | T-079 (hecha), T-084 (hecha), T-085 (hecha), T-086 (hecha), T-087 (en curso) | appointments-agenda.spec.ts, appointments.test.ts, appointments.test.ts | prueba escrita |
| REQ-054.4 | Agenda del dueño y avisos | T-079 (hecha), T-084 (hecha), T-085 (hecha), T-086 (hecha), T-087 (en curso) | 0046_appointments_queue.sql | prueba escrita |
| REQ-054.5 | Agenda del dueño y avisos | T-079 (hecha), T-084 (hecha), T-085 (hecha), T-086 (hecha), T-087 (en curso) | appointment-templates.spec.ts, appointment-templates.test.ts, 0046_appointments_queue.sql | prueba escrita |
| REQ-054.6 | Agenda del dueño y avisos | T-079 (hecha), T-084 (hecha), T-085 (hecha), T-086 (hecha), T-087 (en curso) | 0045_appointments.sql, 0046_appointments_queue.sql | prueba escrita |
| REQ-055.1 | Vender una tarjeta de regalo | T-090 (hecha), T-093 (hecha), T-097 (hecha) | gift-cards.spec.ts, gift-cards.test.ts, gift-card.test.ts, 0051_gift_cards.sql | cubierto |
| REQ-055.2 | Vender una tarjeta de regalo | T-090 (hecha), T-093 (hecha), T-097 (hecha) | gift-cards.spec.ts, gift-cards.test.ts, gift-card.test.ts, 0051_gift_cards.sql | cubierto |
| REQ-055.3 | Vender una tarjeta de regalo | T-090 (hecha), T-093 (hecha), T-097 (hecha) | gift-card.test.ts, 0051_gift_cards.sql, 0056_merge_customers_gift_cards.sql | cubierto |
| REQ-055.4 | Vender una tarjeta de regalo | T-090 (hecha), T-093 (hecha), T-097 (hecha) | gift-cards.spec.ts, gift-card.test.ts, 0051_gift_cards.sql | cubierto |
| REQ-055.5 | Vender una tarjeta de regalo | T-090 (hecha), T-093 (hecha), T-097 (hecha) | 0051_gift_cards.sql | cubierto |
| REQ-055.6 | Vender una tarjeta de regalo | T-090 (hecha), T-093 (hecha), T-097 (hecha) | 0051_gift_cards.sql | cubierto |
| REQ-056.1 | Entregar la tarjeta | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-094 (hecha) | gift-cards.spec.ts, gift-card.test.ts, 0002_core.sql, 0053_gift_card_reports.sql | cubierto |
| REQ-056.2 | Entregar la tarjeta | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-094 (hecha) | gift-card-page.spec.ts, gift-card-page.test.ts | cubierto |
| REQ-056.3 | Entregar la tarjeta | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-094 (hecha) | gift-card-page.spec.ts, gift-card-page.test.ts, 0051_gift_cards.sql | cubierto |
| REQ-056.4 | Entregar la tarjeta | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-094 (hecha) | gift-cards.spec.ts, gift-cards.test.ts | cubierto |
| REQ-057.1 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | gift-card-checkout.spec.ts, gift-cards.test.ts, gift-card.test.ts, 0051_gift_cards.sql | cubierto |
| REQ-057.2 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | gift-card-checkout.spec.ts, gift-cards.test.ts, gift-card.test.ts, 0052_gift_card_checkout.sql | cubierto |
| REQ-057.3 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | gift-card-checkout.spec.ts, gift-cards.test.ts, gift-card.test.ts, 0052_gift_card_checkout.sql | cubierto |
| REQ-057.4 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | gift-card-checkout.spec.ts, gift-cards.test.ts, 0052_gift_card_checkout.sql | cubierto |
| REQ-057.5 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | commission.test.ts, 0052_gift_card_checkout.sql | cubierto |
| REQ-057.6 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | gift-card.test.ts, 0052_gift_card_checkout.sql | cubierto |
| REQ-057.7 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | gift-card.test.ts, 0051_gift_cards.sql, 0052_gift_card_checkout.sql | cubierto |
| REQ-057.8 | Pagar con la tarjeta en el cobro | T-091 (hecha), T-095 (hecha) | 0052_gift_card_checkout.sql | cubierto |
| REQ-058.1 | Anular y vencer | T-091 (hecha), T-094 (hecha), T-096 (hecha) | gift-card-reports.spec.ts, gift-card.test.ts, 0052_gift_card_checkout.sql | cubierto |
| REQ-058.2 | Anular y vencer | T-091 (hecha), T-094 (hecha), T-096 (hecha) | 0052_gift_card_checkout.sql | cubierto |
| REQ-058.3 | Anular y vencer | T-091 (hecha), T-094 (hecha), T-096 (hecha) | 0052_gift_card_checkout.sql | cubierto |
| REQ-058.4 | Anular y vencer | T-091 (hecha), T-094 (hecha), T-096 (hecha) | gift-card-page.test.ts, 0051_gift_cards.sql, 0052_gift_card_checkout.sql | cubierto |
| REQ-059.1 | Lo que ve el dueño | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-096 (hecha), T-097 (hecha) | gift-card-reports.spec.ts, cash-closure.test.ts, gift-card.test.ts, 0053_gift_card_reports.sql | cubierto |
| REQ-059.2 | Lo que ve el dueño | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-096 (hecha), T-097 (hecha) | gift-card-reports.spec.ts, cash-closure.test.ts, gift-card.test.ts, 0053_gift_card_reports.sql | cubierto |
| REQ-059.3 | Lo que ve el dueño | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-096 (hecha), T-097 (hecha) | gift-cards.spec.ts, gift-card.test.ts, 0051_gift_cards.sql, 0056_merge_customers_gift_cards.sql | cubierto |
| REQ-059.4 | Lo que ve el dueño | T-090 (hecha), T-092 (hecha), T-093 (hecha), T-096 (hecha), T-097 (hecha) | 0053_gift_card_reports.sql | cubierto |
| REQ-060.1 | Encender el módulo y editar las listas | T-100 (hecha), T-101 (hecha), T-103 (hecha), T-105 (hecha), T-109 (hecha) | cleaning-owner.spec.ts, 0057_cleaning.sql, 0058_cleaning_records.sql | cubierto |
| REQ-060.2 | Encender el módulo y editar las listas | T-100 (hecha), T-101 (hecha), T-103 (hecha), T-105 (hecha), T-109 (hecha) | cleaning-owner.spec.ts, 0057_cleaning.sql | cubierto |
| REQ-060.3 | Encender el módulo y editar las listas | T-100 (hecha), T-101 (hecha), T-103 (hecha), T-105 (hecha), T-109 (hecha) | cleaning-owner.spec.ts, 0057_cleaning.sql | cubierto |
| REQ-060.4 | Encender el módulo y editar las listas | T-100 (hecha), T-101 (hecha), T-103 (hecha), T-105 (hecha), T-109 (hecha) | 0057_cleaning.sql, 0058_cleaning_records.sql | cubierto |
| REQ-060.5 | Encender el módulo y editar las listas | T-100 (hecha), T-101 (hecha), T-103 (hecha), T-105 (hecha), T-109 (hecha) | cleaning.test.ts, cleaning.test.ts, 0058_cleaning_records.sql | cubierto |
| REQ-061.1 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning.test.ts, 0058_cleaning_records.sql | cubierto |
| REQ-061.2 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning.test.ts, cleaning.test.ts, 0058_cleaning_records.sql | cubierto |
| REQ-061.3 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning-barber.spec.ts, cleaning.test.ts, cleaning.test.ts, 0058_cleaning_records.sql | cubierto |
| REQ-061.4 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning-barber.spec.ts, cleaning.test.ts, cleaning.test.ts, 0058_cleaning_records.sql | cubierto |
| REQ-061.5 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning-barber.spec.ts, cleaning.test.ts | cubierto |
| REQ-061.6 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning.test.ts | cubierto |
| REQ-061.7 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning-barber.spec.ts, cleaning.test.ts, cleaning.test.ts, 0058_cleaning_records.sql | cubierto |
| REQ-061.8 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning-barber.spec.ts, 0058_cleaning_records.sql | cubierto |
| REQ-061.9 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | 0058_cleaning_records.sql | cubierto |
| REQ-061.10 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | 0058_cleaning_records.sql | cubierto |
| REQ-061.11 | Registrar apertura, cierre y limpieza profunda | T-101 (hecha), T-103 (hecha), T-104 (hecha) | cleaning-barber.spec.ts, 0058_cleaning_records.sql | cubierto |
| REQ-062.1 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | cleaning-barber.spec.ts, cleaning-owner.spec.ts, 0058_cleaning_records.sql | cubierto |
| REQ-062.2 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | cleaning-barber.spec.ts, 0058_cleaning_records.sql | cubierto |
| REQ-062.3 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | cleaning-owner.spec.ts, 0058_cleaning_records.sql | cubierto |
| REQ-062.4 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | 0058_cleaning_records.sql | cubierto |
| REQ-062.5 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | 0058_cleaning_records.sql | cubierto |
| REQ-062.6 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | cleaning-barber.spec.ts, cleaning-owner.spec.ts | cubierto |
| REQ-062.7 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | 0058_cleaning_records.sql | cubierto |
| REQ-062.8 | Avisos dentro de TurnOS | T-104 (hecha), T-105 (hecha) | 0058_cleaning_records.sql, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-063.1 | Revisión del dueño e historial | T-100 (hecha), T-102 (hecha), T-106 (hecha), T-108 (hecha) | cleaning-inspection.spec.ts, 0057_cleaning.sql, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-063.2 | Revisión del dueño e historial | T-100 (hecha), T-102 (hecha), T-106 (hecha), T-108 (hecha) | cleaning-inspection.spec.ts, 0057_cleaning.sql, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-063.3 | Revisión del dueño e historial | T-100 (hecha), T-102 (hecha), T-106 (hecha), T-108 (hecha) | cleaning-inspection.spec.ts, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-063.4 | Revisión del dueño e historial | T-100 (hecha), T-102 (hecha), T-106 (hecha), T-108 (hecha) | cleaning-inspection.spec.ts, 0057_cleaning.sql, 0058_cleaning_records.sql, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-063.5 | Revisión del dueño e historial | T-100 (hecha), T-102 (hecha), T-106 (hecha), T-108 (hecha) | cleaning-history.spec.ts, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-063.6 | Revisión del dueño e historial | T-100 (hecha), T-102 (hecha), T-106 (hecha), T-108 (hecha) | cleaning-history.spec.ts, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-063.7 | Revisión del dueño e historial | T-100 (hecha), T-102 (hecha), T-106 (hecha), T-108 (hecha) | cleaning-history.spec.ts, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-064.1 | Tareas periódicas, fotos privadas y retención | T-100 (hecha), T-102 (hecha), T-103 (hecha), T-107 (hecha), T-108 (hecha), T-109 (hecha) | cleaning-tasks.spec.ts, cleaning.test.ts, cleaning.test.ts, 0057_cleaning.sql, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-064.2 | Tareas periódicas, fotos privadas y retención | T-100 (hecha), T-102 (hecha), T-103 (hecha), T-107 (hecha), T-108 (hecha), T-109 (hecha) | cleaning-tasks.spec.ts, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-064.3 | Tareas periódicas, fotos privadas y retención | T-100 (hecha), T-102 (hecha), T-103 (hecha), T-107 (hecha), T-108 (hecha), T-109 (hecha) | cleaning-tasks.spec.ts, cleaning.test.ts, 0057_cleaning.sql, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-064.4 | Tareas periódicas, fotos privadas y retención | T-100 (hecha), T-102 (hecha), T-103 (hecha), T-107 (hecha), T-108 (hecha), T-109 (hecha) | cleaning-tasks.spec.ts, cleaning.test.ts, cleaning.test.ts, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-064.5 | Tareas periódicas, fotos privadas y retención | T-100 (hecha), T-102 (hecha), T-103 (hecha), T-107 (hecha), T-108 (hecha), T-109 (hecha) | cleaning-tasks.spec.ts, cleaning.test.ts, 0057_cleaning.sql, 0058_cleaning_records.sql | cubierto |
| REQ-064.6 | Tareas periódicas, fotos privadas y retención | T-100 (hecha), T-102 (hecha), T-103 (hecha), T-107 (hecha), T-108 (hecha), T-109 (hecha) | cleaning-history.spec.ts, cleaning.test.ts, cleaning.test.ts, 0059_cleaning_review_tasks.sql | cubierto |
| REQ-065.1 | Configurar la comisión y la vitrina | T-110 (hecha), T-111 (hecha), T-115 (hecha), T-119 (hecha) | pos-settings.spec.ts, 0060_pos_products.sql | cubierto |
| REQ-065.2 | Configurar la comisión y la vitrina | T-110 (hecha), T-111 (hecha), T-115 (hecha), T-119 (hecha) | pos-settings.spec.ts, product-form.test.ts, 0060_pos_products.sql | cubierto |
| REQ-065.3 | Configurar la comisión y la vitrina | T-110 (hecha), T-111 (hecha), T-115 (hecha), T-119 (hecha) | pos-settings.spec.ts, product-form.test.ts, 0060_pos_products.sql | cubierto |
| REQ-065.4 | Configurar la comisión y la vitrina | T-110 (hecha), T-111 (hecha), T-115 (hecha), T-119 (hecha) | 0060_pos_products.sql, 0061_pos_register_sale.sql | cubierto |
| REQ-065.5 | Configurar la comisión y la vitrina | T-110 (hecha), T-111 (hecha), T-115 (hecha), T-119 (hecha) | 0061_pos_register_sale.sql | cubierto |
| REQ-066.1 | Vender en la vitrina | T-111 (hecha), T-116 (hecha), T-117 (hecha) | pos-showcase.spec.ts, 0061_pos_register_sale.sql | cubierto |
| REQ-066.2 | Vender en la vitrina | T-111 (hecha), T-116 (hecha), T-117 (hecha) | pos-showcase.spec.ts, showcase.test.ts | cubierto |
| REQ-066.3 | Vender en la vitrina | T-111 (hecha), T-116 (hecha), T-117 (hecha) | new-sale.spec.ts, pos-showcase.spec.ts, showcase.test.ts, 0061_pos_register_sale.sql | cubierto |
| REQ-066.4 | Vender en la vitrina | T-111 (hecha), T-116 (hecha), T-117 (hecha) | pos-showcase.spec.ts, pos.test.ts, 0061_pos_register_sale.sql | cubierto |
| REQ-066.5 | Vender en la vitrina | T-111 (hecha), T-116 (hecha), T-117 (hecha) | pos-showcase.spec.ts | cubierto |
| REQ-066.6 | Vender en la vitrina | T-111 (hecha), T-116 (hecha), T-117 (hecha) | 0061_pos_register_sale.sql | cubierto |
| REQ-067.1 | Comisión por productos | T-111 (hecha), T-114 (hecha) | pos-showcase.spec.ts, commission.test.ts, 0060_pos_products.sql, 0061_pos_register_sale.sql | cubierto |
| REQ-067.2 | Comisión por productos | T-111 (hecha), T-114 (hecha) | 0060_pos_products.sql, 0061_pos_register_sale.sql | cubierto |
| REQ-067.3 | Comisión por productos | T-111 (hecha), T-114 (hecha) | commission.test.ts, showcase.test.ts, 0060_pos_products.sql, 0061_pos_register_sale.sql | cubierto |
| REQ-067.4 | Comisión por productos | T-111 (hecha), T-114 (hecha) | 0061_pos_register_sale.sql | cubierto |
| REQ-067.5 | Comisión por productos | T-111 (hecha), T-114 (hecha) | 0061_pos_register_sale.sql | cubierto |
| REQ-068.1 | Compra de un barbero | T-110 (hecha), T-112 (hecha), T-113 (hecha), T-114 (hecha), T-115 (hecha), T-117 (hecha) | pos-settings.spec.ts, 0060_pos_products.sql | cubierto |
| REQ-068.2 | Compra de un barbero | T-110 (hecha), T-112 (hecha), T-113 (hecha), T-114 (hecha), T-115 (hecha), T-117 (hecha) | pos-showcase.spec.ts, pos.test.ts, showcase.test.ts, 0061_pos_register_sale.sql | cubierto |
| REQ-068.3 | Compra de un barbero | T-110 (hecha), T-112 (hecha), T-113 (hecha), T-114 (hecha), T-115 (hecha), T-117 (hecha) | pos-showcase.spec.ts, pos.test.ts, commission.test.ts, 0060_pos_products.sql, 0061_pos_register_sale.sql | cubierto |
| REQ-068.4 | Compra de un barbero | T-110 (hecha), T-112 (hecha), T-113 (hecha), T-114 (hecha), T-115 (hecha), T-117 (hecha) | 0060_pos_products.sql, 0061_pos_register_sale.sql | cubierto |
| REQ-068.5 | Compra de un barbero | T-110 (hecha), T-112 (hecha), T-113 (hecha), T-114 (hecha), T-115 (hecha), T-117 (hecha) | 0062_pos_reports.sql | cubierto |
| REQ-069.1 | Anular y ver la comisión de productos | T-113 (hecha), T-118 (hecha), T-119 (hecha) | 0061_pos_register_sale.sql, 0062_pos_reports.sql | cubierto |
| REQ-069.2 | Anular y ver la comisión de productos | T-113 (hecha), T-118 (hecha), T-119 (hecha) | pos-reports.spec.ts, cash-closure.test.ts, 0062_pos_reports.sql | cubierto |
| REQ-069.3 | Anular y ver la comisión de productos | T-113 (hecha), T-118 (hecha), T-119 (hecha) | pos-reports.spec.ts, cash-closure.test.ts, 0062_pos_reports.sql | cubierto |
| REQ-069.4 | Anular y ver la comisión de productos | T-113 (hecha), T-118 (hecha), T-119 (hecha) | 0062_pos_reports.sql | cubierto |
| REQ-069.5 | Anular y ver la comisión de productos | T-113 (hecha), T-118 (hecha), T-119 (hecha) | pos-reports.spec.ts, my-numbers.test.ts, my-numbers.test.ts | cubierto |
| REQ-070.1 | Catálogo de inventario y ubicaciones | T-120 (hecha), T-126 (hecha), T-129 (hecha) | inventory.spec.ts, inventory.test.ts, inventory.test.ts, 0063_inventory.sql | cubierto |
| REQ-070.2 | Catálogo de inventario y ubicaciones | T-120 (hecha), T-126 (hecha), T-129 (hecha) | inventory.test.ts, inventory.test.ts, 0063_inventory.sql | cubierto |
| REQ-070.3 | Catálogo de inventario y ubicaciones | T-120 (hecha), T-126 (hecha), T-129 (hecha) | 0063_inventory.sql | cubierto |
| REQ-070.4 | Catálogo de inventario y ubicaciones | T-120 (hecha), T-126 (hecha), T-129 (hecha) | 0063_inventory.sql | cubierto |
| REQ-070.5 | Catálogo de inventario y ubicaciones | T-120 (hecha), T-126 (hecha), T-129 (hecha) | 0063_inventory.sql, 0066_inventory_counts.sql | cubierto |
| REQ-070.6 | Catálogo de inventario y ubicaciones | T-120 (hecha), T-126 (hecha), T-129 (hecha) | inventory.test.ts, 0063_inventory.sql, 0067_inventory_reports.sql | cubierto |
| REQ-071.1 | Entradas, transferencias y reposición | T-120 (hecha), T-121 (hecha), T-125 (hecha), T-126 (hecha) | 0064_inventory_movements.sql | cubierto |
| REQ-071.2 | Entradas, transferencias y reposición | T-120 (hecha), T-121 (hecha), T-125 (hecha), T-126 (hecha) | inventory.spec.ts, 0064_inventory_movements.sql | cubierto |
| REQ-071.3 | Entradas, transferencias y reposición | T-120 (hecha), T-121 (hecha), T-125 (hecha), T-126 (hecha) | inventory.spec.ts, 0064_inventory_movements.sql | cubierto |
| REQ-071.4 | Entradas, transferencias y reposición | T-120 (hecha), T-121 (hecha), T-125 (hecha), T-126 (hecha) | inventory.spec.ts, 0064_inventory_movements.sql | cubierto |
| REQ-071.5 | Entradas, transferencias y reposición | T-120 (hecha), T-121 (hecha), T-125 (hecha), T-126 (hecha) | inventory.test.ts, 0064_inventory_movements.sql | cubierto |
| REQ-071.6 | Entradas, transferencias y reposición | T-120 (hecha), T-121 (hecha), T-125 (hecha), T-126 (hecha) | inventory.test.ts, 0063_inventory.sql, 0064_inventory_movements.sql, 0066_inventory_counts.sql | cubierto |
| REQ-072.1 | Vitrina y caja | T-121 (hecha), T-122 (hecha), T-126 (hecha) | 0065_inventory_sales_hook.sql | cubierto |
| REQ-072.2 | Vitrina y caja | T-121 (hecha), T-122 (hecha), T-126 (hecha) | 0065_inventory_sales_hook.sql | cubierto |
| REQ-072.3 | Vitrina y caja | T-121 (hecha), T-122 (hecha), T-126 (hecha) | 0065_inventory_sales_hook.sql | cubierto |
| REQ-072.4 | Vitrina y caja | T-121 (hecha), T-122 (hecha), T-126 (hecha) | 0065_inventory_sales_hook.sql | cubierto |
| REQ-072.5 | Vitrina y caja | T-121 (hecha), T-122 (hecha), T-126 (hecha) | 0064_inventory_movements.sql | cubierto |
| REQ-073.1 | Consumo esperado y conteos | T-120 (hecha), T-123 (hecha), T-126 (hecha), T-127 (hecha) | inventory.spec.ts, 0063_inventory.sql | cubierto |
| REQ-073.2 | Consumo esperado y conteos | T-120 (hecha), T-123 (hecha), T-126 (hecha), T-127 (hecha) | inventory.test.ts, 0066_inventory_counts.sql | cubierto |
| REQ-073.3 | Consumo esperado y conteos | T-120 (hecha), T-123 (hecha), T-126 (hecha), T-127 (hecha) | inventory.spec.ts, 0066_inventory_counts.sql | cubierto |
| REQ-073.4 | Consumo esperado y conteos | T-120 (hecha), T-123 (hecha), T-126 (hecha), T-127 (hecha) | inventory.spec.ts, inventory.test.ts, 0063_inventory.sql, 0066_inventory_counts.sql | cubierto |
| REQ-073.5 | Consumo esperado y conteos | T-120 (hecha), T-123 (hecha), T-126 (hecha), T-127 (hecha) | 0066_inventory_counts.sql | cubierto |
| REQ-073.6 | Consumo esperado y conteos | T-120 (hecha), T-123 (hecha), T-126 (hecha), T-127 (hecha) | inventory.test.ts, inventory.test.ts, 0066_inventory_counts.sql | cubierto |
| REQ-073.7 | Consumo esperado y conteos | T-120 (hecha), T-123 (hecha), T-126 (hecha), T-127 (hecha) | 0063_inventory.sql, 0064_inventory_movements.sql, 0066_inventory_counts.sql | cubierto |
| REQ-074.1 | Compras, costo por servicio y quién ve qué | T-124 (hecha), T-125 (hecha), T-127 (hecha), T-128 (hecha), T-129 (hecha) | 0067_inventory_reports.sql | cubierto |
| REQ-074.2 | Compras, costo por servicio y quién ve qué | T-124 (hecha), T-125 (hecha), T-127 (hecha), T-128 (hecha), T-129 (hecha) | inventory.test.ts, inventory.test.ts | cubierto |
| REQ-074.3 | Compras, costo por servicio y quién ve qué | T-124 (hecha), T-125 (hecha), T-127 (hecha), T-128 (hecha), T-129 (hecha) | 0067_inventory_reports.sql | cubierto |
| REQ-074.4 | Compras, costo por servicio y quién ve qué | T-124 (hecha), T-125 (hecha), T-127 (hecha), T-128 (hecha), T-129 (hecha) | inventory.spec.ts, inventory.test.ts, 0063_inventory.sql, 0064_inventory_movements.sql, 0067_inventory_reports.sql | cubierto |
| REQ-074.5 | Compras, costo por servicio y quién ve qué | T-124 (hecha), T-125 (hecha), T-127 (hecha), T-128 (hecha), T-129 (hecha) | 0063_inventory.sql, 0067_inventory_reports.sql | cubierto |
| REQ-075.1 | Pantallas de carga y velocidad real | T-130 (hecha), T-131 (hecha), T-132 (hecha), T-133 (pendiente) | helpers.ts, loading.spec.ts, skeleton.test.tsx | prueba escrita |
| REQ-075.2 | Pantallas de carga y velocidad real | T-130 (hecha), T-131 (hecha), T-132 (hecha), T-133 (pendiente) | skeleton.test.tsx | prueba escrita |
| REQ-075.3 | Pantallas de carga y velocidad real | T-130 (hecha), T-131 (hecha), T-132 (hecha), T-133 (pendiente) | vitals-reporter.test.tsx | prueba escrita |
| REQ-075.4 | Pantallas de carga y velocidad real | T-130 (hecha), T-131 (hecha), T-132 (hecha), T-133 (pendiente) | vitals-reporter.test.tsx, vitals.test.ts | prueba escrita |
| REQ-076.1 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | auth.spec.ts, helpers.ts, today.spec.ts | prueba escrita |
| REQ-076.2 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts, today.test.tsx | prueba escrita |
| REQ-076.3 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts | prueba escrita |
| REQ-076.4 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts, today.test.tsx | prueba escrita |
| REQ-076.5 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts, owner-alerts.test.ts, today.test.tsx | prueba escrita |
| REQ-076.6 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts, owner-alerts.test.ts, today.test.tsx | prueba escrita |
| REQ-076.7 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts, today.test.tsx | prueba escrita |
| REQ-076.8 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts, today.test.tsx | prueba escrita |
| REQ-076.9 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts, today.test.tsx | prueba escrita |
| REQ-076.10 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.test.tsx | prueba escrita |
| REQ-076.11 | Inicio "Hoy" | T-151 (hecha), T-152 (hecha), T-153 (hecha), T-154 (pendiente) | today.spec.ts | prueba escrita |
| REQ-077.1 | Menú del dueño por grupos | T-150 (hecha), T-152 (hecha), T-154 (pendiente) | admin-nav.spec.ts, admin-nav.test.tsx | prueba escrita |
| REQ-077.2 | Menú del dueño por grupos | T-150 (hecha), T-152 (hecha), T-154 (pendiente) | admin-nav.spec.ts, admin-nav.test.tsx | prueba escrita |
| REQ-077.3 | Menú del dueño por grupos | T-150 (hecha), T-152 (hecha), T-154 (pendiente) | cleaning-owner.spec.ts, admin-nav.test.tsx | prueba escrita |
| REQ-077.4 | Menú del dueño por grupos | T-150 (hecha), T-152 (hecha), T-154 (pendiente) | admin-nav.test.tsx | prueba escrita |
| REQ-077.5 | Menú del dueño por grupos | T-150 (hecha), T-152 (hecha), T-154 (pendiente) | admin-nav.spec.ts, admin-nav.test.tsx | prueba escrita |
| REQ-077.6 | Menú del dueño por grupos | T-150 (hecha), T-152 (hecha), T-154 (pendiente) | today.spec.ts, today.test.tsx | prueba escrita |
| REQ-078.1 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | design-tokens.test.ts, lint-design.test.ts | prueba escrita |
| REQ-078.2 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | design-tokens.test.ts | prueba escrita |
| REQ-078.3 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | appointments-agenda.spec.ts, helpers.ts, ui-components.spec.ts, visual-cliente.spec.ts, visual-dueno-config.spec.ts, visual-dueno-fila-caja.spec.ts, visual-dueno-modulos.spec.ts, lint-design.test.ts, ui-components.test.tsx | prueba escrita |
| REQ-078.4 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-acceso.spec.ts, visual-barbero.spec.ts, visual-cliente.spec.ts, visual-dueno-config.spec.ts, visual-dueno-fila-caja.spec.ts, visual-dueno-modulos.spec.ts, visual-helpers.ts | prueba escrita |
| REQ-078.5 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | menu-courtesy.spec.ts, visual-barbero.spec.ts, visual-helpers.ts, barber-nav.test.tsx, ui-components.test.tsx | prueba escrita |
| REQ-078.6 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-dueno-config.spec.ts, visual-dueno-fila-caja.spec.ts, visual-dueno-modulos.spec.ts, phone.test.ts | prueba escrita |
| REQ-078.7 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | ui-components.spec.ts, visual-acceso.spec.ts, ui-components.test.tsx | prueba escrita |
| REQ-078.8 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-barbero.spec.ts, visual-cliente.spec.ts, visual-helpers.ts, public-home.test.tsx, queue-subscription.test.ts | prueba escrita |
| REQ-078.9 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | ui-components.spec.ts, visual-acceso.spec.ts, public-home.test.tsx, ui-components.test.tsx | prueba escrita |
| REQ-078.10 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-barbero.spec.ts, visual-cliente.spec.ts, public-home.test.tsx, ui-components.test.tsx | prueba escrita |
| REQ-078.11 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-dueno-config.spec.ts, visual-dueno-modulos.spec.ts, ui-components.test.tsx | prueba escrita |
| REQ-078.12 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-barbero.spec.ts, visual-dueno-fila-caja.spec.ts, ui-components.test.tsx | prueba escrita |
| REQ-078.13 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | ui-components.spec.ts, visual-cliente.spec.ts, ui-components.test.tsx | prueba escrita |
| REQ-078.14 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | lint-design.test.ts, public-view.test.ts | prueba escrita |
| REQ-078.15 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-acceso.spec.ts, visual-barbero.spec.ts, visual-cliente.spec.ts, visual-dueno-config.spec.ts, visual-dueno-fila-caja.spec.ts, visual-dueno-modulos.spec.ts, visual-helpers.ts, public-view.test.ts | prueba escrita |
| REQ-078.16 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | barbero-tablero.spec.ts, barber-nav.test.tsx, traceability.test.ts | prueba escrita |
| REQ-078.17 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | barbero-tablero.spec.ts, queue-actions.test.ts, 0069_call_expected.sql | prueba escrita |
| REQ-078.18 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | barbero-tablero.spec.ts | prueba escrita |
| REQ-078.19 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.20 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-dueno-config.spec.ts, hours-form.test.tsx, hours.test.ts | prueba escrita |
| REQ-078.21 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | public-home.test.tsx | prueba escrita |
| REQ-078.22 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.23 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.24 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.25 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.26 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | deploy-css.test.ts | prueba escrita |
| REQ-078.27 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | admin-nav.spec.ts, auth.spec.ts, visual-dueno-ancho.spec.ts, admin-nav.test.tsx, time.test.ts | prueba escrita |
| REQ-078.28 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.29 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.30 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.31 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.32 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | — | sin prueba |
| REQ-078.33 | Sistema visual nuevo | T-160 (hecha), T-161 (hecha), T-162 (hecha), T-163 (hecha), T-164 (hecha), T-165 (hecha), T-166 (hecha), T-167 (hecha), T-169 (hecha), T-170 (pendiente), T-171 (pendiente), T-177 (hecha), T-178 (pendiente), T-179 (pendiente), T-180 (pendiente), T-181 (hecha), T-172 (hecha), T-173 (hecha), T-174 (pendiente), T-175 (pendiente), T-176 (pendiente), T-168 (pendiente) | visual-dueno-config.spec.ts, hours-form.test.tsx, hours.test.ts, inventory-catalog.test.ts | prueba escrita |
