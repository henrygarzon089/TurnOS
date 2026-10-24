/**
 * Historial de la ficha del cliente (REQ-018.2, REQ-018.4) y ayudas de fusión (REQ-018.5).
 * Reglas: design.md §2.6, decisions.md ADR-016.
 */

export type TicketStatus = "waiting" | "called" | "in_service" | "done" | "cancelled" | "no_show";

export type HistoryTicket = {
  id: string;
  /** Día del negocio (YYYY-MM-DD, America/Bogota). */
  businessDay: string;
  serviceName: string;
  barberId: string | null;
  barberName: string | null;
  status: TicketStatus;
  /** Precio congelado en el turno (COP). Hasta T-043 es el "valor" del historial. */
  servicePrice: number;
};

export type HistoryViewer = { role: "owner" | "barber"; barberId: string | null };

export type HistoryRow = {
  id: string;
  date: string;
  serviceName: string;
  barberName: string | null;
  statusLabel: string;
  /** null = sin valor (no terminado) u oculto para este barbero (PA-10). */
  amount: number | null;
  /** Medio de pago: llega con la caja (Hito 3). */
  paymentMethod: string | null;
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  waiting: "En la fila",
  called: "En la fila",
  in_service: "En la fila",
  done: "Terminado",
  no_show: "No llegó",
  cancelled: "Cancelado",
};

export function toHistoryRows(tickets: HistoryTicket[], viewer: HistoryViewer): HistoryRow[] {
  return [...tickets]
    .sort((a, b) => (a.businessDay < b.businessDay ? 1 : a.businessDay > b.businessDay ? -1 : 0))
    .map((t) => {
      const visible =
        viewer.role === "owner" || (t.barberId !== null && t.barberId === viewer.barberId);
      return {
        id: t.id,
        date: t.businessDay,
        serviceName: t.serviceName,
        barberName: t.barberName,
        statusLabel: STATUS_LABEL[t.status],
        amount: t.status === "done" && visible ? t.servicePrice : null,
        paymentMethod: null,
      };
    });
}

type MergeCandidate = { id: string; lastVisitAt: string | null; createdAt: string };

/** Ficha que conserva el celular por defecto: la de visita más reciente, o la más nueva. */
export function defaultKeepId(a: MergeCandidate, b: MergeCandidate): string {
  if (a.lastVisitAt && b.lastVisitAt) return a.lastVisitAt >= b.lastVisitAt ? a.id : b.id;
  if (a.lastVisitAt) return a.id;
  if (b.lastVisitAt) return b.id;
  return a.createdAt >= b.createdAt ? a.id : b.id;
}

/** "···1234": la lista nunca muestra el celular completo. */
export function phoneLast4(phone: string | null): string {
  return phone ? `···${phone.slice(-4)}` : "";
}
