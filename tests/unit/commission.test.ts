import { describe, expect, it } from "vitest";
import { computeSale, roundCommission } from "@/lib/domain/commission";

/** design.md §5.1 — los ejemplos A, B, C y D tal cual. */
describe("REQ-025.2 comisión por venta (design.md §5.1)", () => {
  it("REQ-025.2 ejemplo A: corte $ 25.000, Juan 60 %", () => {
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount: 0, isReward: false }],
        products: [],
        commissionPct: 60,
      }),
    ).toEqual({
      servicesTotal: 25000,
      productsTotal: 0,
      discountTotal: 0,
      total: 25000,
      commissionBase: 25000,
      commissionAmount: 15000,
      businessAmount: 10000,
      rewardsTotal: 0,
    });
  });

  it("REQ-024.3 ejemplo B: corte + gaseosa, la gaseosa no genera comisión", () => {
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount: 0, isReward: false }],
        products: [{ unitPrice: 4000, qty: 1 }],
        commissionPct: 60,
      }),
    ).toMatchObject({
      servicesTotal: 25000,
      productsTotal: 4000,
      total: 29000,
      commissionAmount: 15000,
      businessAmount: 10000,
    });
  });

  it("REQ-025.4 ejemplo C: décimo corte gratis, comisión sobre precio de lista", () => {
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount: 25000, isReward: true }],
        products: [],
        commissionPct: 60,
      }),
    ).toEqual({
      servicesTotal: 0,
      productsTotal: 0,
      discountTotal: 25000,
      total: 0,
      commissionBase: 25000,
      commissionAmount: 15000,
      businessAmount: 10000,
      rewardsTotal: 25000,
    });
  });

  it("REQ-025.2 ejemplo D: redondeo al peso más cercano (.5 hacia arriba)", () => {
    expect(roundCommission(12500, 33)).toBe(4125);
    expect(roundCommission(10000, 33)).toBe(3300);
    expect(roundCommission(7500, 45)).toBe(3375);
    expect(roundCommission(9999, 50)).toBe(5000);
  });

  it("REQ-023.2 un descuento que no es premio reduce la base (PA-18)", () => {
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount: 5000, isReward: false }],
        products: [],
        commissionPct: 60,
      }),
    ).toMatchObject({
      servicesTotal: 20000,
      commissionBase: 20000,
      commissionAmount: 12000,
      total: 20000,
    });
  });

  it("REQ-024.3 venta solo de productos: sin comisión", () => {
    expect(
      computeSale({ services: [], products: [{ unitPrice: 4000, qty: 2 }], commissionPct: 0 }),
    ).toMatchObject({ total: 8000, productsTotal: 8000, commissionBase: 0, commissionAmount: 0 });
  });

  it("REQ-025.2 ejemplo del cierre (design §5.2): Pedro 50 % con premio + gaseosa", () => {
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount: 25000, isReward: true }],
        products: [{ unitPrice: 3000, qty: 1 }],
        commissionPct: 50,
      }),
    ).toMatchObject({ total: 3000, commissionAmount: 12500, businessAmount: 12500 });
  });

  it("NFR-006 rechaza montos no enteros o negativos (P9)", () => {
    expect(() =>
      computeSale({
        services: [{ unitPrice: 25000.5, qty: 1, discount: 0, isReward: false }],
        products: [],
        commissionPct: 60,
      }),
    ).toThrow();
    expect(() =>
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount: 30000, isReward: false }],
        products: [],
        commissionPct: 60,
      }),
    ).toThrow();
    expect(() => roundCommission(1000, 101)).toThrow();
  });
});
