/**
 * REQ-078.31 buscador y filtros de las ventas de la caja (tablero Dueno-Caja). Corren en el
 * navegador sobre las ventas que ya trajo `cash_day_summary`: no hay consulta nueva.
 */
export type SaleRow = {
  id: string;
  items: string;
  customerName: string | null;
  barberName: string | null;
  staffBuyerName: string | null;
  /** "Efectivo + Nequi" (0068): los medios de la venta unidos con " + ". */
  methods: string;
};

export type SaleFilter = { query?: string; barber?: string; method?: string };

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** El barbero de la venta, o el que compró con descuento (REQ-068). */
export const saleBarber = (s: SaleRow) => s.barberName ?? s.staffBuyerName;

const methodsOf = (s: SaleRow) => s.methods.split(" + ");

export function filterSales<S extends SaleRow>(sales: S[], f: SaleFilter): S[] {
  const q = fold(f.query ?? "");
  return sales.filter(
    (s) =>
      (!q || fold(`${s.items} ${s.customerName ?? ""}`).includes(q)) &&
      (!f.barber || saleBarber(s) === f.barber) &&
      (!f.method || methodsOf(s).includes(f.method)),
  );
}

export function saleFilterOptions(sales: SaleRow[]): { barbers: string[]; methods: string[] } {
  const sorted = (xs: (string | null)[]) =>
    [...new Set(xs.filter((x): x is string => !!x))].sort((a, b) => a.localeCompare(b, "es"));
  return {
    barbers: sorted(sales.map(saleBarber)),
    methods: sorted(sales.flatMap(methodsOf)),
  };
}

const WEEKDAYS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

/** "2026-11-06" → "jue 6 nov." (selector de fecha junto al título de la caja). */
export function cashDayLabel(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return `${WEEKDAYS[wd]} ${d} ${MONTHS[m - 1]}.`;
}
