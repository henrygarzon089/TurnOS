import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const fonts = readFileSync("src/app/fonts.ts", "utf8");
const layout = readFileSync("src/app/layout.tsx", "utf8");
const css = readFileSync("src/app/globals.css", "utf8");

describe("REQ-091.4 la letra es Montserrat", () => {
  it("REQ-091.4 se carga con next/font (servida desde el dominio de la app) en 400, 600 y 700", () => {
    expect(fonts).toMatch(/from "next\/font\/google"/);
    expect(fonts).toMatch(/Montserrat\(/);
    expect(fonts).toMatch(/weight: \["400", "600", "700"\]/);
    expect(fonts).toMatch(/subsets: \["latin"\]/);
    expect(fonts).toMatch(/display: "swap"/);
    expect(fonts).toMatch(/variable: "--font-montserrat"/);
    // la letra de reemplazo ajustada evita que el cambio mueva la página (CLS)
    expect(fonts).not.toMatch(/adjustFontFallback: false/);
  });

  it("REQ-091.4 la variable va en <html> y --font-sans empieza por Montserrat", () => {
    expect(layout).toMatch(/montserrat\.variable/);
    expect(css).toMatch(/--font-sans: var\(--font-montserrat\),/);
  });
});
