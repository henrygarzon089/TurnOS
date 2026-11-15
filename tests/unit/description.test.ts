import { describe, expect, it } from "vitest";
import {
  BUSINESS_DESCRIPTION_MAX,
  SERVICE_DESCRIPTION_MAX,
  normalizeDescription,
} from "@/lib/domain/description";

/** T-261 / T-263 · limpieza y largo de las descripciones (REQ-096.2, REQ-096.3, REQ-097.2). */
describe("normalizeDescription", () => {
  it("REQ-096.2 quita espacios del principio y del final y junta saltos de línea y espacios repetidos", () => {
    expect(normalizeDescription("  Corte con  máquina\n\ny tijera \t ", 140)).toEqual({
      ok: true,
      value: "Corte con máquina y tijera",
    });
  });

  it("REQ-096.2 vacía o solo espacios se guarda como sin descripción", () => {
    expect(normalizeDescription("", 140)).toEqual({ ok: true, value: null });
    expect(normalizeDescription("   \n ", 140)).toEqual({ ok: true, value: null });
  });

  it("REQ-096.3 el servicio acepta hasta 140 caracteres y rechaza 141 con el mensaje", () => {
    expect(SERVICE_DESCRIPTION_MAX).toBe(140);
    expect(normalizeDescription("a".repeat(140), SERVICE_DESCRIPTION_MAX)).toEqual({
      ok: true,
      value: "a".repeat(140),
    });
    expect(normalizeDescription("a".repeat(141), SERVICE_DESCRIPTION_MAX)).toEqual({
      ok: false,
      error: "La descripción puede tener hasta 140 letras.",
    });
  });

  it("REQ-096.3 cuenta el largo después de limpiar (los espacios de sobra no cuentan)", () => {
    const raw = `  ${"a".repeat(70)}\n\n\n${"b".repeat(69)}  `;
    expect(normalizeDescription(raw, 140)).toEqual({
      ok: true,
      value: `${"a".repeat(70)} ${"b".repeat(69)}`,
    });
  });

  it("REQ-096.3 cuenta letras con tilde y emojis como un carácter, igual que la base de datos", () => {
    expect(normalizeDescription("é".repeat(140), 140).ok).toBe(true);
    expect(normalizeDescription("💈".repeat(140), 140).ok).toBe(true);
    expect(normalizeDescription("💈".repeat(141), 140).ok).toBe(false);
  });

  it("REQ-097.2 el negocio acepta hasta 200 caracteres y rechaza 201 con el mensaje", () => {
    expect(BUSINESS_DESCRIPTION_MAX).toBe(200);
    expect(normalizeDescription("b".repeat(200), BUSINESS_DESCRIPTION_MAX).ok).toBe(true);
    expect(normalizeDescription("b".repeat(201), BUSINESS_DESCRIPTION_MAX)).toEqual({
      ok: false,
      error: "La descripción puede tener hasta 200 letras.",
    });
  });
});
