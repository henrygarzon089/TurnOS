/**
 * "Mis números" del barbero (REQ-025.5, REQ-029.1): hoy y semana (lunes a domingo, PA-21), con el
 * detalle de sus ventas. La consulta no filtra por barbero: el RLS de `sales` (T-042) solo devuelve
 * las suyas.
 */

/** Columnas de `sales` que lee getMyNumbers (las mismas en la prueba de integración). */
export const MY_NUMBERS_COLUMNS =
  "id, business_day, created_at, barber_id, status, services_total, products_total, total, commission_pct, commission_amount, product_commission_amount";

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
  /** REQ-069.5 comisión de productos de la venta (Hito 12). */
  product_commission_amount: number;
  /** La venta tiene al menos una línea de servicio (cuenta como servicio atendido). */
  has_service: boolean;
};

/** REQ-069.5 `commission` es la de servicios; `total` = servicios + productos. */
export type Totals = {
  services: number;
  sold: number;
  commission: number;
  productCommission: number;
  total: number;
};

function sum(rows: MyNumbersRow[]): Totals {
  const active = rows.filter((r) => r.status === "active");
  const commission = active.reduce((s, r) => s + r.commission_amount, 0);
  const productCommission = active.reduce((s, r) => s + r.product_commission_amount, 0);
  return {
    services: active.filter((r) => r.has_service).length,
    sold: active.reduce((s, r) => s + r.services_total, 0),
    commission,
    productCommission,
    total: commission + productCommission,
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

/** Línea de venta que lee "Mis números" para el desglose (REQ-078.16). */
export type BreakdownItem = {
  kind: "service" | "product";
  name: string;
  qty: number;
  line_total: number;
  is_reward: boolean;
};

/**
 * REQ-078.16 desglose del tablero Barbero-Otros: cortes gratis dados, productos vendidos (cantidad y
 * plata) y lo atendido por servicio, sin las ventas anuladas.
 */
export function myBreakdown(rows: { status: "active" | "voided"; items: BreakdownItem[] }[]) {
  const items = rows.filter((r) => r.status === "active").flatMap((r) => r.items);
  const byService = new Map<string, { name: string; qty: number; amount: number }>();
  for (const i of items.filter((x) => x.kind === "service")) {
    const s = byService.get(i.name) ?? { name: i.name, qty: 0, amount: 0 };
    s.qty += i.qty;
    s.amount += i.line_total;
    byService.set(i.name, s);
  }
  const products = items.filter((x) => x.kind === "product");
  return {
    rewards: items
      .filter((x) => x.kind === "service" && x.is_reward)
      .reduce((n, x) => n + x.qty, 0),
    products: {
      qty: products.reduce((n, x) => n + x.qty, 0),
      amount: products.reduce((n, x) => n + x.line_total, 0),
    },
    byService: [...byService.values()].sort(
      (a, b) => b.qty - a.qty || a.name.localeCompare(b.name),
    ),
  };
}
