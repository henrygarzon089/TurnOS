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

type WeekBarber = {
  barberId: string;
  name: string;
  services: number;
  commission: number;
  productCommission: number;
  toPay: number;
};
type WeekLike = {
  sold: number;
  services: number;
  productCommission: number;
  barbers: WeekBarber[];
};

/**
 * REQ-078.32 cifras de arriba de Semana (design §22.8): Ingresos (`sold`), Servicios, Comisiones
 * (servicios de cada barbero + productos) y Queda al negocio (Ingresos − Comisiones). Cuadran con
 * la caja de cada día (supabase/tests/0078_week_matches_cash.sql).
 */
export function weekFigures(w: WeekLike) {
  const commissions = w.barbers.reduce((s, b) => s + b.commission, 0) + w.productCommission;
  return { income: w.sold, services: w.services, commissions, business: w.sold - commissions };
}

export type SettlementRow = {
  barberId: string;
  name: string;
  pct: number | null;
  services: number;
  commission: number;
  products: number;
  purchases: number;
  toPay: number;
};

/**
 * REQ-078.32 tabla Barbero · % · Servicios · Comisión serv. · Productos · Compras suyas · A pagar.
 * El % es el del barbero (`barbers.commission_pct`); "Compras suyas" es lo que compró con
 * descuento (REQ-068), pagado en la caja: NO se descuenta del A pagar (REQ-068.4).
 */
export function settlementRows(
  w: WeekLike,
  pcts: Record<string, number>,
  purchases: Record<string, number>,
): SettlementRow[] {
  return w.barbers.map((b) => ({
    barberId: b.barberId,
    name: b.name,
    pct: pcts[b.barberId] ?? null,
    services: b.services,
    commission: b.commission,
    products: b.productCommission,
    purchases: purchases[b.barberId] ?? 0,
    toPay: b.toPay,
  }));
}

const MONTHS = [
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
const MONTHS_SHORT = [
  "ene.",
  "feb.",
  "mar.",
  "abr.",
  "may.",
  "jun.",
  "jul.",
  "ago.",
  "sept.",
  "oct.",
  "nov.",
  "dic.",
];

function weekEnds(monday: string) {
  const a = new Date(`${monday}T00:00:00Z`);
  const b = new Date(a);
  b.setUTCDate(b.getUTCDate() + 6);
  return [a, b] as const;
}

/** REQ-078.32 "Lun 3 – dom 9 de noviembre" (tablero Dueno-Operacion). */
export function weekRangeLabel(monday: string): string {
  const [a, b] = weekEnds(monday);
  const end = `dom ${b.getUTCDate()} de ${MONTHS[b.getUTCMonth()]}`;
  return a.getUTCMonth() === b.getUTCMonth()
    ? `Lun ${a.getUTCDate()} – ${end}`
    : `Lun ${a.getUTCDate()} de ${MONTHS[a.getUTCMonth()]} – ${end}`;
}

/** REQ-078.32 en el celular: "3 – 9 nov.". */
export function weekRangeShort(monday: string): string {
  const [a, b] = weekEnds(monday);
  const end = `${b.getUTCDate()} ${MONTHS_SHORT[b.getUTCMonth()]}`;
  return a.getUTCMonth() === b.getUTCMonth()
    ? `${a.getUTCDate()} – ${end}`
    : `${a.getUTCDate()} ${MONTHS_SHORT[a.getUTCMonth()]} – ${end}`;
}
