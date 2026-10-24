import { describe, expect, it } from "vitest";
import { closureShareLink, closureText, type ClosureTotals } from "@/lib/domain/cash-closure";

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
});
