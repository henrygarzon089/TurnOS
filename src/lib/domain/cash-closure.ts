import { giftCardReportLines, type GiftCardTotals } from "@/lib/domain/giftCard";
import { formatCOP } from "@/lib/domain/money";
import { membershipReportLines, type MembershipTotals } from "@/lib/domain/membership";
import { formatDayCO } from "@/lib/domain/time";

/** Foto del cierre (design.md §5.2; `cash_closures.totals` = resumen de `cash_day_summary`). */
export type ClosureTotals = {
  day: string;
  /** `daviplata` desde ADR-045: los cierres anteriores no lo traen. */
  byMethod: { cash: number; nequi: number; daviplata?: number; transfer: number; card: number };
  total: number;
  services: number;
  products: number;
  rewards: number;
  cashExpected: number;
  barbers: SettlementBarber[];
  /** REQ-069.3 compras de barberos (cierres anteriores al Hito 12 no lo traen). */
  staffPurchases?: { count: number; total: number; discount: number };
} & MembershipTotals &
  GiftCardTotals;

/** Renglón de liquidación de un barbero; los campos de productos llegan desde el Hito 12. */
export type SettlementBarber = {
  name: string;
  pct: number;
  services: number;
  sold: number;
  commission: number;
  productsSold?: number;
  productCommission?: number;
  productPct?: number | null;
  toPay?: number;
};

/**
 * REQ-069.2 "productos $ 60.000, comisión 10 % = $ 6.000 · total a pagar $ 150.000", o null si el
 * barbero no ganó comisión de productos. Sin % cuando el día tuvo más de uno.
 */
export function productSettlement(
  b: Pick<
    SettlementBarber,
    "commission" | "productsSold" | "productCommission" | "productPct" | "toPay"
  >,
): string | null {
  if (!b.productCommission) return null;
  const pct = b.productPct == null ? "" : ` ${b.productPct} % =`;
  return `productos ${formatCOP(b.productsSold ?? 0)}, comisión${pct} ${formatCOP(b.productCommission)} · total a pagar ${formatCOP(b.toPay ?? b.commission + b.productCommission)}`;
}

/**
 * REQ-027.6 / REQ-069.2 "Juan: 8 servicios, $ 240.000 vendidos, comisión 60 % = $ 144.000 ·
 * productos $ 60.000, comisión 10 % = $ 6.000 · total a pagar $ 150.000".
 */
export function settlementLine(b: SettlementBarber): string {
  const products = productSettlement(b);
  const parts: string[] = [];
  if (b.services > 0 || !products)
    parts.push(
      `${b.services} ${b.services === 1 ? "servicio" : "servicios"}, ${formatCOP(b.sold)} vendidos, comisión ${b.pct} % = ${formatCOP(b.commission)}`,
    );
  if (products) parts.push(products);
  return `${b.name}: ${parts.join(" · ")}`;
}

/** REQ-069.3 "Compras de barberos: $ 28.000 (descuento $ 7.000)", o null si no hubo. */
export function staffPurchasesLine(t: Pick<ClosureTotals, "staffPurchases">): string | null {
  const s = t.staffPurchases;
  if (!s || s.count === 0) return null;
  return `Compras de barberos: ${formatCOP(s.total)} (descuento ${formatCOP(s.discount)})`;
}

/**
 * REQ-027.4 resumen en texto plano para WhatsApp y REQ-027.6 una línea de liquidación por
 * barbero: "Juan: 8 servicios, $ 240.000 vendidos, comisión 60 % = $ 144.000".
 */
export function closureText(businessName: string, t: ClosureTotals, cashCounted: number): string {
  const diff = cashCounted - t.cashExpected;
  const lines = [
    `Cierre de caja · ${businessName} · ${formatDayCO(t.day)}`,
    "",
    `Efectivo: ${formatCOP(t.byMethod.cash)}`,
    `Nequi: ${formatCOP(t.byMethod.nequi)}`,
    `Daviplata: ${formatCOP(t.byMethod.daviplata ?? 0)}`,
    `Transferencia: ${formatCOP(t.byMethod.transfer)}`,
    `Tarjeta: ${formatCOP(t.byMethod.card)}`,
    `Total: ${formatCOP(t.total)} (servicios ${formatCOP(t.services)} · productos ${formatCOP(t.products)})`,
  ];
  if (t.rewards > 0) lines.push(`Premios de fidelidad: ${formatCOP(t.rewards)}`);
  for (const m of membershipReportLines(t)) lines.push(`${m.label}: ${m.value}`);
  for (const g of giftCardReportLines(t)) lines.push(`${g.label}: ${g.value}`);
  const staff = staffPurchasesLine(t);
  if (staff) lines.push(staff);
  lines.push(
    `Efectivo contado: ${formatCOP(cashCounted)} · esperado ${formatCOP(t.cashExpected)} · diferencia ${formatCOP(diff)}`,
  );
  if (t.barbers.length) {
    lines.push("", "Liquidación:");
    for (const b of t.barbers) lines.push(settlementLine(b));
  }
  return lines.join("\n");
}

/** REQ-027.4 "Compartir por WhatsApp" (sin destinatario: el dueño elige a quién). */
export function closureShareLink(businessName: string, t: ClosureTotals, cashCounted: number) {
  return `https://wa.me/?text=${encodeURIComponent(closureText(businessName, t, cashCounted))}`;
}
