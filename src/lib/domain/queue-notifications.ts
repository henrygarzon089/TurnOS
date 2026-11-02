/**
 * Qué avisos automáticos tocan ahora (design.md §12.4, REQ-040). Función pura: no consulta permiso,
 * activación ni tope, eso lo revisa `claim_notification` al reclamar cada aviso.
 */
import type { Estimate } from "./queue-estimate";

export type NotificationKind = "two_left" | "called";

export type TicketContact = { id: string; phoneE164: string | null };

export type RecordedNotification = { ticketId: string; kind: NotificationKind };

export type PickInput = {
  /** Resultado de `estimateQueue`. */
  estimates: Estimate[];
  /** Celular de los turnos en espera. */
  waiting: TicketContact[];
  /** Turnos en estado `called`. */
  called: TicketContact[];
  /** Filas de `ticket_notifications` en cualquier estado: `skipped` y `failed` también cuentan. */
  recorded: RecordedNotification[];
};

export type PickedNotification =
  | { kind: "two_left"; ticketId: string; phoneE164: string; waitMin: number }
  | { kind: "called"; ticketId: string; phoneE164: string };

/** Sin motivo de bloqueo y con tiempo: cubre pausa y "Esperando a que haya quién…" (REQ-040.4). */
function isReadyForTwoLeft(e: Estimate): e is Estimate & { waitMin: number } {
  return e.ahead <= 2 && e.waitMin !== null && !e.reason;
}

/**
 * Avisos por enviar, primero los llamados. Decide con `ahead <= 2` y no con `=== 2`: un turno puede
 * saltar de 4 a 1 (REQ-040.1), y el registro evita repetir si sube y vuelve a bajar (REQ-040.3).
 */
export function pickNotifications(input: PickInput): PickedNotification[] {
  const seen = new Set(input.recorded.map((r) => `${r.ticketId}:${r.kind}`));
  const phones = new Map(input.waiting.map((t) => [t.id, t.phoneE164]));
  const picked: PickedNotification[] = [];

  for (const { id, phoneE164 } of input.called) {
    if (phoneE164 && !seen.has(`${id}:called`)) {
      picked.push({ kind: "called", ticketId: id, phoneE164 });
    }
  }

  for (const e of input.estimates) {
    const phoneE164 = phones.get(e.id);
    if (phoneE164 && isReadyForTwoLeft(e) && !seen.has(`${e.id}:two_left`)) {
      picked.push({ kind: "two_left", ticketId: e.id, phoneE164, waitMin: e.waitMin });
    }
  }
  return picked;
}
