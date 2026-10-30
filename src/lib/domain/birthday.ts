/**
 * Cumpleaños del cliente (REQ-037): día y mes, sin año. Lógica pura compartida por el formulario
 * de turno y la ficha; la base lo vuelve a validar con `customers_birthday_valid`.
 */

export type Birthday = { day: number; month: number };

export const BIRTHDAY_INVALID = "Esa fecha no existe";

export type BirthdayParse = { ok: true; birthday: Birthday | null } | { ok: false; error: string };

export const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

/** Año bisiesto: el 29 de febrero es válido (REQ-037.3). */
function daysInMonth(month: number): number {
  return new Date(Date.UTC(2000, month, 0)).getUTCDate();
}

/** REQ-037.1 / REQ-037.3: lo que llega del formulario. Vacío = sin cumpleaños (es opcional). */
export function parseBirthday(day?: string | null, month?: string | null): BirthdayParse {
  const d = day?.trim() ?? "";
  const m = month?.trim() ?? "";
  if (!d && !m) return { ok: true, birthday: null };
  if (!d || !m) return { ok: false, error: "Escribe el día y el mes." };
  if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m)) return { ok: false, error: BIRTHDAY_INVALID };
  const birthday = { day: Number(d), month: Number(m) };
  const possible =
    birthday.month >= 1 &&
    birthday.month <= 12 &&
    birthday.day >= 1 &&
    birthday.day <= daysInMonth(birthday.month);
  return possible ? { ok: true, birthday } : { ok: false, error: BIRTHDAY_INVALID };
}

/** REQ-037.4: "Hoy", "Mañana" o "Domingo 1 de noviembre" (fechas `YYYY-MM-DD` de Bogotá). */
export function celebrationLabel(celebratesOn: string, today: string): string {
  const on = new Date(`${celebratesOn}T00:00:00Z`);
  const days = (on.getTime() - new Date(`${today}T00:00:00Z`).getTime()) / 86_400_000;
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  const month = MONTH_NAMES[on.getUTCMonth()].toLowerCase();
  return `${WEEKDAYS[on.getUTCDay()]} ${on.getUTCDate()} de ${month}`;
}
