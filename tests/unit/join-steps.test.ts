import { describe, expect, it } from "vitest";
import {
  ANY_BARBER,
  barberChoices,
  barberChoiceText,
  joinStepQuery,
  joinSummary,
  previousStep,
  readJoinView,
  stepNumber,
  stepOfField,
} from "@/lib/domain/join-steps";
import type { PublicBusiness } from "@/lib/queue/public-queue";

/** T-224 · tomar turno paso a paso (REQ-088, ADR-063, design.md §26.3). */
const NOW = new Date("2026-11-17T15:00:00Z");

const BIZ: Pick<PublicBusiness, "services" | "barbersToday" | "queue" | "barberPhotos"> = {
  services: [
    { id: "s1", name: "Corte", durationMin: 30, price: 25000, photoPath: null },
    // Solo Andrés hace la barba (REQ-035)
    { id: "s2", name: "Barba", durationMin: 20, price: 15000, photoPath: null, barberIds: ["a"] },
    // Nadie de hoy lo hace (REQ-035.7)
    { id: "s3", name: "Tinte", durationMin: 60, price: 60000, photoPath: null, barberIds: ["z"] },
  ],
  barbersToday: [
    { id: "a", name: "Andrés", status: "busy" },
    { id: "k", name: "Kevin", status: "available" },
    { id: "m", name: "Mateo", status: "paused" },
  ],
  queue: {
    barbers: [
      { id: "a", status: "busy", busyUntil: new Date(NOW.getTime() + 20 * 60_000) },
      { id: "k", status: "available" },
      { id: "m", status: "paused" },
    ],
    waiting: [{ id: "t1", queueOrder: 1, durationMin: 30, preferredBarberId: "a" }],
    appointments: [],
  },
  barberPhotos: { a: "biz/barbers/a/x.webp" },
} as unknown as Pick<PublicBusiness, "services" | "barbersToday" | "queue" | "barberPhotos">;

const q = (s: string) => new URLSearchParams(s);

describe("REQ-088 tomar turno en 3 pasos", () => {
  it("REQ-088.1 sin paso en la dirección se ve la portada con los dos botones", () => {
    expect(readJoinView(q(""), BIZ)).toEqual({ step: null, serviceId: null, barberId: null });
  });

  it("REQ-088.2 los pasos son Servicio, Barbero y Tus datos, de 3", () => {
    expect(stepNumber("servicio")).toBe(1);
    expect(stepNumber("barbero")).toBe(2);
    expect(stepNumber("datos")).toBe(3);
    expect(previousStep("datos")).toBe("barbero");
    expect(previousStep("barbero")).toBe("servicio");
    expect(previousStep("servicio")).toBeNull();
  });

  it("REQ-088.2 en el paso 2 no salen los barberos que no hacen el servicio", () => {
    const { barbers } = barberChoices(BIZ, "s2", NOW);
    expect(barbers.map((b) => b.name)).toEqual(["Andrés"]);
  });

  it("REQ-088.2 cada barbero dice 'Libre', 'n antes · ~ N min' o 'En pausa', con su foto", () => {
    const { barbers, anyWaitMin } = barberChoices(BIZ, "s1", NOW);
    const by = Object.fromEntries(barbers.map((b) => [b.id, b]));
    expect(by.k.text).toBe("Libre");
    expect(by.a.text).toMatch(/^1 antes · ~ \d+ min$/);
    expect(by.m).toMatchObject({ text: "En pausa", paused: true });
    expect(by.a.photoPath).toBe("biz/barbers/a/x.webp");
    expect(by.k.photoPath).toBeNull();
    expect(anyWaitMin).toBe(0); // "El primero libre": Kevin está libre
    expect(barberChoiceText(false, 3, 45)).toBe("3 antes · ~ 45 min");
  });

  it("REQ-088.2 el botón fijo resume servicio, barbero y espera", () => {
    expect(joinSummary("Corte moderno", "Pedro", 20)).toBe("Corte moderno con Pedro · ~ 20 min");
    expect(joinSummary("Corte", null, 0)).toBe("Corte con el primero libre · ya");
    expect(joinSummary("Corte", null, null)).toBe("Corte con el primero libre");
  });

  it("REQ-088.3 escoger servicio o barbero lleva al paso siguiente con lo escogido", () => {
    expect(joinStepQuery({ step: "barbero", serviceId: "s1", barberId: null })).toBe(
      "?paso=barbero&servicio=s1",
    );
    expect(joinStepQuery({ step: "datos", serviceId: "s1", barberId: "k" })).toBe(
      "?paso=datos&servicio=s1&barbero=k",
    );
    expect(joinStepQuery({ step: "datos", serviceId: "s1", barberId: null })).toBe(
      `?paso=datos&servicio=s1&barbero=${ANY_BARBER}`,
    );
  });

  it("REQ-088.4 recargar en un paso conserva lo escogido", () => {
    expect(readJoinView(q("paso=datos&servicio=s1&barbero=k"), BIZ)).toEqual({
      step: "datos",
      serviceId: "s1",
      barberId: "k",
    });
    expect(readJoinView(q("paso=datos&servicio=s1&barbero=libre"), BIZ).barberId).toBeNull();
  });

  it("REQ-088.4 una dirección sin servicio válido vuelve al paso 1", () => {
    expect(readJoinView(q("paso=datos"), BIZ).step).toBe("servicio");
    expect(readJoinView(q("paso=barbero&servicio=nada"), BIZ).step).toBe("servicio");
    // REQ-035.7: un servicio que hoy nadie hace no se puede dejar escogido
    expect(readJoinView(q("paso=barbero&servicio=s3"), BIZ).step).toBe("servicio");
    expect(readJoinView(q("paso=otro"), BIZ).step).toBeNull();
  });

  it("REQ-088.6 un barbero en pausa o que no hace el servicio pasa a 'El primero libre'", () => {
    expect(readJoinView(q("paso=datos&servicio=s1&barbero=m"), BIZ).barberId).toBeNull();
    expect(readJoinView(q("paso=datos&servicio=s2&barbero=k"), BIZ).barberId).toBeNull();
  });

  it("REQ-088.6 cada error lleva al paso donde está el dato", () => {
    expect(stepOfField("serviceId")).toBe("servicio");
    expect(stepOfField("preferredBarberId")).toBe("barbero");
    for (const f of [
      "phone",
      "name",
      "birthday",
      "courtesyProductId",
      "privacyAccepted",
      undefined,
    ])
      expect(stepOfField(f)).toBe("datos");
  });
});
