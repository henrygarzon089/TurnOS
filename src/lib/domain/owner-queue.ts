import { minutesBetween } from "./time";
import { shortName } from "./today";

/**
 * REQ-078.30 carriles de la fila del dueño (tablero Dueno-Fila, design §22.8): uno por barbero
 * presente (o con turnos) y "El primero libre" al final, y el bloque fijo de 40 px bajo el
 * encabezado de cada carril.
 */
export const FREE_LANE = "free";

type BarberStatus = "available" | "busy" | "paused" | "off";
export type LaneBarber = { id: string; name: string; status: BarberStatus; isActive: boolean };
export type LaneTicket = {
  id: string;
  displayNumber: number;
  customerName: string;
  status: string;
  preferredBarberId: string | null;
  assignedBarberId: string | null;
  calledAt: string | null;
  startedAt: string | null;
};

export type Lane = { id: string; title: string; barber: LaneBarber | null };

export const laneOf = (t: LaneTicket) => t.assignedBarberId ?? t.preferredBarberId ?? FREE_LANE;

export function buildLanes(barbers: LaneBarber[], active: LaneTicket[]): Lane[] {
  return [
    ...barbers
      .filter((b) => b.isActive && (b.status !== "off" || active.some((t) => laneOf(t) === b.id)))
      .map((b) => ({ id: b.id, title: b.name, barber: b })),
    { id: FREE_LANE, title: "El primero libre", barber: null },
  ];
}

export type LaneNowTone = "serving" | "called" | "paused" | "free" | "off";
export type LaneNow = { tone: LaneNowTone; text: string };

/**
 * Lo que pasa ahora en el carril: "Atiende 11 · Ana M. · 22 min", "Llamó a 14 · Juan P. · 1 min",
 * o el estado del barbero. "El primero libre" dice quiénes están libres para tomar su turno.
 */
export function laneNow(
  barber: LaneBarber | null,
  tickets: LaneTicket[],
  now: Date,
  all: LaneBarber[] = [],
): LaneNow[] {
  const ago = (at: string | null) => Math.max(0, minutesBetween(new Date(at ?? now), now));
  const who = (t: LaneTicket) => `${t.displayNumber} · ${shortName(t.customerName)}`;
  const lines: LaneNow[] = [];
  for (const t of tickets) {
    if (t.status === "in_service")
      lines.push({ tone: "serving", text: `Atiende ${who(t)} · ${ago(t.startedAt)} min` });
    if (t.status === "called")
      lines.push({ tone: "called", text: `Llamó a ${who(t)} · ${ago(t.calledAt)} min` });
  }
  if (lines.length > 0) return lines;
  if (!barber) {
    const free = all.filter((b) => b.isActive && b.status === "available").map((b) => b.name);
    return free.length > 0
      ? [{ tone: "free", text: `Libre ahora: ${free.join(", ")}` }]
      : [{ tone: "off", text: "Nadie libre ahora" }];
  }
  if (barber.status === "paused") return [{ tone: "paused", text: "En pausa" }];
  if (barber.status === "off") return [{ tone: "off", text: "No está" }];
  return [{ tone: "free", text: "Libre" }];
}
