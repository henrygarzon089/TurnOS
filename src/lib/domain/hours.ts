import { formatHour } from "@/lib/domain/cleaning";

/** Minutos entre opciones del selector de horas del horario (design §22.8). */
export const HOUR_STEP_MIN = 15;

/** Última hora del día: el local que abre hasta la medianoche cierra a las 11:59 p. m. */
const END_OF_DAY = "23:59";

export type HourOption = { value: string; label: string };

/**
 * Opciones del selector "Abre" / "Cierra" (REQ-078.33): cada 15 minutos en español ("9:00 a. m.")
 * y "11:59 p. m." al final. Las horas guardadas que no caen en un cuarto de hora (`extra`, "HH:MM"
 * o "HH:MM:SS" como las devuelve la base) se agregan en su lugar para no perderlas al guardar.
 */
export function hourOptions(extra: string[] = []): HourOption[] {
  const values = new Set<string>();
  for (let m = 0; m < 24 * 60; m += HOUR_STEP_MIN) {
    values.add(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  values.add(END_OF_DAY);
  for (const e of extra) if (/^\d{2}:\d{2}/.test(e)) values.add(e.slice(0, 5));
  return [...values].sort().map((value) => ({ value, label: formatHour(value) }));
}
