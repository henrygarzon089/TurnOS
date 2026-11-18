import { describe, expect, it, vi } from "vitest";

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteBeforeSend } from "@/components/site/SiteAnalytics";

describe("SEO y analítica de la web (REQ-101.7, REQ-101.8)", () => {
  it("REQ-101.7 robots deja indexar la web y no el personal ni las páginas con token", () => {
    const r = robots();
    const rules = Array.isArray(r.rules) ? r.rules[0] : r.rules;
    expect(rules.allow).toBe("/");
    for (const p of ["/admin", "/app", "/entrar", "/t/", "/c/", "/regalo/"])
      expect(rules.disallow).toContain(p);
    expect(r.sitemap).toBe("https://www.gammaclub.co/sitemap.xml");
  });

  it("REQ-101.7 el sitemap lleva la web y la página pública del negocio", () => {
    vi.stubEnv("TURNOS_HOME_SLUG", "");
    const urls = sitemap().map((u) => u.url);
    expect(urls).toEqual([
      "https://www.gammaclub.co/",
      "https://www.gammaclub.co/gamma-club",
      "https://www.gammaclub.co/gamma-club/cita",
    ]);
    vi.unstubAllEnvs();
  });

  it("REQ-101.8 la analítica envía la portada sin query y descarta el personal y los tokens", () => {
    expect(siteBeforeSend({ type: "pageview", url: "https://www.gammaclub.co/?utm=x#a" })).toEqual({
      type: "pageview",
      url: "https://www.gammaclub.co/",
    });
    expect(
      siteBeforeSend({ type: "pageview", url: "https://www.gammaclub.co/gamma-club/cita" }),
    ).not.toBeNull();
    for (const p of ["/admin/caja", "/app/fila", "/entrar", "/t/abc123", "/c/xyz"])
      expect(siteBeforeSend({ type: "pageview", url: `https://www.gammaclub.co${p}` })).toBeNull();
  });
});
