/**
 * "Hoy" del dueño: resumen de la fila en vivo (REQ-076.2, design §21.2). Función pura: entra lo
 * que devuelven las server actions, sale lo que se pinta. Nunca deja pasar celulares.
 */
import { formatCOP } from "./money";
import { minutesBetween } from "./time";

export type TodayQueueInput = {
  waitingCount: number;
  /** Estimado de la portada para quien toma turno ahora (null si nadie puede atender). */
  estimatedWaitMin: number | null;
  barbers: {
    id: string;
    name: string;
    status: "available" | "busy" | "paused" | "off";
    isActive: boolean;
  }[];
  active: {
    status: "waiting" | "called" | "in_service" | "done" | "cancelled" | "no_show";
    assignedBarberId: string | null;
    customerName: string;
    customerPhone?: string | null;
    displayNumber: number;
    calledAt: string | null;
    startedAt: string | null;
  }[];
};

export type TodayBarberState = "serving" | "called" | "paused" | "free" | "off";

export type TodayQueue = {
  waiting: number;
  nextWaitMin: number | null;
  barbers: { id: string; name: string; state: TodayBarberState; text: string }[];
};

/** "ana maría gómez" → "Ana M." (mismo resultado que `short_name` en SQL, 0011). */
export function shortName(name: string): string {
  const cap = (w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return cap(parts[0]);
  return `${cap(parts[0])} ${parts[1].charAt(0).toUpperCase()}.`;
}

export function buildTodayQueue(input: TodayQueueInput, now: Date): TodayQueue {
  const ago = (at: string | null) => Math.max(0, minutesBetween(new Date(at ?? now), now));
  const barbers = input.barbers
    .filter((b) => b.isActive)
    .map((b) => {
      const mine = input.active.filter((t) => t.assignedBarberId === b.id);
      const serving = mine.find((t) => t.status === "in_service");
      const called = mine.find((t) => t.status === "called");
      let state: TodayBarberState;
      let text: string;
      if (b.status === "off") {
        state = "off";
        text = "No vino hoy";
      } else if (serving) {
        state = "serving";
        text = `Atendiendo a ${shortName(serving.customerName)} desde hace ${ago(serving.startedAt)} min`;
      } else if (called) {
        state = "called";
        text = `Llamó a ${shortName(called.customerName)} hace ${ago(called.calledAt)} min`;
      } else if (b.status === "paused") {
        state = "paused";
        text = "En pausa";
      } else {
        state = "free";
        text = "Libre";
      }
      return { id: b.id, name: b.name, state, text };
    });
  return { waiting: input.waitingCount, nextWaitMin: input.estimatedWaitMin, barbers };
}

const WEEK_LABELS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];

export type WeekBar = {
  day: string;
  /** "lun"…"dom"; el día de hoy dice "hoy". */
  label: string;
  /** Total de la Caja de ese día; null si el día no ha llegado. */
  total: number | null;
  isToday: boolean;
};

/**
 * REQ-076.9 ingresos de la semana por día (ADR-048): una barra de lunes a domingo con el total de la
 * Caja de cada día. `sum` es el "Vendido" de Semana hasta hoy; `max` da la escala de las barras.
 */
export function buildWeekBars(
  totals: Record<string, number>,
  weekStart: string,
  today: string,
): { bars: WeekBar[]; sum: number; max: number } {
  const start = new Date(`${weekStart}T00:00:00Z`);
  const bars = WEEK_LABELS.map((label, i) => {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    const day = d.toISOString().slice(0, 10);
    const isToday = day === today;
    return {
      day,
      label: isToday ? "hoy" : label,
      total: day > today ? null : (totals[day] ?? 0),
      isToday,
    };
  });
  const amounts = bars.map((b) => b.total ?? 0);
  return {
    bars,
    sum: amounts.reduce((a, b) => a + b, 0),
    max: Math.max(0, ...amounts),
  };
}

/**
 * Cifra corta para encima de una barra: 610000 → { value: "610", mil: true } ("610 mil" cuando cabe,
 * "610" con la nota "Cifras en miles" cuando la tarjeta es angosta); menos de mil va completa.
 */
export function barAmount(amount: number): { value: string; mil: boolean } {
  if (Math.abs(amount) < 1000) return { value: formatCOP(amount), mil: false };
  return { value: formatCOP(Math.round(amount / 1000)).replace("$ ", ""), mil: true };
}
