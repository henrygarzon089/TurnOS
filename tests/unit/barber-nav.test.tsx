import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BarberNav } from "@/components/staff/BarberNav";
import { BARBER_MORE, BARBER_TABS, isBarberMoreActive } from "@/lib/domain/barber-nav";

const nav = vi.hoisted(() => ({ pathname: "/app/fila" }));
vi.mock("next/navigation", () => ({ usePathname: () => nav.pathname }));

describe("T-163 menú del barbero (tablero Barbero-Fila)", () => {
  it("REQ-078.5 barra con Mi fila, Clientes, Números, Limpieza y Más; nada se pierde", () => {
    expect(BARBER_TABS.map((t) => t.href)).toEqual([
      "/app/fila",
      "/app/clientes",
      "/app/mis-numeros",
      "/app/limpieza",
    ]);
    // Lo que tenía la fila de enlaces de arriba sigue a un toque o dos
    const all = [...BARBER_TABS, ...BARBER_MORE].map((t) => t.href);
    for (const href of ["/app/mis-fotos", "/app/estacion"]) expect(all).toContain(href);
    expect(isBarberMoreActive("/app/estacion")).toBe(true);
    expect(isBarberMoreActive("/app/clientes/abc")).toBe(false);
  });

  it("REQ-078.5 cada destino mide ≥ 48 px, el actual lleva aria-current y deja espacio abajo", () => {
    nav.pathname = "/app/clientes/123";
    const h = renderToStaticMarkup(<BarberNav />);
    expect(h.match(/aria-current="page"/g)).toHaveLength(1);
    expect(h).toMatch(/<a[^>]*aria-current="page"[^>]*>[\s\S]*?Clientes/);
    for (const a of h.match(/<a [^>]*>/g)!) expect(a).toMatch(/h-14/);
    expect(h).toMatch(/<button[^>]*h-14[^>]*>[\s\S]*?Más/);
    expect(h).toContain('aria-label="Mis números"');
    expect(h).toContain("env(safe-area-inset-bottom)");
  });
});
