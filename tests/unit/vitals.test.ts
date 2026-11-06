import { describe, expect, it } from "vitest";
import { redactVitalsUrl } from "@/lib/domain/vitals";

/** T-132 · la URL que se reporta a Speed Insights (design.md §19.2). */
const BASE = "https://turnos-smoky-nine.vercel.app";

describe("redactVitalsUrl (REQ-075.4)", () => {
  for (const [path, pattern] of [
    ["/t/abc123", "/t/[token]"],
    ["/c/k9Xz_-1", "/c/[token]"],
    ["/regalo/Q7w8e9", "/regalo/[token]"],
    ["/invitacion/z1y2x3", "/invitacion/[token]"],
  ] as const) {
    it(`REQ-075.4 ${path} se reporta como ${pattern}, nunca con el token`, () => {
      expect(redactVitalsUrl(`${BASE}${path}`)).toBe(`${BASE}${pattern}`);
    });
  }

  it("REQ-075.4 una ruta con token pierde el ?… y el #…", () => {
    expect(redactVitalsUrl(`${BASE}/t/abc123?x=1#arriba`)).toBe(`${BASE}/t/[token]`);
  });

  it("REQ-075.4 las subrutas del token también van con el patrón", () => {
    expect(redactVitalsUrl(`${BASE}/c/abc123/cancelar`)).toBe(`${BASE}/c/[token]/cancelar`);
  });

  it("REQ-075.4 una ruta sin token pasa igual, sin el query ni el fragmento", () => {
    expect(redactVitalsUrl(`${BASE}/filo?utm_source=qr#menu`)).toBe(`${BASE}/filo`);
    expect(redactVitalsUrl(`${BASE}/app/fila`)).toBe(`${BASE}/app/fila`);
  });

  it("REQ-075.4 un negocio llamado como el prefijo no se confunde con una ruta de token", () => {
    expect(redactVitalsUrl(`${BASE}/regalos`)).toBe(`${BASE}/regalos`);
  });

  it("REQ-075.4 una URL relativa o rara no rompe y tampoco deja el query", () => {
    expect(redactVitalsUrl("/t/abc?x=1")).toBe("/t/[token]");
    expect(redactVitalsUrl("")).toBe("");
  });
});
