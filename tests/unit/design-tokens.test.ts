import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { contrastRatio, parseThemeColors } from "@/lib/design/contrast";
import { PWA_BACKGROUND_COLOR, PWA_THEME_COLOR } from "@/lib/pwa";

const css = readFileSync("src/app/globals.css", "utf8");
const colors = parseThemeColors(css);

// [texto, fondo, mínimo]: design §22.1
const PAIRS: [string, string, number][] = [
  ["ink", "surface", 4.5],
  ["ink", "card", 4.5],
  ["muted", "card", 4.5],
  ["muted", "surface", 4.5],
  ["brand-ink", "brand", 4.5],
  ["brand", "brand-soft", 4.5],
  ["accent-ink", "accent", 4.5],
  ["accent-ink", "called", 4.5],
  ["accent-on-brand", "brand", 4.5],
  ["warn-on-brand", "brand", 4.5], // "En pausa" en el televisor (T-176, tablero Cliente-Pantalla)
  ["ok-on-brand", "brand", 4.5], // "Libre" en el televisor
  ["danger", "card", 4.5],
  ["danger", "accent-soft", 4.5],
  ["ok", "card", 4.5],
  ["ok", "ok-soft", 4.5],
  ["warn", "card", 4.5],
  ["warn", "warn-soft", 4.5],
  ["line-strong", "card", 3],
];

describe("REQ-078.2 contraste de los tokens", () => {
  it("contrastRatio da 21 para negro sobre blanco y 1 para el mismo color", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#0E1E3D", "#0e1e3d")).toBeCloseTo(1, 5);
  });

  it.each(PAIRS)("REQ-078.2 %s sobre %s cumple el mínimo", (fg, bg, min) => {
    expect(colors[fg], `falta --color-${fg}`).toBeDefined();
    expect(colors[bg], `falta --color-${bg}`).toBeDefined();
    expect(contrastRatio(colors[fg], colors[bg])).toBeGreaterThanOrEqual(min);
  });

  it("REQ-078.1 los colores del manifiesto salen de los mismos tokens", () => {
    expect(PWA_THEME_COLOR.toLowerCase()).toBe(colors.brand.toLowerCase());
    expect(PWA_BACKGROUND_COLOR.toLowerCase()).toBe(colors.surface.toLowerCase());
  });
});
