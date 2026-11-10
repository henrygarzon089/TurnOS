import { describe, expect, it } from "vitest";
import {
  formatMinutesHours,
  settlementRows,
  shiftWeek,
  variation,
  weekFigures,
  weekRangeLabel,
  weekRangeShort,
} from "@/lib/domain/week";

describe("REQ-028.3 comparación con la semana anterior", () => {
  it("REQ-028.3 variación en % redondeada, con signo", () => {
    expect(variation(120, 100)).toBe("+20 %");
    expect(variation(75, 100)).toBe("−25 %");
    expect(variation(100, 100)).toBe("0 %");
  });
  it("REQ-028.3 sin semana anterior no hay porcentaje", () => {
    expect(variation(10, 0)).toBe("nuevo");
    expect(variation(0, 0)).toBe("—");
  });
  it("REQ-028.1 navegar semanas de lunes a lunes (PA-21)", () => {
    expect(shiftWeek("2026-10-19", -1)).toBe("2026-10-12");
    expect(shiftWeek("2026-10-19", 1)).toBe("2026-10-26");
    expect(shiftWeek("2026-12-28", 1)).toBe("2027-01-04");
  });
  it("REQ-028.2 minutos legibles", () => {
    expect(formatMinutesHours(7920)).toBe("132 h");
    expect(formatMinutesHours(90)).toBe("1 h 30 min");
    expect(formatMinutesHours(0)).toBe("0 h");
  });
});

describe("REQ-078.32 Semana como el tablero (T-180)", () => {
  const week = {
    sold: 4_120_000,
    services: 142,
    productCommission: 34_000,
    barbers: [
      {
        barberId: "a",
        name: "Andrés",
        services: 38,
        commission: 534_000,
        productCommission: 14_000,
        toPay: 548_000,
      },
      {
        barberId: "j",
        name: "Juli",
        services: 33,
        commission: 412_000,
        productCommission: 20_000,
        toPay: 432_000,
      },
    ],
  };

  it("REQ-078.32 Comisiones = servicios + productos y Queda al negocio = Ingresos − Comisiones", () => {
    expect(weekFigures(week)).toEqual({
      income: 4_120_000,
      services: 142,
      commissions: 534_000 + 412_000 + 34_000,
      business: 4_120_000 - 980_000,
    });
  });

  it("REQ-078.32 Comisiones es la suma del A pagar de los barberos", () => {
    const f = weekFigures(week);
    expect(f.commissions).toBe(week.barbers.reduce((s, b) => s + b.toPay, 0));
  });

  it("REQ-078.32 fila por barbero: %, servicios, comisión serv., productos, compras suyas y A pagar", () => {
    const rows = settlementRows(week, { a: 60, j: 55 }, { j: 28_000 });
    expect(rows).toEqual([
      {
        barberId: "a",
        name: "Andrés",
        pct: 60,
        services: 38,
        commission: 534_000,
        products: 14_000,
        purchases: 0,
        toPay: 548_000,
      },
      {
        barberId: "j",
        name: "Juli",
        pct: 55,
        services: 33,
        commission: 412_000,
        products: 20_000,
        purchases: 28_000,
        toPay: 432_000,
      },
    ]);
  });

  it("REQ-078.32 las compras suyas no se descuentan del A pagar (REQ-068.4)", () => {
    const [, juli] = settlementRows(week, {}, { j: 28_000 });
    expect(juli.toPay).toBe(432_000);
    expect(juli.pct).toBeNull();
  });
});

describe("REQ-078.32 rótulo de la semana", () => {
  it("REQ-078.32 'Lun 3 – dom 9 de noviembre' y, si cambia el mes, los dos meses", () => {
    expect(weekRangeLabel("2026-11-02")).toBe("Lun 2 – dom 8 de noviembre");
    expect(weekRangeLabel("2026-10-26")).toBe("Lun 26 de octubre – dom 1 de noviembre");
    expect(weekRangeShort("2026-11-02")).toBe("2 – 8 nov.");
    expect(weekRangeShort("2026-10-26")).toBe("26 oct. – 1 nov.");
  });
});
