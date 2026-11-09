import { describe, expect, it } from "vitest";
import {
  agoCO,
  bogotaWeekStart,
  businessDayBogota,
  ceil5,
  formatMinutes,
  formatDayCO,
  formatLongDayCO,
  formatTimeBogota,
  minutesBetween,
} from "@/lib/domain/time";

describe("REQ-004.5 redondeo a 5 minutos", () => {
  it("ceil5 redondea hacia arriba al múltiplo de 5", () => {
    expect(ceil5(0)).toBe(0);
    expect(ceil5(1)).toBe(5);
    expect(ceil5(5)).toBe(5);
    expect(ceil5(21)).toBe(25);
    expect(ceil5(24.2)).toBe(25);
    expect(ceil5(-3)).toBe(0);
  });

  it("formatMinutes muestra ≈ N min y horas cuando pasa de 60", () => {
    expect(formatMinutes(0)).toBe("Eres el siguiente");
    expect(formatMinutes(25)).toBe("≈ 25 min");
    expect(formatMinutes(60)).toBe("≈ 1 h");
    expect(formatMinutes(95)).toBe("≈ 1 h 35 min");
  });
});

describe("P5 / REQ-027.5 día de negocio en America/Bogota", () => {
  it("businessDayBogota usa la fecha de Bogotá, no la UTC", () => {
    // 2026-10-24 02:30 UTC = 2026-10-23 21:30 en Bogotá
    expect(businessDayBogota(new Date("2026-10-24T02:30:00Z"))).toBe("2026-10-23");
    // 2026-10-24 05:00 UTC = 2026-10-24 00:00 en Bogotá
    expect(businessDayBogota(new Date("2026-10-24T05:00:00Z"))).toBe("2026-10-24");
    expect(businessDayBogota(new Date("2026-10-24T04:59:59Z"))).toBe("2026-10-23");
  });

  it("REQ-028.1 bogotaWeekStart devuelve el lunes de la semana (PA-21)", () => {
    // 2026-10-23 es viernes → lunes 2026-10-19
    expect(bogotaWeekStart(new Date("2026-10-23T15:00:00Z"))).toBe("2026-10-19");
    // domingo 2026-10-25 21:00 Bogotá (lunes 02:00 UTC) sigue siendo semana del 19
    expect(bogotaWeekStart(new Date("2026-10-26T02:00:00Z"))).toBe("2026-10-19");
    // lunes 2026-10-26 00:30 Bogotá
    expect(bogotaWeekStart(new Date("2026-10-26T05:30:00Z"))).toBe("2026-10-26");
  });

  it("formatTimeBogota muestra hora de 12 h en español", () => {
    expect(formatTimeBogota(new Date("2026-10-23T14:05:00Z"))).toBe("9:05 a. m.");
    expect(formatTimeBogota(new Date("2026-10-24T01:00:00Z"))).toBe("8:00 p. m.");
  });

  it("P5 formatDayCO muestra la fecha en español sin depender de ICU", () => {
    expect(formatDayCO("2026-10-20")).toBe("20 oct 2026");
    expect(formatDayCO("2027-01-05")).toBe("5 ene 2027");
  });

  it("minutesBetween redondea hacia abajo", () => {
    const a = new Date("2026-10-23T10:00:00Z");
    expect(minutesBetween(a, new Date("2026-10-23T10:12:59Z"))).toBe(12);
    expect(minutesBetween(a, a)).toBe(0);
  });

  it("REQ-078.27 formatLongDayCO arma la fecha larga de la barra del dueño", () => {
    expect(formatLongDayCO("2026-11-05")).toBe("Jueves 5 de noviembre");
    expect(formatLongDayCO("2026-11-08")).toBe("Domingo 8 de noviembre");
    expect(formatLongDayCO("2027-01-01")).toBe("Viernes 1 de enero");
  });
});

describe("REQ-078.16 'hace N semanas' de la lista de clientes del barbero", () => {
  const now = new Date("2026-11-09T20:00:00Z"); // lunes 9 nov, 3 p. m. en Bogotá
  it.each([
    ["2026-11-09T14:00:00Z", "hoy"],
    ["2026-11-09T04:00:00Z", "ayer"], // 11 p. m. del domingo en Bogotá
    ["2026-11-05T15:00:00Z", "hace 4 días"],
    ["2026-11-02T15:00:00Z", "hace 1 semana"],
    ["2026-10-19T15:00:00Z", "hace 3 semanas"],
    ["2026-10-01T15:00:00Z", "hace 1 mes"],
    ["2026-07-01T15:00:00Z", "hace 4 meses"],
    ["2025-10-01T15:00:00Z", "hace más de un año"],
  ])("REQ-078.16 %s → %s", (iso, text) => {
    expect(agoCO(iso, now)).toBe(text);
  });
});
