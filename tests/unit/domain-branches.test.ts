import { describe, expect, it } from "vitest";
import { closureText } from "@/lib/domain/cash-closure";
import { computeSale } from "@/lib/domain/commission";
import { parseCOP } from "@/lib/domain/money";
import { estimateQueue } from "@/lib/domain/queue-estimate";

/** NFR-009: 100 % de ramas en la lógica de dominio de posición/tiempo, comisión y cierre. */
describe("NFR-009 ramas de la lógica de dominio", () => {
  it("NFR-009 cierre sin premios ni barberos: no muestra esas secciones (REQ-027.6)", () => {
    const text = closureText(
      "La 33",
      {
        day: "2026-10-24",
        byMethod: { cash: 4000, nequi: 0, transfer: 0, card: 0 },
        total: 4000,
        services: 0,
        products: 4000,
        rewards: 0,
        cashExpected: 4000,
        barbers: [],
      },
      4000,
    );
    expect(text).not.toContain("Premios de fidelidad");
    expect(text).not.toContain("Liquidación:");
    expect(text).toContain("diferencia $ 0");
  });

  it("NFR-009 comisión: cantidades inválidas en servicios y productos se rechazan (P9)", () => {
    expect(() =>
      computeSale({
        services: [{ unitPrice: 1000, qty: 0, discount: 0, isReward: false }],
        products: [],
        commissionPct: 50,
      }),
    ).toThrow("cantidad");
    expect(() =>
      computeSale({ services: [], products: [{ unitPrice: 1000, qty: 1.5 }], commissionPct: 50 }),
    ).toThrow("cantidad");
  });

  it("NFR-009 tiempo estimado: barbero ocupado sin hora de fin conocida queda libre desde ahora (REQ-004.5)", () => {
    const now = new Date("2026-10-24T15:00:00Z");
    const [e] = estimateQueue({
      now,
      barbers: [{ id: "juan", status: "busy", busyUntil: null }],
      waiting: [{ id: "t1", queueOrder: 1000, durationMin: 20, preferredBarberId: null }],
    });
    expect(e).toMatchObject({ id: "t1", position: 1, ahead: 0, waitMin: 0, barberId: "juan" });
  });
});

describe("NFR-009 ramas de dinero (P9)", () => {
  it("NFR-009 parseCOP rechaza montos que no caben en un entero seguro", () => {
    expect(parseCOP("99999999999999999999")).toBeNull();
  });
});
