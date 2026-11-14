import { describe, expect, it } from "vitest";
import {
  bookableServices,
  bookBarbers,
  bookStepNumber,
  bookStepOfField,
  bookStepQuery,
  bookSummary,
  previousBookStep,
  readBookView,
} from "@/lib/domain/book-steps";

/** T-225 · reservar una cita paso a paso (REQ-089, ADR-063, design.md §26.3). */
const SERVICES = [{ id: "s1" }, { id: "s2" }, { id: "s3" }];
const INFO = {
  barbers: [
    { id: "j", name: "Juan", serviceIds: ["s1", "s2"], photoPath: "b/barbers/j/x.webp" },
    { id: "p", name: "Pedro", serviceIds: ["s1"], photoPath: null },
  ],
  openDays: ["2026-11-17", "2026-11-18"],
};
const q = (s: string) => new URLSearchParams(s);
const H = "2026-11-18T15:00:00.000Z";

describe("REQ-089 reservar una cita en 4 pasos", () => {
  it("REQ-089.1 los pasos son Servicio, Barbero, Día y hora, y Tus datos", () => {
    expect([1, 2, 3, 4]).toEqual(
      (["servicio", "barbero", "hora", "datos"] as const).map(bookStepNumber),
    );
    expect(previousBookStep("datos")).toBe("hora");
    expect(previousBookStep("hora")).toBe("barbero");
    expect(previousBookStep("servicio")).toBeNull();
  });

  it("REQ-089.1 solo los servicios y barberos que reciben citas, con su foto", () => {
    expect(bookableServices(SERVICES, INFO).map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(bookBarbers(INFO, "s2").map((b) => b.name)).toEqual(["Juan"]);
    expect(bookBarbers(INFO, "s1")[0].photoPath).toBe("b/barbers/j/x.webp");
  });

  it("REQ-089.1 el botón fijo resume servicio y barbero", () => {
    expect(bookSummary("Corte", "Juan")).toBe("Corte con Juan");
    expect(bookSummary("Corte", null)).toBe("Corte con el que esté libre");
  });

  it("REQ-089.2 sin hora escogida, el paso 4 vuelve al paso 3 (día y hora)", () => {
    expect(
      readBookView(q("paso=datos&servicio=s1&barbero=j&dia=2026-11-18"), SERVICES, INFO).step,
    ).toBe("hora");
  });

  it("REQ-089.3 escoger lleva al paso siguiente y recargar conserva lo escogido", () => {
    const v = {
      step: "datos" as const,
      serviceId: "s1",
      barberId: "j",
      day: "2026-11-18",
      startsAt: H,
    };
    const url = bookStepQuery(v);
    expect(url).toBe(
      `?paso=datos&servicio=s1&barbero=j&dia=2026-11-18&hora=${encodeURIComponent(H)}`,
    );
    expect(readBookView(q(url.slice(1)), SERVICES, INFO)).toEqual(v);
    expect(bookStepQuery({ ...v, step: "hora", startsAt: null })).toBe(
      "?paso=hora&servicio=s1&barbero=j&dia=2026-11-18",
    );
  });

  it("REQ-089.3 una dirección sin servicio válido vuelve al paso 1; un barbero que no lo hace, a cualquiera", () => {
    expect(readBookView(q(""), SERVICES, INFO).step).toBe("servicio");
    expect(readBookView(q("paso=hora&servicio=s3"), SERVICES, INFO).step).toBe("servicio");
    expect(readBookView(q("paso=hora&servicio=s2&barbero=p"), SERVICES, INFO).barberId).toBeNull();
    // un día sin horario no se queda
    expect(readBookView(q("paso=hora&servicio=s1&dia=2026-12-25"), SERVICES, INFO).day).toBeNull();
  });

  it("REQ-089.3 cada error lleva al paso del dato; la hora que otro tomó, al paso 3", () => {
    expect(bookStepOfField("startsAt")).toBe("hora");
    expect(bookStepOfField("phone")).toBe("datos");
    expect(bookStepOfField("privacyAccepted")).toBe("datos");
    expect(bookStepOfField(undefined)).toBe("datos");
  });
});
