import { describe, expect, it } from "vitest";
import { privacyBlocks, privacyVersionLine } from "@/lib/domain/privacy";

describe("REQ-078.24 aviso de privacidad como el tablero (T-175)", () => {
  it("REQ-078.24 títulos en negrita: líneas que terminan en ':' o las preguntas del tablero", () => {
    const body = "Quién trata tus datos\nBarbería La 33.\n\nFinalidad:\nDarte turno.";
    expect(privacyBlocks(body)).toEqual([
      { kind: "heading", text: "Quién trata tus datos" },
      { kind: "text", text: "Barbería La 33." },
      { kind: "heading", text: "Finalidad:" },
      { kind: "text", text: "Darte turno." },
    ]);
  });

  it("REQ-078.24 un párrafo largo que termina en ':' no es título", () => {
    const long = `${"x".repeat(90)}:`;
    expect(privacyBlocks(long)).toEqual([{ kind: "text", text: long }]);
  });

  it("REQ-078.24 'vigente desde' con la fecha de publicación en Bogotá", () => {
    expect(privacyVersionLine(3, "2026-11-08T03:00:00Z")).toBe(
      "Versión 3 · vigente desde 7 de noviembre de 2026",
    );
  });
});
