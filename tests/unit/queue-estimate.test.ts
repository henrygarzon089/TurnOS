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
