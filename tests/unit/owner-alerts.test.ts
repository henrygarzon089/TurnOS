import { describe, expect, it } from "vitest";
import {
  buildOwnerAlerts,
  todayAppointments,
  type OwnerAlertsInput,
} from "@/lib/domain/owner-alerts";

const ALL_ON: OwnerAlertsInput = {
  unclosedDays: ["2026-11-04"],
  cleaning: {
    enabled: true,
    openingPending: true,
    flagged: [
      { doneBy: "Mateo", isComplete: false, isLate: false },
      { doneBy: "Juli", isComplete: true, isLate: true },
    ],
    deepPending: true,
  },
  inventory: {
    items: [
      { name: "Alcohol 70 %", warehouse: 2, minQty: 4 },
      { name: "Cuchillas", warehouse: 40, minQty: 10 },
    ],
    alerts: [{ itemName: "Talco", barberName: "Sebas" }],
  },
  memberships: {
    enabled: true,
    expiring: [{ name: "Ana Rojas" }, { name: "Luis Gómez" }, { name: "Eva Arango" }],
  },
};

describe("buildOwnerAlerts", () => {
  it("REQ-076.6 ordena caja, limpieza, inventario y membresías, cada una con su enlace", () => {
    const alerts = buildOwnerAlerts(ALL_ON);
    expect(alerts.map((a) => [a.kind, a.href])).toEqual([
      ["cash", "/admin/caja/2026-11-04"],
      ["cleaning", "/admin/limpieza"],
      ["cleaning", "/admin/limpieza"],
      ["cleaning", "/admin/limpieza"],
      ["inventory", "/admin/inventario/compra"],
      ["inventory", "/admin/inventario"],
      ["membership", "/admin/membresias"],
    ]);
    expect(alerts.map((a) => a.title)).toEqual([
      "La caja del 4 nov 2026 sigue abierta.",
      "Limpieza: apertura pendiente.",
      "Limpieza con falla: 2 registros incompletos o tarde.",
      "Limpieza profunda pendiente esta semana.",
      "Alcohol 70 % por agotarse.",
      "Consumo alto de Talco · Sebas.",
      "3 membresías vencen esta semana.",
    ]);
  });

  it("REQ-076.6 la caja y la limpieza piden atención ahora; inventario y membresías avisan", () => {
    const urgent = buildOwnerAlerts(ALL_ON).map((a) => [a.kind, a.urgent]);
    expect(urgent).toContainEqual(["cash", true]);
    expect(urgent).toContainEqual(["cleaning", true]);
    expect(urgent).toContainEqual(["inventory", false]);
    expect(urgent).toContainEqual(["membership", false]);
  });

  it("REQ-076.6 varios días sin cerrar: uno por día, el más viejo primero", () => {
    const alerts = buildOwnerAlerts({ ...ALL_ON, unclosedDays: ["2026-11-05", "2026-11-02"] });
    expect(alerts.slice(0, 2).map((a) => a.href)).toEqual([
      "/admin/caja/2026-11-02",
      "/admin/caja/2026-11-05",
    ]);
  });

  it("REQ-076.6 un módulo apagado no genera alertas", () => {
    const alerts = buildOwnerAlerts({
      unclosedDays: [],
      cleaning: { enabled: false },
      inventory: { items: [], alerts: [] },
      memberships: {
        enabled: false,
        expiring: [{ name: "Ana Rojas" }],
      },
    });
    expect(alerts).toEqual([]);
  });

  it("REQ-076.6 lo que no cargó no inventa alertas (null = sin datos)", () => {
    expect(
      buildOwnerAlerts({ unclosedDays: [], cleaning: null, inventory: null, memberships: null }),
    ).toEqual([]);
  });

  it("REQ-076.6 varios insumos por agotarse se agrupan; una membresía en singular", () => {
    const alerts = buildOwnerAlerts({
      unclosedDays: [],
      cleaning: null,
      inventory: {
        items: [
          { name: "Alcohol", warehouse: 0, minQty: 2 },
          { name: "Talco", warehouse: 1, minQty: 3 },
          { name: "Sin mínimo", warehouse: 0, minQty: 0 },
        ],
        alerts: [],
      },
      memberships: { enabled: true, expiring: [{ name: "Ana" }] },
    });
    expect(alerts.map((a) => a.title)).toEqual([
      "2 insumos por agotarse.",
      "1 membresía vence esta semana.",
    ]);
  });
});

describe("todayAppointments", () => {
  const NOW = new Date("2026-11-05T20:00:00Z"); // 3:00 p. m. en Bogotá
  const at = (h: number, m = 0) =>
    new Date(Date.UTC(2026, 10, 5, h + 5, m)).toISOString(); // hora de Bogotá → UTC
  const item = (
    id: string,
    start: string,
    end: string,
    status: "booked" | "arrived" | "cancelled" | "no_show",
    day = "2026-11-05",
  ) => ({
    id,
    day,
    startsAt: start,
    endsAt: end,
    customerName: "luis mejía",
    phone: "+573001112233",
    serviceName: "Corte",
    barberName: "Andrés",
    status,
  });

  it("REQ-076.5 cuántas quedan, las próximas 3 y cuáles ya llegaron", () => {
    const r = todayAppointments(
      [
        item("a", at(9), at(9, 30), "arrived"), // ya pasó
        item("b", at(14, 45), at(15, 15), "arrived"), // en curso
        item("c", at(16), at(16, 30), "booked"),
        item("d", at(17), at(17, 30), "booked"),
        item("e", at(18), at(18, 30), "booked"),
        item("f", at(16, 30), at(17), "cancelled"),
        item("g", at(16), at(16, 30), "booked", "2026-11-06"), // mañana
      ],
      "2026-11-05",
      NOW,
    );
    expect(r.remaining).toBe(3);
    expect(r.next.map((n) => [n.id, n.arrived])).toEqual([
      ["b", true],
      ["c", false],
      ["d", false],
    ]);
    expect(r.next[0]).toMatchObject({ customer: "Luis M.", barber: "Andrés", service: "Corte" });
    expect(JSON.stringify(r)).not.toContain("+57");
  });
});
