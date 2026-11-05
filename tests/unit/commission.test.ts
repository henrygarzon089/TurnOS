import { describe, expect, it } from "vitest";
import {
  computeSale,
  membershipDiscount,
  productCommission,
  roundCommission,
  staffDiscount,
} from "@/lib/domain/commission";

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

/** design.md §13.4 (ADR-030) — membresía familiar: comisión sobre el precio de lista. */
describe("REQ-047.4 comisión con membresía (design.md §13.4)", () => {
  it("REQ-047.4 ejemplo E: corte de membresía en $ 0, comisión sobre el precio de lista", () => {
    const discount = membershipDiscount(25000, "cut", 20);
    expect(discount).toBe(25000);
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount, isReward: false, membership: "cut" }],
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
      rewardsTotal: 0,
    });
  });

  it("REQ-047.2 ejemplo F: cortes agotados, 20 % de descuento del plan", () => {
    const discount = membershipDiscount(25000, "discount", 20);
    expect(discount).toBe(5000);
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount, isReward: false, membership: "discount" }],
        products: [{ unitPrice: 4000, qty: 1 }],
        commissionPct: 60,
      }),
    ).toMatchObject({
      servicesTotal: 20000,
      discountTotal: 5000,
      total: 24000,
      commissionBase: 25000,
      commissionAmount: 15000, // no 12.000 (ADR-030)
      businessAmount: 10000,
    });
  });

  it("REQ-047.2 el descuento del plan se redondea al peso (.5 hacia arriba), como en SQL", () => {
    expect(membershipDiscount(12500, "discount", 15)).toBe(1875);
    expect(membershipDiscount(10001, "discount", 50)).toBe(5001);
    expect(membershipDiscount(25000, "discount", 0)).toBe(0);
    expect(() => membershipDiscount(25000, "discount", 101)).toThrow();
  });

  it("REQ-057.5 ejemplo I: pagar con tarjeta de regalo no cambia la comisión (no depende de los pagos)", () => {
    // Corte $ 25.000 con Juan 60 %, pagado $ 20.000 con la tarjeta y $ 5.000 en efectivo (design.md §15.4).
    // computeSale no recibe los pagos: el medio de pago no entra en la fórmula.
    expect(
      computeSale({
        services: [{ unitPrice: 25000, qty: 1, discount: 0, isReward: false }],
        products: [],
        commissionPct: 60,
      }),
    ).toMatchObject({
      total: 25000,
      commissionBase: 25000,
      commissionAmount: 15000,
      businessAmount: 10000,
    });
  });
});

/** design.md §17.4 — ejemplos M, N, O, P y Q del Hito 12 (mismos números que pgTAP 0061). */
describe("REQ-067.1 comisión de productos (design.md §17.4)", () => {
  const cera = { unitPrice: 35000, qty: 1, commissionable: true };
  const aceite = { unitPrice: 42500, qty: 1, commissionable: true };
  const gaseosa = { unitPrice: 4000, qty: 1, commissionable: false };

  it("REQ-067.1 ejemplo M: la cera (marcada) deja 10 % y la gaseosa nada", () => {
    expect(productCommission({ products: [cera, gaseosa], pct: 10, hasBarber: true })).toEqual({
      base: 35000,
      amount: 3500,
    });
  });

  it("REQ-067.1 ejemplo N: el dueño vende para Pedro", () => {
    expect(productCommission({ products: [cera, aceite], pct: 10, hasBarber: true })).toEqual({
      base: 77500,
      amount: 7750,
    });
  });

  it('REQ-067.3 ejemplo O: "Nadie (el negocio)" no deja comisión', () => {
    expect(productCommission({ products: [cera, aceite], pct: 10, hasBarber: false })).toEqual({
      base: 0,
      amount: 0,
    });
  });

  it("REQ-067.1 ejemplo Q: un solo redondeo por venta", () => {
    const peinilla = { unitPrice: 4005, qty: 3, commissionable: true };
    expect(productCommission({ products: [peinilla], pct: 10, hasBarber: true }).amount).toBe(1202);
    expect(() =>
      productCommission({ products: [{ ...peinilla, qty: 0 }], pct: 10, hasBarber: true }),
    ).toThrow();
  });

  it("REQ-068.3 ejemplo P: la compra de un barbero lleva 20 % por línea y no da comisión", () => {
    expect(staffDiscount({ unitPrice: 35000, qty: 1 }, 20)).toBe(7000);
    expect(staffDiscount({ unitPrice: 4005, qty: 1 }, 15)).toBe(601);
    expect(() => staffDiscount({ unitPrice: 35000, qty: 0 }, 20)).toThrow();
    expect(
      productCommission({ products: [cera], pct: 10, hasBarber: true, staffPurchase: true }),
    ).toEqual({ base: 0, amount: 0 });
  });
});
