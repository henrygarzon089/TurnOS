import { formatCOP } from "@/lib/domain/money";
import { formatDayCO } from "@/lib/domain/time";

/** Foto del cierre (design.md §5.2; `cash_closures.totals` = resumen de `cash_day_summary`). */
export type ClosureTotals = {
  day: string;
  byMethod: { cash: number; nequi: number; transfer: number; card: number };
  total: number;
  services: number;
  products: number;
  rewards: number;
  cashExpected: number;
  barbers: { name: string; pct: number; services: number; sold: number; commission: number }[];
};

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
    `Transferencia: ${formatCOP(t.byMethod.transfer)}`,
    `Tarjeta: ${formatCOP(t.byMethod.card)}`,
    `Total: ${formatCOP(t.total)} (servicios ${formatCOP(t.services)} · productos ${formatCOP(t.products)})`,
  ];
  if (t.rewards > 0) lines.push(`Premios de fidelidad: ${formatCOP(t.rewards)}`);
  lines.push(
    `Efectivo contado: ${formatCOP(cashCounted)} · esperado ${formatCOP(t.cashExpected)} · diferencia ${formatCOP(diff)}`,
  );
  if (t.barbers.length) {
    lines.push("", "Liquidación:");
    for (const b of t.barbers) {
      lines.push(
        `${b.name}: ${b.services} ${b.services === 1 ? "servicio" : "servicios"}, ${formatCOP(b.sold)} vendidos, comisión ${b.pct} % = ${formatCOP(b.commission)}`,
      );
    }
  }
  return lines.join("\n");
}

/** REQ-027.4 "Compartir por WhatsApp" (sin destinatario: el dueño elige a quién). */
export function closureShareLink(businessName: string, t: ClosureTotals, cashCounted: number) {
  return `https://wa.me/?text=${encodeURIComponent(closureText(businessName, t, cashCounted))}`;
}
