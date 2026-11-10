/**
 * Textos de "Mi turno" (T-174, tablero Cliente-MiTurno, design §22.7). Funciones puras: entra lo
 * que trae `getTicketByToken`, sale el texto listo.
 */
import type { Estimate } from "./queue-estimate";
import type { LoyaltyStatus } from "./loyalty";
import { formatTimeBogota } from "./time";
import type { TicketStatus } from "@/lib/queue/public-queue";

/** REQ-004.1 (ADR-052): "Vas de" + "3.º". */
export function positionText(position: number): string {
  return `${position}.º`;
}

/** Debajo de la posición: "2 antes de ti"; el 1.º es "Eres el siguiente". */
export function aheadText(ahead: number): string {
  return ahead <= 0 ? "Eres el siguiente" : `${ahead} antes de ti`;
}

/** "40 min", "1 h 10 min", "2 h". */
function minutes(n: number): string {
  if (n < 60) return `${n} min`;
  const h = Math.floor(n / 60);
  const m = n % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const NO_ESTIMATE: Record<NonNullable<Estimate["reason"]>, string> = {
  preferred_unavailable: "Tu barbero está en pausa",
  no_capable: "Esperando a que haya quién te atienda",
  no_barbers: "Sin barberos atendiendo ahora",
};

/**
 * Celda "Te toca en": "~ 25 min" y "cerca de <hora>" (ahora + espera). Sin espera, "Ya". Sin
 * estimado, el motivo de hoy en la celda.
 */
export function etaText(
  e: Pick<Estimate, "waitMin" | "reason">,
  now: Date,
): { main: string; sub: string | null } {
  if (e.waitMin === null) return { main: NO_ESTIMATE[e.reason ?? "no_barbers"], sub: null };
  if (e.waitMin <= 0) return { main: "Ya", sub: null };
  const at = new Date(now.getTime() + e.waitMin * 60_000);
  return { main: `~ ${minutes(e.waitMin)}`, sub: `cerca de ${formatTimeBogota(at)}` };
}

/** Círculo del barbero: "Andrés" → "AN", "Juan Pablo" → "JP". */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

/** Barra de 4 pasos (En espera, Tu turno, En servicio, Listo); null fuera de la fila. */
export function ticketStep(status: TicketStatus): 0 | 1 | 2 | 3 | null {
  switch (status) {
    case "waiting":
      return 0;
    case "called":
      return 1;
    case "in_service":
      return 2;
    case "done":
      return 3;
    default:
      return null;
  }
}

/** Tarjeta "Tus cortes": cuánto falta para el premio. */
export function loyaltyLeftText(l: LoyaltyStatus): string {
  const discount = l.rewardType === "discount";
  if (l.available || l.stamps >= l.required)
    return discount ? "Tu próximo corte tiene descuento." : "Tu próximo corte es gratis.";
  const left = l.required - l.stamps;
  const what = left === 1 ? "1 corte" : `${left} cortes`;
  return `Te falta${left === 1 ? "" : "n"} ${what} para el ${discount ? "descuento" : "gratis"}.`;
}

/** Título de la pestaña al llamarlo (REQ-004.3). */
export function calledTitle(displayNumber: number): string {
  return `¡Es tu turno! · ${displayNumber}`;
}
