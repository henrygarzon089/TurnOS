import { describe, expect, it } from "vitest";
import { parseGoogleReviewUrl } from "@/lib/domain/review-link";

describe("REQ-036.1 validación del enlace de reseñas de Google", () => {
  it("REQ-036.1 acepta enlaces https:// y quita los espacios", () => {
    const url = "https://g.page/r/CabcDEF123/review";
    expect(parseGoogleReviewUrl(url)).toEqual({ ok: true, url });
    expect(parseGoogleReviewUrl(`  ${url}  `)).toEqual({ ok: true, url });
    expect(parseGoogleReviewUrl("https://maps.app.goo.gl/AbC123?g_st=ic")).toEqual({
      ok: true,
      url: "https://maps.app.goo.gl/AbC123?g_st=ic",
    });
  });

  it("REQ-036.1 pasa el esquema a minúsculas: la base solo admite ^https://", () => {
    expect(parseGoogleReviewUrl("HTTPS://g.page/r/abc/review")).toEqual({
      ok: true,
      url: "https://g.page/r/abc/review",
    });
  });

  it("REQ-036.1 vacío significa quitar el enlace", () => {
    expect(parseGoogleReviewUrl("")).toEqual({ ok: true, url: null });
    expect(parseGoogleReviewUrl("   ")).toEqual({ ok: true, url: null });
  });

  it("REQ-036.1 rechaza lo que no sea un enlace https://", () => {
    for (const bad of [
      "http://g.page/r/abc/review",
      "g.page/r/abc/review",
      "javascript:alert(1)",
      "ftp://g.page/abc",
      "https://",
      "https://sin-punto",
      "https://con espacio.com/x",
      "mi barbería",
    ]) {
      expect(parseGoogleReviewUrl(bad), bad).toEqual({ ok: false });
    }
  });

  it("REQ-036.1 rechaza enlaces de más de 500 caracteres (límite de la base)", () => {
    const base = "https://g.page/";
    expect(parseGoogleReviewUrl(base + "a".repeat(500 - base.length)).ok).toBe(true);
    expect(parseGoogleReviewUrl(base + "a".repeat(501 - base.length))).toEqual({ ok: false });
  });
});
