import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * T-244 · REQ-091.11: el CI corre Lighthouse móvil sobre la portada y Entrar con la letra nueva y
 * falla bajo 80 en rendimiento o 90 en accesibilidad. Aquí se prueba que esa vara no se baje.
 */
const rc = JSON.parse(readFileSync("lighthouserc.json", "utf8"));
const ci = readFileSync(".github/workflows/ci.yml", "utf8");

describe("REQ-091.11 Lighthouse con la marca nueva", () => {
  it("REQ-091.11 mide la portada y Entrar en móvil con rendimiento ≥ 80 y accesibilidad ≥ 90", () => {
    expect(rc.ci.collect.settings.preset).toBe("mobile");
    expect(rc.ci.collect.url.some((u: string) => u.endsWith("/la-33"))).toBe(true);
    expect(rc.ci.collect.url.some((u: string) => u.endsWith("/entrar"))).toBe(true);
    const a = rc.ci.assert.assertions;
    expect(a["categories:performance"]).toEqual(["error", { minScore: 0.8 }]);
    expect(a["categories:accessibility"]).toEqual(["error", { minScore: 0.9 }]);
    expect(a["installable-manifest"]).toBe("error");
  });

  it("REQ-091.11 el CI corre ese Lighthouse en cada PR", () => {
    expect(ci).toMatch(/lhci|lighthouse/i);
  });
});
