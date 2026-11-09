import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareDeployedCss, themeTokens } from "@/lib/design/deploy-css";

const theme = readFileSync("src/app/globals.css", "utf8");

// Lo que publica el build actual (Tailwind minificado: solo tokens usados, #ffffff → #fff)
const served =
  ":root,:host{--color-accent:#c21e2f;--color-accent-ink:#fff;--color-brand:#0e1e3d;" +
  "--color-card:#fff;--radius-md:10px;--radius-lg:20px}" +
  ".bg-brand{background-color:var(--color-brand)}";

// Lo que servía producción el 2026-11-08: el CSS de antes del Hito 16 (ADR-052)
const stale =
  ":root,:host{--color-accent:#1d4ed8;--color-called:#fef3c7;--radius-md:.375rem}" +
  ".bg-accent{background-color:var(--color-accent)}";

describe("REQ-078.26 CSS publicado igual al del build", () => {
  it("REQ-078.26 lee los tokens de color y esquinas del @theme", () => {
    const t = themeTokens(theme);
    expect(t.get("--color-brand")).toBe("#0e1e3d");
    expect(t.get("--color-card")).toBe("#ffffff");
    expect(t.get("--radius-md")).toBe("10px");
    expect(t.has("--shadow-overlay")).toBe(false);
  });

  it("REQ-078.26 pasa con el CSS del build (tokens usados, hex corto)", () => {
    expect(compareDeployedCss(theme, served)).toEqual([]);
  });

  it("REQ-078.26 falla con el CSS viejo y dice qué no coincide", () => {
    const problems = compareDeployedCss(theme, stale);
    expect(problems).toContain("--color-accent: publicado #1d4ed8, esperado #c21e2f");
    expect(problems).toContain("--color-called: publicado #fef3c7, esperado #c21e2f");
    expect(problems).toContain("--radius-md: publicado .375rem, esperado 10px");
    expect(problems).toContain("falta --color-brand");
    expect(problems).toContain("falta la regla .bg-brand");
  });

  it("REQ-078.26 falla si no llegó ningún CSS", () => {
    expect(compareDeployedCss(theme, "")).toContain("falta --color-brand");
  });
});
