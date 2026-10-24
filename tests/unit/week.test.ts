import { describe, expect, it } from "vitest";
import { formatMinutesHours, shiftWeek, variation } from "@/lib/domain/week";

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
