/**
 * Lo que pintan las pantallas del cliente (T-162, tablero Cliente-Negocio). Funciones puras: entra
 * lo que ya trae `getPublicBusiness`, sale texto listo. Nunca deja pasar celulares (REQ-013.2).
 */
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { estimateNewTicket } from "./queue-estimate";

/** Palabras del tipo de negocio que no sirven para la marca ("Barbería Filo" → "FI"). */
const GENERIC = /^(barber[ií]a|peluquer[ií]a|sal[oó]n|est[eé]tica|spa|barber|studio|estudio)$/i;

/**
 * Marca del cuadro del encabezado (REQ-078.14: sin logo descargado). El número del nombre si lo
 * tiene ("La 33" → "33", hasta 3 cifras); si no, las iniciales de las dos primeras palabras que no
 * son el tipo de negocio, o las dos primeras letras si queda una sola.
 */
export function businessMark(name: string): string {
  const digits = name.match(/\d+/);
  if (digits) return digits[0].slice(0, 3);
  const words = name.trim().split(/\s+/).filter(Boolean);
  const own = words.filter((w) => !GENERIC.test(w));
  const use = own.length > 0 ? own : words;
  if (use.length === 0) return "T";
  if (use.length === 1) return use[0].slice(0, 2).toUpperCase();
  return (use[0][0] + use[1][0]).toUpperCase();
}

/** "20:00" → "8:00 p. m." (mismo formato de `formatTimeBogota`). */
export function hhmmTo12h(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h < 12 ? "a. m." : "p. m.";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

export type PublicBarberLine = {
  id: string;
  name: string;
  state: "busy" | "free" | "paused";
  /** Turnos que lo pidieron a él y esperan. */
  waiting: number;
  /** Espera para quien lo pida ahora con el primer servicio; null en pausa o sin estimado. */
  waitMin: number | null;
};

/**
 * Bloque "en vivo" de la portada: una línea por barbero presente hoy, en el orden del negocio.
 * La espera usa el mismo cálculo del estimado de la portada (REQ-017.3) pidiendo a ese barbero.
 */
export function publicBarberLines(
  b: Pick<PublicBusiness, "services" | "barbersToday" | "queue">,
  now: Date,
): PublicBarberLine[] {
  const duration = b.services[0]?.durationMin ?? 30;
  return b.barbersToday.map((x) => {
    const waiting = b.queue.waiting.filter((t) => t.preferredBarberId === x.id).length;
    if (x.status === "paused" || x.status === "off")
      return { id: x.id, name: x.name, state: "paused" as const, waiting, waitMin: null };
    const est = estimateNewTicket({ now, ...b.queue }, duration, x.id);
    // "Libre" solo si quien llegue ahora pasa de una: con gente esperando a cualquiera, no lo está
    const free = x.status === "available" && est.waitMin === 0;
    return {
      id: x.id,
      name: x.name,
      state: free ? ("free" as const) : ("busy" as const),
      waiting,
      waitMin: est.waitMin,
    };
  });
}
