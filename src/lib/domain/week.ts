/** Resumen semanal (REQ-028): navegación de semanas y comparación con la anterior. */

/** REQ-028.3: "+20 %", "−25 %", "0 %"; sin base, "nuevo" o "—". */
export function variation(current: number, previous: number): string {
  if (previous === 0) return current === 0 ? "—" : "nuevo";
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return "0 %";
  return `${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`;
}

/** Lunes de la semana ± n semanas (fechas de calendario, sin zona horaria). */
export function shiftWeek(monday: string, weeks: number): string {
  const d = new Date(`${monday}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d.toISOString().slice(0, 10);
}

export function formatMinutesHours(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}
