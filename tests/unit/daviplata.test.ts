import { describe, expect, it } from "vitest";
import { closureText, type ClosureTotals } from "@/lib/domain/cash-closure";
import { GIFT_CARD_SALE_METHODS } from "@/lib/domain/giftCard";

/** T-140 · Daviplata como medio de pago (ADR-045). */
const base: ClosureTotals = {
  day: "2026-11-06",
  byMethod: { cash: 10000, nequi: 0, daviplata: 15000, transfer: 0, card: 0 },
  total: 25000,
  services: 25000,
  products: 0,
  rewards: 0,
  cashExpected: 10000,
  barbers: [],
};

describe("REQ-023.1 / REQ-027.1 Daviplata", () => {
  it("REQ-023.1 una tarjeta de regalo se puede vender con Daviplata", () => {
    expect(GIFT_CARD_SALE_METHODS).toContain("daviplata");
  });

  it("REQ-027.1 el texto del cierre trae la línea de Daviplata después de Nequi", () => {
    const lines = closureText("Filo", base, 10000).split("\n");
    const nequi = lines.indexOf("Nequi: $ 0");
    expect(lines[nequi + 1]).toBe("Daviplata: $ 15.000");
  });

  it("REQ-027.1 un cierre anterior sin Daviplata la muestra en $ 0", () => {
    const { daviplata: _omit, ...old } = base.byMethod;
    const text = closureText("Filo", { ...base, byMethod: old }, 10000);
    expect(text).toContain("Daviplata: $ 0");
  });
});
