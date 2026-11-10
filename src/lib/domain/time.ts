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

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-10-20" → "20 oct 2026" (día del negocio; armado a mano, sin depender de ICU). */
export function formatDayCO(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

const WEEKDAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/** "2026-11-06" → "2026-10-30": el mismo día de la semana pasada (calendario, sin horas). */
export function sameDayLastWeek(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

/** "2026-11-06" → "jueves". */
export function weekdayName(day: string): string {
  return WEEKDAYS[new Date(`${day}T00:00:00Z`).getUTCDay()];
}

const MONTHS_LONG = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

/** REQ-078.27 "2026-11-06" → "Jueves 6 de noviembre" (barra del dueño, sin depender de ICU). */
export function formatLongDayCO(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  const wd = weekdayName(day);
  return `${wd[0].toUpperCase()}${wd.slice(1)} ${d} de ${MONTHS_LONG[m - 1]}`;
}

/** REQ-076.4 (PA-H15-1), como el tablero Dueno-Hoy: "El jueves pasado, todo el día". */
export function lastWeekLabel(day: string): string {
  return `El ${weekdayName(day)} pasado, todo el día`;
}

/**
 * REQ-078.16 "hoy", "ayer", "hace 4 días", "hace 3 semanas", "hace 4 meses" (lista de clientes del
 * barbero). Cuenta días del negocio en Bogotá, no horas.
 */
export function agoCO(iso: string, now: Date = new Date()): string {
  const day = (d: Date) => Date.parse(`${businessDayBogota(d)}T00:00:00Z`);
  const days = Math.round((day(now) - day(new Date(iso))) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  if (days < 30) {
    const w = Math.floor(days / 7);
    return w === 1 ? "hace 1 semana" : `hace ${w} semanas`;
  }
  if (days < 365) {
    const m = Math.floor(days / 30);
    return m === 1 ? "hace 1 mes" : `hace ${m} meses`;
  }
  return "hace más de un año";
}
