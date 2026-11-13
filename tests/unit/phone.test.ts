import { describe, expect, it } from "vitest";
import {
  formatPhoneCO,
  isColombianPhone,
  maskPhone,
  normalizeBarberPhone,
  normalizePhoneCO,
  phoneForEdit,
  waMeNumber,
} from "@/lib/domain/phone";

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

  it("REQ-078.6 maskPhone deja ver solo los 3 primeros y los últimos 4 (300 *** 4567)", () => {
    expect(maskPhone("+573001234567")).toBe("300 *** 4567");
  });

  it("REQ-009.2 waMeNumber devuelve E.164 sin el signo +", () => {
    expect(waMeNumber("+573001234567")).toBe("573001234567");
  });
});

describe("REQ-081 celular del barbero de otro país", () => {
  it("REQ-081.2 con Colombia funciona igual que hoy", () => {
    expect(normalizeBarberPhone("300 123 4567", "co")).toBe("+573001234567");
    expect(normalizeBarberPhone("+54 9 11 2345 6789", "co")).toBeNull();
  });

  it("REQ-081.2 con otro país guarda E.164 con indicativo, sin espacios", () => {
    expect(normalizeBarberPhone("+54 9 11 2345 6789", "other")).toBe("+5491123456789");
    expect(normalizeBarberPhone("+58 (412) 123-4567", "other")).toBe("+584121234567");
    expect(normalizeBarberPhone("  +1 305 555 0101 ", "other")).toBe("+13055550101");
  });

  it("REQ-081.2 con otro país rechaza sin +, muy corto, muy largo o con letras", () => {
    expect(normalizeBarberPhone("5491123456789", "other")).toBeNull();
    expect(normalizeBarberPhone("+54 123", "other")).toBeNull(); // 5 dígitos
    expect(normalizeBarberPhone("+54 9 11 2345 6789 0123", "other")).toBeNull(); // 17 dígitos
    expect(normalizeBarberPhone("+0 300 123 4567", "other")).toBeNull();
    expect(normalizeBarberPhone("+54 abc", "other")).toBeNull();
    expect(normalizeBarberPhone("", "other")).toBeNull();
  });

  it("REQ-081.2 un +57 escrito en otro país debe cumplir la regla colombiana", () => {
    expect(normalizeBarberPhone("+57 300 123 4567", "other")).toBe("+573001234567");
    expect(normalizeBarberPhone("+57 604 123 4567", "other")).toBeNull();
  });

  it("REQ-081.5 un celular de otro país se enmascara con su indicativo", () => {
    expect(isColombianPhone("+573001234567")).toBe(true);
    expect(isColombianPhone("+5491123456789")).toBe(false);
    expect(maskPhone("+5491123456789")).toBe("+54 *** 6789");
    expect(maskPhone("+573001234567")).toBe("300 *** 4567");
  });

  it("REQ-081.5 al editar, el campo muestra el número de otro país completo", () => {
    expect(phoneForEdit("+573001234567")).toEqual({ country: "co", value: "300 123 4567" });
    expect(phoneForEdit("+5491123456789")).toEqual({ country: "other", value: "+5491123456789" });
  });
});
