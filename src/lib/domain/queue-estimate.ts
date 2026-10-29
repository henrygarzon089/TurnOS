/**
 * Posición y tiempo estimado de espera (design.md §4, ADR-013).
 * Función pura: la usan el servidor (server actions) y las pruebas.
 */
import { ceil5 } from "./time";

export type BarberStatus = "available" | "busy" | "paused" | "off";

export type BarberState = {
  id: string;
  status: BarberStatus;
  /** Cuándo queda libre si está ocupado (started_at + duración; o called_at + duración). */
  busyUntil?: Date | string | null;
};

export type WaitingTicket = {
  id: string;
  queueOrder: number;
  durationMin: number;
  preferredBarberId: string | null;
  /** REQ-035: barberos que hacen su servicio. Sin dato = todos (negocio sin restricciones). */
  capableBarberIds?: string[] | null;
};

export type Estimate = {
  id: string;
  /** 1 = el siguiente. */
  position: number;
  ahead: number;
  /** Minutos de espera redondeados hacia arriba a 5; null si ningún barbero puede atenderlo. */
  waitMin: number | null;
  /** Barbero que lo atendería según la simulación (null si no hay). */
  barberId: string | null;
  /** Motivo cuando waitMin es null. */
  reason?: "no_barbers" | "preferred_unavailable" | "no_capable";
};

export type QueueInput = {
  now: Date;
  barbers: BarberState[];
  waiting: WaitingTicket[];
};

const toTime = (d: Date | string | null | undefined, fallback: number) =>
  d ? new Date(d).getTime() : fallback;

/** Barberos activos: disponibles u ocupados (no en pausa ni ausentes). */
export function activeBarbers(barbers: BarberState[]): BarberState[] {
  return barbers.filter((b) => b.status === "available" || b.status === "busy");
}

/** puede(W) de design.md §4: el preferido, o quienes hacen el servicio; null = cualquiera. */
function canServe(t: WaitingTicket): Set<string> | null {
  if (t.preferredBarberId !== null) return new Set([t.preferredBarberId]);
  return t.capableBarberIds ? new Set(t.capableBarberIds) : null;
}

function overlaps(a: Set<string> | null, b: Set<string> | null): boolean {
  if (a === null) return b === null || b.size > 0;
  if (b === null) return a.size > 0;
  for (const x of a) if (b.has(x)) return true;
  return false;
}

/**
 * Posición de cada turno (REQ-004.1, REQ-035.10): 1 + turnos delante que podrían ocupar a alguno
 * de los barberos que pueden atenderlo (puede(W) ∩ puede(T) ≠ ∅). Sin restricciones de servicio
 * equivale a: con preferido b, los de b y los de "cualquiera"; sin preferido, todos.
 */
export function positions(waiting: WaitingTicket[]): Map<string, number> {
  const sorted = [...waiting].sort((a, b) => a.queueOrder - b.queueOrder);
  const result = new Map<string, number>();
  sorted.forEach((t, i) => {
    const mine = canServe(t);
    const ahead = sorted.slice(0, i).filter((w) => overlaps(canServe(w), mine));
    result.set(t.id, ahead.length + 1);
  });
  return result;
}

/** Simulación de asignación (design.md §4). Devuelve un estimado por turno en espera. */
export function estimateQueue(input: QueueInput): Estimate[] {
  const now = input.now.getTime();
  const active = activeBarbers(input.barbers);
  const freeAt = new Map<string, number>();
  for (const b of active) {
    freeAt.set(b.id, b.status === "available" ? now : Math.max(now, toTime(b.busyUntil, now)));
  }
  const pos = positions(input.waiting);
  const sorted = [...input.waiting].sort((a, b) => a.queueOrder - b.queueOrder);
  const out: Estimate[] = [];

  for (const t of sorted) {
    const position = pos.get(t.id)!; // positions() incluye todos los turnos en espera
    const base = { id: t.id, position, ahead: position - 1 };
    if (active.length === 0) {
      out.push({ ...base, waitMin: null, barberId: null, reason: "no_barbers" });
      continue;
    }
    const can = canServe(t);
    const candidates = can === null ? active : active.filter((b) => can.has(b.id));
    if (candidates.length === 0) {
      out.push({
        ...base,
        waitMin: null,
        barberId: null,
        // REQ-035.10: nadie de los que hacen el servicio está atendiendo
        reason: t.preferredBarberId === null ? "no_capable" : "preferred_unavailable",
      });
      continue;
    }
    // argmin freeAt; empate → menor id (determinista)
    let best = candidates[0];
    for (const c of candidates) {
      const fc = freeAt.get(c.id)!;
      const fb = freeAt.get(best.id)!;
      if (fc < fb || (fc === fb && c.id < best.id)) best = c;
    }
    const startAt = freeAt.get(best.id)!;
    freeAt.set(best.id, startAt + t.durationMin * 60_000);
    out.push({ ...base, waitMin: ceil5((startAt - now) / 60_000), barberId: best.id });
  }
  return out;
}

/** Estimado para alguien que tomaría turno ahora con un servicio dado (REQ-017.3, portada). */
export function estimateNewTicket(
  input: QueueInput,
  durationMin: number,
  preferredBarberId: string | null,
  capableBarberIds?: string[] | null,
): Estimate {
  const maxOrder = input.waiting.reduce((m, t) => Math.max(m, t.queueOrder), 0);
  const ghost: WaitingTicket = {
    id: "__new__",
    queueOrder: maxOrder + 1000,
    durationMin,
    preferredBarberId,
    capableBarberIds,
  };
  const all = estimateQueue({ ...input, waiting: [...input.waiting, ghost] });
  return all.find((e) => e.id === "__new__")!;
}

/** REQ-035: filas de barber_services → barberos que hacen cada servicio. */
export function capableByService(
  rows: { barber_id: string; service_id: string }[],
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.service_id, [...(m.get(r.service_id) ?? []), r.barber_id]);
  return m;
}

/** ¿Hay que avisar? Exactamente 2 delante (REQ-009.1). */
export function shouldNotify(estimate: Estimate): boolean {
  return estimate.ahead === 2;
}
