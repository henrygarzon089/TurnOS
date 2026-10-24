import { describe, expect, it } from "vitest";
import { formatPhoneCO, maskPhone, normalizePhoneCO, waMeNumber } from "@/lib/domain/phone";

describe("REQ-003.2 normalización de celular colombiano", () => {
  it("REQ-003.2 acepta 10 dígitos que inician en 3 con distintos formatos", () => {
    const expected = "+573001234567";
    expect(normalizePhoneCO("3001234567")).toBe(expected);
    expect(normalizePhoneCO("300 123 4567")).toBe(expected);
    expect(normalizePhoneCO("300-123-4567")).toBe(expected);
    expect(normalizePhoneCO("+57 300 123 4567")).toBe(expected);
    expect(normalizePhoneCO("+573001234567")).toBe(expected);
    expect(normalizePhoneCO("573001234567")).toBe(expected);
    expect(normalizePhoneCO("(300) 123 4567")).toBe(expected);
    expect(normalizePhoneCO("  3001234567  ")).toBe(expected);
  });

  it("REQ-003.2 rechaza formatos inválidos", () => {
    expect(normalizePhoneCO("")).toBeNull();
    expect(normalizePhoneCO("300123456")).toBeNull(); // 9 dígitos
    expect(normalizePhoneCO("30012345678")).toBeNull(); // 11 dígitos
    expect(normalizePhoneCO("6041234567")).toBeNull(); // fijo (no inicia en 3)
    expect(normalizePhoneCO("+13001234567")).toBeNull(); // otro país
    expect(normalizePhoneCO("abc")).toBeNull();
    expect(normalizePhoneCO("3001234567x")).toBeNull();
  });

  it("formatPhoneCO muestra 300 123 4567", () => {
    expect(formatPhoneCO("+573001234567")).toBe("300 123 4567");
  });

  it("REQ-013.2 / P6 maskPhone oculta el número salvo los últimos 4", () => {
    expect(maskPhone("+573001234567")).toBe("••• ••• 4567");
  });

  it("REQ-009.2 waMeNumber devuelve E.164 sin el signo +", () => {
    expect(waMeNumber("+573001234567")).toBe("573001234567");
  });
});
