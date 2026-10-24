/**
 * "Mis números" del barbero (REQ-025.5, REQ-029.1): hoy y semana (lunes a domingo, PA-21), con el
 * detalle de sus ventas. La consulta no filtra por barbero: el RLS de `sales` (T-042) solo devuelve
 * las suyas.
 */

/** Columnas de `sales` que lee getMyNumbers (las mismas en la prueba de integración). */
export const MY_NUMBERS_COLUMNS =
  "id, business_day, created_at, barber_id, status, services_total, products_total, total, commission_pct, commission_amount";

export type MyNumbersRow = {
  id: string;
  business_day: string;
  created_at: string;
  barber_id: string | null;
  status: "active" | "voided";
  services_total: number;
  products_total: number;
  total: number;
  commission_pct: number;
  commission_amount: number;
  /** La venta tiene al menos una línea de servicio (cuenta como servicio atendido). */
  has_service: boolean;
};

export type Totals = { services: number; sold: number; commission: number };

function sum(rows: MyNumbersRow[]): Totals {
  const active = rows.filter((r) => r.status === "active");
  return {
    services: active.filter((r) => r.has_service).length,
    sold: active.reduce((s, r) => s + r.services_total, 0),
    commission: active.reduce((s, r) => s + r.commission_amount, 0),
  };
}

export function summarizeMyNumbers(rows: MyNumbersRow[], today: string, weekStart: string) {
  const week = rows.filter((r) => r.business_day >= weekStart && r.business_day <= today);
  return {
    today: sum(week.filter((r) => r.business_day === today)),
    week: sum(week),
    detail: [...week].sort((a, b) => (a.created_at < b.created_at ? 1 : -1)),
  };
}
