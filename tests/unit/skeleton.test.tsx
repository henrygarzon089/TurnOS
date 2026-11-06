import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SkeletonBlock, SkeletonScreen } from "@/components/ui/Skeleton";
import BusinessLoading from "@/app/(public)/[slug]/loading";
import TicketLoading from "@/app/(public)/t/[token]/loading";

/** Texto visible (sin etiquetas), sin el aviso para lectores de pantalla. */
function visibleText(html: string) {
  return html
    .replace(/<span class="sr-only">Cargando…<\/span>/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

const screens = [
  ["la página pública del negocio (/[slug])", BusinessLoading],
  ['"Mi turno" (/t/[token])', TicketLoading],
] as const;

describe("Skeleton (REQ-075)", () => {
  it("REQ-075.2 SkeletonScreen anuncia la carga con aria-busy y 'Cargando…' para lectores de pantalla", () => {
    const html = renderToStaticMarkup(
      <SkeletonScreen>
        <SkeletonBlock className="h-12 w-full" />
      </SkeletonScreen>,
    );
    expect(html).toContain('aria-busy="true"');
    expect(html).toContain('<span class="sr-only">Cargando…</span>');
  });

  it("REQ-075.2 SkeletonBlock solo se anima si el celular no pide menos movimiento (motion-safe:) y no lleva texto", () => {
    const html = renderToStaticMarkup(<SkeletonBlock className="h-12 w-full" />);
    expect(html).toContain("motion-safe:animate-pulse");
    expect(html).not.toMatch(/(^|\s|")animate-pulse/);
    expect(html).toContain("bg-line");
    expect(html).toContain("h-12 w-full");
    expect(visibleText(html)).toBe("");
  });

  for (const [name, Loading] of screens) {
    it(`REQ-075.1 ${name} tiene esqueleto con la forma de la pantalla (título, tarjeta, 3 filas, botón)`, () => {
      const html = renderToStaticMarkup(<Loading />);
      expect(html).toContain('aria-busy="true"');
      // título + tarjeta + 3 filas + botón primario = al menos 6 bloques grises
      expect(html.match(/bg-line/g)?.length ?? 0).toBeGreaterThanOrEqual(6);
      expect(html).not.toContain("spinner");
    });

    it(`REQ-075.2 ${name}: el esqueleto no muestra datos, cifras ni nombres de ejemplo`, () => {
      const html = renderToStaticMarkup(<Loading />);
      expect(visibleText(html)).toBe("");
      expect(html).not.toMatch(/\d+\s*(min|\$)|\$\s*\d/);
    });
  }
});
