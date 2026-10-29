import { describe, expect, it } from "vitest";
import {
  estimateNewTicket,
  estimateQueue,
  positions,
  shouldNotify,
  type QueueInput,
} from "@/lib/domain/queue-estimate";

// Ejemplo numérico de design.md §4
const now = new Date("2026-10-23T10:00:00-05:00");
const t = (hhmm: string) => new Date(`2026-10-23T${hhmm}:00-05:00`);

const example: QueueInput = {
  now,
  barbers: [
    { id: "juan", status: "busy", busyUntil: t("10:10") },
    { id: "pedro", status: "available" },
    { id: "luis", status: "paused" },
  ],
  waiting: [
    { id: "T1", queueOrder: 1000, durationMin: 20, preferredBarberId: null },
    { id: "T2", queueOrder: 2000, durationMin: 15, preferredBarberId: "juan" },
    { id: "T3", queueOrder: 3000, durationMin: 20, preferredBarberId: "luis" },
    { id: "T4", queueOrder: 4000, durationMin: 20, preferredBarberId: null },
  ],
};

describe("REQ-004.5 tiempo estimado (ejemplo de design.md §4)", () => {
  const byId = Object.fromEntries(estimateQueue(example).map((e) => [e.id, e]));

  it("T1 es el siguiente con Pedro", () => {
    expect(byId.T1).toMatchObject({ position: 1, ahead: 0, waitMin: 0, barberId: "pedro" });
  });
  it("T2 espera a Juan 10 min, posición 2", () => {
    expect(byId.T2).toMatchObject({ position: 2, ahead: 1, waitMin: 10, barberId: "juan" });
  });
  it("REQ-010.1 T3 eligió a Luis (en pausa): sin estimado, con motivo", () => {
    expect(byId.T3).toMatchObject({
      waitMin: null,
      barberId: null,
      reason: "preferred_unavailable",
    });
    expect(byId.T3.position).toBe(2); // T1 es "cualquiera" y está delante en la lista de Luis
  });
  it("T4 empieza a las 10:20 con Pedro, posición 4", () => {
    expect(byId.T4).toMatchObject({ position: 4, ahead: 3, waitMin: 20, barberId: "pedro" });
  });
});

describe("REQ-004.1 posición", () => {
  it("'el que esté libre' cuenta a todos los de adelante; preferido solo a los suyos y a 'cualquiera'", () => {
    const pos = positions(example.waiting);
    expect([...pos.entries()]).toEqual([
      ["T1", 1],
      ["T2", 2],
      ["T3", 2],
      ["T4", 4],
    ]);
  });
});

describe("casos borde", () => {
  it("sin barberos activos → todos null con motivo no_barbers", () => {
    const r = estimateQueue({ ...example, barbers: [{ id: "x", status: "off" }] });
    expect(r.every((e) => e.waitMin === null && e.reason === "no_barbers")).toBe(true);
  });
  it("REQ-004.5 redondea hacia arriba a 5 minutos", () => {
    const r = estimateQueue({
      now,
      barbers: [{ id: "a", status: "busy", busyUntil: t("10:07") }],
      waiting: [{ id: "x", queueOrder: 1000, durationMin: 20, preferredBarberId: null }],
    });
    expect(r[0].waitMin).toBe(10);
  });
  it("un barbero ocupado cuyo busyUntil ya pasó cuenta como libre ahora", () => {
    const r = estimateQueue({
      now,
      barbers: [{ id: "a", status: "busy", busyUntil: t("09:50") }],
      waiting: [{ id: "x", queueOrder: 1000, durationMin: 20, preferredBarberId: null }],
    });
    expect(r[0].waitMin).toBe(0);
  });
  it("empate de barberos libres se resuelve por id (determinista)", () => {
    const r = estimateQueue({
      now,
      barbers: [
        { id: "b", status: "available" },
        { id: "a", status: "available" },
      ],
      waiting: [{ id: "x", queueOrder: 1000, durationMin: 20, preferredBarberId: null }],
    });
    expect(r[0].barberId).toBe("a");
  });
  it("REQ-017.3 estimado para un turno nuevo al final", () => {
    const e = estimateNewTicket(example, 20, null);
    // Juan libre 10:25 (tras T2), Pedro libre 10:40 (tras T1 y T4) → Juan a las 10:25
    expect(e).toMatchObject({ waitMin: 25, barberId: "juan", position: 5 });
  });
  it("REQ-009.1 avisar cuando faltan exactamente 2", () => {
    expect(shouldNotify({ id: "x", position: 3, ahead: 2, waitMin: 20, barberId: "a" })).toBe(true);
    expect(shouldNotify({ id: "x", position: 2, ahead: 1, waitMin: 10, barberId: "a" })).toBe(
      false,
    );
  });
  it("fila vacía → sin estimados", () => {
    expect(estimateQueue({ ...example, waiting: [] })).toEqual([]);
  });
});

// REQ-035.10 (T-053): solo cuentan los barberos que hacen el servicio. Ana es la estilista: la
// única que hace cepillado; Juan y Pedro solo cortes.
describe("REQ-035.10 posición y tiempo solo con quienes hacen el servicio", () => {
  const all = ["juan", "pedro", "ana"];
  const input: QueueInput = {
    now,
    barbers: [
      { id: "juan", status: "available" },
      { id: "pedro", status: "busy", busyUntil: t("10:20") },
      { id: "ana", status: "busy", busyUntil: t("10:30") },
    ],
    waiting: [
      { id: "C1", queueOrder: 1000, durationMin: 30, preferredBarberId: null, capableBarberIds: ["ana"] },
      { id: "K1", queueOrder: 2000, durationMin: 20, preferredBarberId: null, capableBarberIds: ["juan", "pedro"] },
      { id: "C2", queueOrder: 3000, durationMin: 30, preferredBarberId: null, capableBarberIds: ["ana"] },
      { id: "X1", queueOrder: 4000, durationMin: 20, preferredBarberId: null, capableBarberIds: all },
    ],
  };
  const byId = Object.fromEntries(estimateQueue(input).map((e) => [e.id, e]));

  it("REQ-035.10 el corte no cuenta el cepillado de delante: es el siguiente, con Juan ya", () => {
    expect(byId.K1).toMatchObject({ position: 1, waitMin: 0, barberId: "juan" });
  });
  it("REQ-035.10 el cepillado espera a la estilista aunque Juan esté libre", () => {
    expect(byId.C1).toMatchObject({ position: 1, waitMin: 30, barberId: "ana" });
    expect(byId.C2).toMatchObject({ position: 2, waitMin: 60, barberId: "ana" });
  });
  it("REQ-035.10 un servicio que hacen todos cuenta a todos los de delante", () => {
    // empate Juan/Pedro a las 10:20 → menor id
    expect(byId.X1).toMatchObject({ position: 4, barberId: "juan", waitMin: 20 });
  });
  it("REQ-035.10 con la estilista en pausa: sin tiempo y con motivo propio", () => {
    const paused: QueueInput = {
      ...input,
      barbers: input.barbers.map((b) => (b.id === "ana" ? { id: "ana", status: "paused" } : b)),
    };
    const e = Object.fromEntries(estimateQueue(paused).map((x) => [x.id, x]));
    expect(e.C1).toMatchObject({ waitMin: null, barberId: null, reason: "no_capable" });
    expect(e.K1).toMatchObject({ waitMin: 0, barberId: "juan" });
  });
  it("REQ-035.10 sin capableBarberIds (todos hacen todo) se comporta como antes", () => {
    expect(positions(example.waiting)).toEqual(
      positions(example.waiting.map((w) => ({ ...w, capableBarberIds: ["juan", "pedro", "luis"] }))),
    );
  });
  it("REQ-035.10 el estimado para quien va a tomar un cepillado ahora", () => {
    // delante: C1, C2 y X1 (X1 lo podría hacer Ana)
    expect(estimateNewTicket(input, 30, null, ["ana"])).toMatchObject({ position: 4, waitMin: 90 });
  });
});

describe("REQ-035.9 quién hace cada servicio", () => {
  it("REQ-035.9 agrupa barber_services por servicio", async () => {
    const { capableByService } = await import("@/lib/domain/queue-estimate");
    const m = capableByService([
      { barber_id: "ana", service_id: "cep" },
      { barber_id: "juan", service_id: "corte" },
      { barber_id: "ana", service_id: "corte" },
    ]);
    expect(m.get("cep")).toEqual(["ana"]);
    expect(m.get("corte")).toEqual(["juan", "ana"]);
  });
});
