import { describe, expect, it } from "vitest";
import {
  closureShareLink,
  closureText,
  settlementLine,
  type ClosureTotals,
} from "@/lib/domain/cash-closure";

/** design.md §5.2 — ejemplo de cierre. */
const example: ClosureTotals = {
  day: "2026-10-24",
  byMethod: { cash: 32000, nequi: 25000, transfer: 0, card: 40000 },
  total: 97000,
  services: 90000,
  products: 7000,
  rewards: 25000,
  cashExpected: 32000,
  barbers: [
    { name: "Juan", pct: 60, services: 2, sold: 50000, commission: 30000 },
    { name: "Pedro", pct: 50, services: 2, sold: 40000, commission: 32500 },
  ],
};

describe("REQ-027.6 / REQ-027.4 texto del cierre para liquidar y compartir", () => {
  it("REQ-027.6 una línea por barbero lista para liquidar", () => {
    const text = closureText("Barbería La 33", example, 30000);
    expect(text).toContain("Juan: 2 servicios, $ 50.000 vendidos, comisión 60 % = $ 30.000");
    expect(text).toContain("Pedro: 2 servicios, $ 40.000 vendidos, comisión 50 % = $ 32.500");
  });

  it("REQ-027.4 resumen con medios de pago, total y diferencia de efectivo", () => {
    const text = closureText("Barbería La 33", example, 30000);
    expect(text.split("\n")[0]).toBe("Cierre de caja · Barbería La 33 · 24 oct 2026");
    expect(text).toContain("Efectivo: $ 32.000");
    expect(text).toContain("Nequi: $ 25.000");
    expect(text).toContain("Transferencia: $ 0");
    expect(text).toContain("Tarjeta: $ 40.000");
    expect(text).toContain("Total: $ 97.000 (servicios $ 90.000 · productos $ 7.000)");
    expect(text).toContain("Premios de fidelidad: $ 25.000");
    expect(text).toContain("Efectivo contado: $ 30.000 · esperado $ 32.000 · diferencia -$ 2.000");
  });

  it("REQ-027.6 un servicio en singular", () => {
    const text = closureText(
      "La 33",
      { ...example, barbers: [{ ...example.barbers[0], services: 1 }] },
      32000,
    );
    expect(text).toContain("Juan: 1 servicio,");
    expect(text).toContain("diferencia $ 0");
  });

  it("REQ-027.4 el enlace de WhatsApp lleva el texto completo (texto plano prellenado)", () => {
    const link = closureShareLink("Barbería La 33", example, 30000);
    expect(link.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(link.slice("https://wa.me/?text=".length))).toBe(
      closureText("Barbería La 33", example, 30000),
    );
  });

  it("REQ-048.3 el texto del cierre trae las cuotas y los cortes de membresía", () => {
    const text = closureText(
      "Barbería La 33",
      { ...example, membershipFees: 80000, membershipCuts: { count: 1, listValue: 25000 } },
      30000,
    );
    expect(text).toContain("Cuotas de membresía: $ 80.000");
    expect(text).toContain("Cortes de membresía: 1 · $ 25.000");
    expect(closureText("Barbería La 33", example, 30000)).not.toContain("membresía");
  });

  it("REQ-059.1 REQ-059.2 el texto del cierre trae vendidas, pagado con tarjeta y lo que entró en plata", () => {
    const text = closureText(
      "Barbería La 33",
      { ...example, giftCardsSold: 50000, giftCardsRedeemed: 20000, moneyIn: 77000 },
      30000,
    );
    expect(text).toContain("Tarjetas de regalo vendidas: $ 50.000");
    expect(text).toContain("Pagado con tarjeta de regalo: $ 20.000");
    expect(text).toContain("Entró en plata: $ 77.000");
    expect(closureText("Barbería La 33", example, 30000)).not.toContain("tarjeta de regalo");
  });
});

/** design.md §17.4 ejemplo R: servicios y productos en renglones aparte y el total a pagar. */
const exampleR: ClosureTotals = {
  ...example,
  barbers: [
    {
      name: "Juan",
      pct: 60,
      services: 1,
      sold: 25000,
      commission: 15000,
      productsSold: 35000,
      productCommission: 3500,
      productPct: 10,
      toPay: 18500,
    },
    {
      name: "Pedro",
      pct: 50,
      services: 0,
      sold: 0,
      commission: 0,
      productsSold: 77500,
      productCommission: 7750,
      productPct: 10,
      toPay: 7750,
    },
  ],
  staffPurchases: { count: 1, total: 28000, discount: 7000 },
};

describe("REQ-069 comisión de productos en el cierre", () => {
  it("REQ-069.2 servicios y productos en renglones aparte y el total a pagar", () => {
    const text = closureText("La 33", exampleR, 32000);
    expect(text).toContain(
      "Juan: 1 servicio, $ 25.000 vendidos, comisión 60 % = $ 15.000 · productos $ 35.000, comisión 10 % = $ 3.500 · total a pagar $ 18.500",
    );
    expect(text).toContain(
      "Pedro: productos $ 77.500, comisión 10 % = $ 7.750 · total a pagar $ 7.750",
    );
  });

  it("REQ-069.2 sin productos con comisión no sale el renglón de productos", () => {
    const text = closureText("La 33", example, 32000);
    expect(text).toContain("Juan: 2 servicios, $ 50.000 vendidos, comisión 60 % = $ 30.000\n");
    expect(text).not.toContain("total a pagar");
  });

  it("REQ-069.2 con % de productos distintos en el día sale solo el monto", () => {
    const juan = { ...exampleR.barbers[0], productPct: null };
    expect(settlementLine(juan)).toBe(
      "Juan: 1 servicio, $ 25.000 vendidos, comisión 60 % = $ 15.000 · productos $ 35.000, comisión $ 3.500 · total a pagar $ 18.500",
    );
  });

  it("REQ-069.2 sin toPay ni productsSold el total a pagar se calcula con las dos comisiones", () => {
    const juan = { ...exampleR.barbers[0], toPay: undefined, productsSold: undefined };
    expect(settlementLine(juan)).toContain(
      "productos $ 0, comisión 10 % = $ 3.500 · total a pagar $ 18.500",
    );
  });

  it("REQ-069.3 las compras de barberos salen con su descuento, solo si hubo", () => {
    expect(closureText("La 33", exampleR, 32000)).toContain(
      "Compras de barberos: $ 28.000 (descuento $ 7.000)",
    );
    expect(closureText("La 33", example, 32000)).not.toContain("Compras de barberos");
  });
});
