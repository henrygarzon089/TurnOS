import { describe, expect, it } from "vitest";
import { formatCOP, parseCOP, roundToPeso } from "@/lib/domain/money";

describe("NFR-006 formato COP sin decimales", () => {
  it("NFR-006 formatCOP usa punto de miles y sin decimales", () => {
    expect(formatCOP(25000)).toBe("$ 25.000");
    expect(formatCOP(0)).toBe("$ 0");
    expect(formatCOP(1234567)).toBe("$ 1.234.567");
    expect(formatCOP(-2000)).toBe("-$ 2.000");
  });

  it("NFR-006 formatCOP rechaza montos no enteros (P9)", () => {
    expect(() => formatCOP(12.5)).toThrow();
    expect(() => formatCOP(Number.NaN)).toThrow();
  });

  it("NFR-006 parseCOP acepta lo que escribe un dueño", () => {
    expect(parseCOP("25.000")).toBe(25000);
    expect(parseCOP("$ 25.000")).toBe(25000);
    expect(parseCOP("25000")).toBe(25000);
    expect(parseCOP(" 25 000 ")).toBe(25000);
    expect(parseCOP("25,000")).toBe(25000);
    expect(parseCOP("")).toBeNull();
    expect(parseCOP("abc")).toBeNull();
    expect(parseCOP("25.5")).toBeNull(); // decimales no permitidos
  });

  it("REQ-025.2 roundToPeso redondea al peso, .5 hacia arriba", () => {
    expect(roundToPeso(4999.5)).toBe(5000);
    expect(roundToPeso(4125)).toBe(4125);
    expect(roundToPeso(3374.4)).toBe(3374);
    expect(roundToPeso(3374.6)).toBe(3375);
  });
});
