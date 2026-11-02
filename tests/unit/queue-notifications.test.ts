import { describe, expect, it } from "vitest";
import { pickNotifications, type PickInput } from "@/lib/domain/queue-notifications";
import { estimateQueue, type Estimate, type QueueInput } from "@/lib/domain/queue-estimate";

const PHONE = "+573001234567";

const est = (over: Partial<Estimate> = {}): Estimate => ({
  id: "t1",
  position: 3,
  ahead: 2,
  waitMin: 20,
  barberId: "b1",
  ...over,
});

const input = (over: Partial<PickInput> = {}): PickInput => ({
  estimates: [],
  waiting: [{ id: "t1", phoneE164: PHONE }],
  called: [],
  recorded: [],
  ...over,
});

const twoLeft = (ticketId = "t1", waitMin = 20) => ({
  kind: "two_left",
  ticketId,
  phoneE164: PHONE,
  waitMin,
});

describe("pickNotifications: faltan 2", () => {
  it("REQ-040.1 envía con 2 delante, con celular y tiempo estimado", () => {
    expect(pickNotifications(input({ estimates: [est()] }))).toEqual([twoLeft()]);
  });

  it("REQ-040.1 envía con 1 delante", () => {
    const estimates = [est({ ahead: 1, position: 2, waitMin: 10 })];
    expect(pickNotifications(input({ estimates }))).toEqual([twoLeft("t1", 10)]);
  });

  it("REQ-040.1 envía con 0 delante aunque el tiempo estimado sea 0 minutos", () => {
    const estimates = [est({ ahead: 0, position: 1, waitMin: 0 })];
    expect(pickNotifications(input({ estimates }))).toEqual([twoLeft("t1", 0)]);
  });

  it("REQ-040.1 no envía con 3 delante", () => {
    expect(pickNotifications(input({ estimates: [est({ ahead: 3 })] }))).toEqual([]);
  });

  it("REQ-040.1 si salta de 4 a 1 delante, envía aunque nunca haya tenido exactamente 2", () => {
    const before = input({ estimates: [est({ ahead: 4 })] });
    expect(pickNotifications(before)).toEqual([]);
    const after = input({ estimates: [est({ ahead: 1, waitMin: 10 })] });
    expect(pickNotifications(after)).toEqual([twoLeft("t1", 10)]);
  });

  it("REQ-040.1 no envía si el turno no tiene celular", () => {
    const waiting = [{ id: "t1", phoneE164: null }];
    expect(pickNotifications(input({ estimates: [est()], waiting }))).toEqual([]);
  });

  it("REQ-040.1 no envía si el turno no aparece entre los datos de contacto", () => {
    expect(pickNotifications(input({ estimates: [est()], waiting: [] }))).toEqual([]);
  });

  it("REQ-040.2 no envía si el turno nació con 2 o menos delante (registro `skipped`)", () => {
    const recorded = [{ ticketId: "t1", kind: "two_left" as const }];
    expect(pickNotifications(input({ estimates: [est()], recorded }))).toEqual([]);
  });

  it("REQ-040.3 no repite: si ya tiene registro, sube a 5 y vuelve a 2, no envía otra vez", () => {
    const recorded = [{ ticketId: "t1", kind: "two_left" as const }];
    for (const ahead of [2, 5, 2]) {
      expect(pickNotifications(input({ estimates: [est({ ahead })], recorded }))).toEqual([]);
    }
  });

  it("REQ-040.3 el registro de `called` u otro turno no cuenta como `faltan 2` de este", () => {
    const recorded = [
      { ticketId: "t1", kind: "called" as const },
      { ticketId: "t2", kind: "two_left" as const },
    ];
    expect(pickNotifications(input({ estimates: [est()], recorded }))).toEqual([twoLeft()]);
  });

  it("REQ-040.4 no envía si el preferido está en pausa", () => {
    const estimates = [
      est({ ahead: 1, waitMin: null, barberId: null, reason: "preferred_unavailable" }),
    ];
    expect(pickNotifications(input({ estimates }))).toEqual([]);
  });

  it("REQ-040.4 no envía si todos los barberos están en pausa o ausentes", () => {
    const estimates = [est({ ahead: 0, waitMin: null, barberId: null, reason: "no_barbers" })];
    expect(pickNotifications(input({ estimates }))).toEqual([]);
  });

  it("REQ-040.4 no envía con `no_capable` (Esperando a que haya quién te atienda)", () => {
    const estimates = [est({ waitMin: null, barberId: null, reason: "no_capable" })];
    expect(pickNotifications(input({ estimates }))).toEqual([]);
  });

  it("REQ-040.4 no envía sin tiempo estimado aunque no venga motivo", () => {
    expect(pickNotifications(input({ estimates: [est({ waitMin: null })] }))).toEqual([]);
  });

  it("REQ-040.4 no envía si hay motivo de bloqueo aunque venga tiempo", () => {
    const estimates = [est({ reason: "no_capable" })];
    expect(pickNotifications(input({ estimates }))).toEqual([]);
  });

  it("REQ-040.4 con el resultado real de estimateQueue: pausa bloquea y al volver envía", () => {
    const queue = (status: "paused" | "available"): QueueInput => ({
      now: new Date("2026-11-01T15:00:00Z"),
      barbers: [{ id: "b1", status }],
      waiting: [{ id: "t1", queueOrder: 1, durationMin: 30, preferredBarberId: "b1" }],
    });
    const paused = input({ estimates: estimateQueue(queue("paused")) });
    expect(pickNotifications(paused)).toEqual([]);
    const back = input({ estimates: estimateQueue(queue("available")) });
    expect(pickNotifications(back)).toEqual([twoLeft("t1", 0)]);
  });
});

describe("pickNotifications: te están llamando", () => {
  it("REQ-040.5 envía a los turnos `called` con celular y sin registro", () => {
    const called = [{ id: "t9", phoneE164: PHONE }];
    expect(pickNotifications(input({ called }))).toEqual([
      { kind: "called", ticketId: "t9", phoneE164: PHONE },
    ]);
  });

  it("REQ-040.5 no envía dos veces ni a un turno sin celular", () => {
    const called = [
      { id: "t9", phoneE164: PHONE },
      { id: "t8", phoneE164: null },
    ];
    const recorded = [{ ticketId: "t9", kind: "called" as const }];
    expect(pickNotifications(input({ called, recorded }))).toEqual([]);
  });

  it("REQ-040.5 el llamado va primero y cada turno recibe solo lo suyo", () => {
    const called = [{ id: "t9", phoneE164: PHONE }];
    const recorded = [{ ticketId: "t9", kind: "two_left" as const }];
    const out = pickNotifications(input({ estimates: [est()], called, recorded }));
    expect(out).toEqual([{ kind: "called", ticketId: "t9", phoneE164: PHONE }, twoLeft()]);
  });
});
