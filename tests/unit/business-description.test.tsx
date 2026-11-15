import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PublicHero } from "@/components/public/PublicHero";

/** T-263 · descripción del negocio en la portada (REQ-097.3, REQ-097.4, ADR-070). */
const TEXT = "Barbería en Sabaneta. Cortes clásicos y modernos, barba y cejas.";

function hero(props: Partial<Parameters<typeof PublicHero>[0]> = {}) {
  return renderToStaticMarkup(
    <PublicHero
      name="Gamma Club"
      subtitle="Abierto hasta las 8:00 p. m."
      logoPath={null}
      coverPath={null}
      {...props}
    />,
  );
}

describe("REQ-097 descripción del negocio en la portada", () => {
  it("REQ-097.3 con descripción, la muestra completa en texto secundario debajo del nombre y el estado", () => {
    const html = hero({ description: TEXT });
    expect(html).toMatch(
      new RegExp(
        `data-testid="business-description"[^>]*class="[^"]*text-muted[^"]*"[^>]*>${TEXT}<`,
      ),
    );
    expect(html.indexOf("Gamma Club")).toBeLessThan(html.indexOf(TEXT));
    expect(html.indexOf("Abierto hasta")).toBeLessThan(html.indexOf(TEXT));
    // completa: sin recorte de una línea
    expect(html).not.toMatch(/data-testid="business-description"[^>]*truncate/);
  });

  it("REQ-097.3 en la cabecera compacta de los pasos no se muestra", () => {
    expect(hero({ description: TEXT, compact: true })).not.toContain(TEXT);
  });

  it("REQ-097.4 sin descripción, la portada se ve igual que hoy", () => {
    expect(hero({ description: null })).toBe(hero());
    expect(hero()).not.toContain("business-description");
  });
});
