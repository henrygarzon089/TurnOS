/**
 * Pantalla del televisor (REQ-013, REQ-078.25, design §22.7). Lógica pura: forma de los datos de
 * `get_screen_queue`, el llamado de los últimos 30 s, el estado de cada barbero y la etiqueta de
 * cada siguiente. Nunca hay celulares: la función SQL solo devuelve nombres cortos.
 */
import { formatTimeBogota } from "@/lib/domain/time";

export type ScreenNext = { name: string; number: number | null; scheduledAt: string | null };

export type ScreenView = {
  id: string;
  name: string;
  slug: string;
  isOpen: boolean;
  waitingCount: number;
  barbers: {
    id: string;
    name: string;
    status: "available" | "busy" | "paused" | "off";
    current: {
      name: string;
      number: number | null;
      status: "called" | "in_service";
      calledAt: string | null;
    } | null;
    next: ScreenNext[];
  }[];
  anyone: { name: string; number: number | null }[];
};

/** REQ-013.4: la franja del llamado dura 30 s. */
export const CALL_BANNER_MS = 30_000;

/** Máximo de columnas de barberos en el televisor (tablero Cliente-Pantalla). */
export const MAX_LANES = 5;

type RawNext = string | { name: string; number?: number | null; scheduledAt?: string | null };
type RawView = Omit<ScreenView, "barbers" | "anyone"> & {
  barbers: (Omit<ScreenView["barbers"][number], "current" | "next"> & {
    current:
      | (Omit<NonNullable<ScreenView["barbers"][number]["current"]>, "number"> & {
          number?: number | null;
        })
      | null;
    next: RawNext[];
  })[];
  anyone: RawNext[];
};

/**
 * Antes de la 0071, `next` y `anyone` eran solo nombres y el actual no traía número. Mientras la
 * migración no esté en producción, la pantalla se pinta igual (sin números).
 */
export function normalizeScreenView(raw: RawView): ScreenView {
  const item = (n: RawNext): ScreenNext =>
    typeof n === "string"
      ? { name: n, number: null, scheduledAt: null }
      : { name: n.name, number: n.number ?? null, scheduledAt: n.scheduledAt ?? null };
  return {
    ...raw,
    barbers: raw.barbers.map((b) => ({
      ...b,
      current: b.current ? { ...b.current, number: b.current.number ?? null } : null,
      next: b.next.map(item),
    })),
    anyone: raw.anyone.map((n) => {
      const { name, number } = item(n);
      return { name, number };
    }),
  };
}

export type ActiveCall = { number: number | null; name: string; barber: string };

/** REQ-013.4: el turno llamado más reciente de los últimos 30 s, o null. */
export function activeCall(view: ScreenView, now: number): ActiveCall | null {
  let best: (ActiveCall & { at: number }) | null = null;
  for (const b of view.barbers) {
    const c = b.current;
    if (c?.status !== "called" || !c.calledAt) continue;
    const at = new Date(c.calledAt).getTime();
    if (now - at >= CALL_BANNER_MS || (best && at <= best.at)) continue;
    best = { number: c.number, name: c.name, barber: b.name, at };
  }
  if (!best) return null;
  const { at: _at, ...call } = best;
  void _at;
  return call;
}

export type BarberScreenState = "Atendiendo" | "Llamando" | "En pausa" | "Libre";

/** REQ-078.25: estado de la columna del barbero. */
export function barberScreenState(b: ScreenView["barbers"][number]): BarberScreenState {
  if (b.status === "paused") return "En pausa";
  if (b.current?.status === "called") return "Llamando";
  if (b.current || b.status === "busy") return "Atendiendo";
  return "Libre";
}

/** REQ-078.25: a la derecha de cada siguiente, su número o "Cita <hora>" (sin "a. m."/"p. m."). */
export function nextLabel(n: ScreenNext): string {
  if (n.scheduledAt) {
    return `Cita ${formatTimeBogota(new Date(n.scheduledAt)).replace(/ [ap]\. m\.$/, "")}`;
  }
  return n.number == null ? "" : String(n.number);
}
