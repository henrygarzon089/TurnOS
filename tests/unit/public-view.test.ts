import { describe, expect, it } from "vitest";
import { businessMark, hhmmTo12h, publicBarberLines } from "@/lib/domain/public-view";

describe("T-162 portada del cliente (REQ-078, tablero Cliente-Negocio)", () => {
  it("REQ-078.14 la marca del negocio es su número o sus iniciales, sin logo descargado", () => {
    expect(businessMark("Barbería La 33")).toBe("33");
    expect(businessMark("Barbería Filo")).toBe("FI");
    expect(businessMark("Peluquería Don Mario")).toBe("DM");
    expect(businessMark("Estudio 1024 Barber")).toBe("102");
    expect(businessMark("  ")).toBe("T");
  });

  it("REQ-078.15 la hora de cierre en 12 horas", () => {
    expect(hhmmTo12h("20:00")).toBe("8:00 p. m.");
    expect(hhmmTo12h("09:30")).toBe("9:30 a. m.");
    expect(hhmmTo12h("12:00")).toBe("12:00 p. m.");
    expect(hhmmTo12h("00:15")).toBe("12:15 a. m.");
  });

  it("REQ-013.2 una línea por barbero: en pausa, libre o cuántos tiene y cuánto falta; sin celulares", () => {
    const now = new Date("2026-11-07T20:00:00Z");
    const lines = publicBarberLines(
      {
        services: [{ id: "s", name: "Corte", durationMin: 30, price: 25000 }],
        barbersToday: [
          { id: "a", name: "Andrés", status: "busy" },
          { id: "m", name: "Mateo", status: "paused" },
          { id: "k", name: "Kevin", status: "available" },
        ],
        queue: {
          barbers: [
            { id: "a", name: "Andrés", status: "busy", busyUntil: "2026-11-07T20:10:00Z" },
            { id: "m", name: "Mateo", status: "paused" },
            { id: "k", name: "Kevin", status: "available" },
          ],
          waiting: [
            { id: "t1", queueOrder: 1, durationMin: 30, preferredBarberId: "a", displayNumber: 1 },
            { id: "t2", queueOrder: 2, durationMin: 30, preferredBarberId: "a", displayNumber: 2 },
          ],
          appointments: [],
        },
      },
      now,
    );
    expect(lines.map((l) => [l.name, l.state, l.waiting])).toEqual([
      ["Andrés", "busy", 2],
      ["Mateo", "paused", 0],
      ["Kevin", "free", 0],
    ]);
    // Andrés: 10 min que le quedan + 2 cortes de 30 antes del nuevo
    expect(lines[0].waitMin).toBe(70);
    expect(lines[1].waitMin).toBeNull();
    expect(lines[2].waitMin).toBe(0);
    expect(JSON.stringify(lines)).not.toMatch(/\+57/);
  });

  it("REQ-001.4 con gente esperando a cualquiera, un barbero disponible no sale como Libre", () => {
    const now = new Date("2026-11-07T20:00:00Z");
    const [line] = publicBarberLines(
      {
        services: [{ id: "s", name: "Corte", durationMin: 30, price: 25000 }],
        barbersToday: [{ id: "k", name: "Kevin", status: "available" }],
        queue: {
          barbers: [{ id: "k", name: "Kevin", status: "available" }],
          waiting: [
            { id: "t1", queueOrder: 1, durationMin: 30, preferredBarberId: null, displayNumber: 1 },
          ],
          appointments: [],
        },
      },
      now,
    );
    expect(line.state).toBe("busy");
    expect(line.waiting).toBe(0);
    expect(line.waitMin).toBe(30);
  });
});
