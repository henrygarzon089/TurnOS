import { describe, expect, it } from "vitest";
import {
  defaultKeepId,
  phoneLast4,
  toHistoryRows,
  type HistoryTicket,
} from "@/lib/domain/customer-history";

const JUAN = "b-juan";
const PEDRO = "b-pedro";

const tickets: HistoryTicket[] = [
  {
    id: "t1",
    businessDay: "2026-10-20",
    serviceName: "Corte",
    barberId: JUAN,
    barberName: "Juan",
    status: "done",
    servicePrice: 25000,
  },
  {
    id: "t2",
    businessDay: "2026-10-10",
    serviceName: "Barba",
    barberId: PEDRO,
    barberName: "Pedro",
    status: "done",
    servicePrice: 15000,
  },
  {
    id: "t3",
    businessDay: "2026-10-05",
    serviceName: "Corte",
    barberId: JUAN,
    barberName: "Juan",
    status: "no_show",
    servicePrice: 25000,
  },
  {
    id: "t4",
    businessDay: "2026-10-01",
    serviceName: "Corte",
    barberId: null,
    barberName: null,
    status: "cancelled",
    servicePrice: 25000,
  },
  {
    id: "t5",
    businessDay: "2026-10-24",
    serviceName: "Corte",
    barberId: null,
    barberName: null,
    status: "waiting",
    servicePrice: 25000,
  },
];

describe("REQ-018.2 historial del cliente", () => {
  it("REQ-018.2 muestra fecha, servicio, barbero y estado en español, más reciente primero", () => {
    const rows = toHistoryRows(tickets, { role: "owner", barberId: null });
    expect(rows.map((r) => r.id)).toEqual(["t5", "t1", "t2", "t3", "t4"]);
    expect(rows.map((r) => r.statusLabel)).toEqual([
      "En la fila",
      "Terminado",
      "Terminado",
      "No llegó",
      "Cancelado",
    ]);
    expect(rows[1]).toMatchObject({ date: "2026-10-20", serviceName: "Corte", barberName: "Juan" });
    expect(rows[4].barberName).toBeNull();
  });

  it("REQ-018.2 el valor solo aparece en turnos terminados (precio del turno hasta H3, ADR-016)", () => {
    const rows = toHistoryRows(tickets, { role: "owner", barberId: null });
    expect(rows.map((r) => r.amount)).toEqual([null, 25000, 15000, null, null]);
    expect(rows.every((r) => r.paymentMethod === null)).toBe(true);
  });
});

describe("REQ-018.4 el barbero ve el historial completo sin montos de otros barberos", () => {
  it("REQ-018.4 el barbero ve todos los turnos pero solo el valor de los suyos (PA-10)", () => {
    const rows = toHistoryRows(tickets, { role: "barber", barberId: JUAN });
    expect(rows).toHaveLength(5);
    const pedro = rows.find((r) => r.id === "t2")!;
    expect(pedro.barberName).toBe("Pedro");
    expect(pedro.amount).toBeNull();
    expect(rows.find((r) => r.id === "t1")!.amount).toBe(25000);
  });

  it("REQ-018.4 un dueño que también atiende ve todos los montos", () => {
    const rows = toHistoryRows(tickets, { role: "owner", barberId: JUAN });
    expect(rows.find((r) => r.id === "t2")!.amount).toBe(15000);
  });
});

describe("REQ-018.5 fusión: ficha que conserva el celular", () => {
  it("REQ-018.5 preselecciona la ficha con la visita más reciente", () => {
    const a = { id: "a", lastVisitAt: "2026-09-01T10:00:00Z", createdAt: "2026-01-01T00:00:00Z" };
    const b = { id: "b", lastVisitAt: "2026-10-01T10:00:00Z", createdAt: "2025-01-01T00:00:00Z" };
    expect(defaultKeepId(a, b)).toBe("b");
    expect(defaultKeepId(b, a)).toBe("b");
  });

  it("REQ-018.5 sin visitas, preselecciona la ficha creada más recientemente", () => {
    const a = { id: "a", lastVisitAt: null, createdAt: "2026-10-20T00:00:00Z" };
    const b = { id: "b", lastVisitAt: "2026-05-01T10:00:00Z", createdAt: "2026-01-01T00:00:00Z" };
    const c = { id: "c", lastVisitAt: null, createdAt: "2026-10-22T00:00:00Z" };
    expect(defaultKeepId(a, b)).toBe("b");
    expect(defaultKeepId(a, c)).toBe("c");
  });
});

describe("P6 la lista de clientes no expone el celular completo", () => {
  it("P6 muestra solo los últimos 4 dígitos", () => {
    expect(phoneLast4("+573002000005")).toBe("···0005");
    expect(phoneLast4(null)).toBe("");
  });
});
