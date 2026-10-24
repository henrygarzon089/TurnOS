/**
 * Tiempo en TurnOS: todo "hoy", cierre y semana se calcula en America/Bogota (P5).
 * Colombia no tiene horario de verano: UTC-5 fijo.
 */

export const TIMEZONE = "America/Bogota";

/** Redondea hacia arriba al múltiplo de 5 (REQ-004.5). Nunca negativo. */
export function ceil5(minutes: number): number {
  if (minutes <= 0) return 0;
  return Math.ceil(minutes / 5) * 5;
}

/** Minutos completos entre dos instantes (hacia abajo). */
export function minutesBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / 60_000);
}

/** `0` → "Eres el siguiente", `25` → "≈ 25 min", `95` → "≈ 1 h 35 min". */
export function formatMinutes(minutes: number): string {
  if (minutes <= 0) return "Eres el siguiente";
  if (minutes < 60) return `≈ ${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `≈ ${h} h` : `≈ ${h} h ${m} min`;
}

const dayParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Fecha `YYYY-MM-DD` del día de negocio en Bogotá (REQ-027.5). */
export function businessDayBogota(at: Date = new Date()): string {
  return dayParts.format(at); // en-CA produce YYYY-MM-DD
}

/** Lunes (`YYYY-MM-DD`) de la semana de Bogotá que contiene `at` (PA-21). */
export function bogotaWeekStart(at: Date = new Date()): string {
  const day = businessDayBogota(at);
  // Construimos la fecha como UTC medianoche para operar solo con el calendario.
  const d = new Date(`${day}T00:00:00Z`);
  const weekday = d.getUTCDay(); // 0 = domingo
  const diffToMonday = (weekday + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diffToMonday);
  return d.toISOString().slice(0, 10);
}

const timeParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TIMEZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
});

/**
 * "9:05 a. m." / "8:00 p. m." — se arma a mano para que no dependa de la versión de ICU
 * (que cambia los espacios entre "a." y "m.").
 */
export function formatTimeBogota(at: Date): string {
  const parts = Object.fromEntries(
    timeParts.formatToParts(at).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  const h24 = Number(parts.hour) % 24;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = h24 < 12 ? "a. m." : "p. m.";
  return `${h12}:${parts.minute} ${suffix}`;
}
