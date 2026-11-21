import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BARBER_DESCRIPTION_MAX, normalizeDescription } from "@/lib/domain/description";
import { groupProductsByCategory } from "@/lib/domain/site";

vi.mock("server-only", () => ({}));

const { SiteHome } = await import("@/components/site/SiteHome");
type Data = Parameters<typeof SiteHome>[0]["data"];

/** T-320…T-322 · fotos protagonistas, "Ver más" y menú por categoría (REQ-103, ADR-082). */
function data(over: Partial<Data> = {}): Data {
  const business = {
    id: "b1",
    name: "Gamma Club",
    slug: "gamma-club",
    address: "Mall San Remo, Sabaneta",
    isOpen: true,
    nextOpening: null,
    closesAt: "20:00",
    description: null,
    services: [
      { id: "s1", name: "Corte", durationMin: 40, price: 30000, photoPath: "b1/services/corte.webp", description: "Corte a tijera o máquina" },
      { id: "s2", name: "Barba", durationMin: 20, price: 15000, photoPath: null, description: null },
    ],
    products: [],
    courtesies: [],
    logoPath: null,
    coverPath: null,
    waitingCount: 0,
    estimatedWaitMin: null,
  } as unknown as Data["business"];
  return {
    business,
    hours: [],
    loyalty: null,
    team: [
      { id: "x1", name: "Pedro", photoPath: "b1/barbers/pedro.webp", bio: "Experto en degradados" },
      { id: "x2", name: "Stiven", photoPath: null, bio: null },
    ],
    products: [
      { id: "p1", name: "Helado", price: 5000, photoPath: null, description: null, category: "Helados" },
      { id: "p2", name: "Cera", price: 25000, photoPath: null, description: null, category: "Cuidado del cabello" },
      { id: "p3", name: "Paleta", price: 4000, photoPath: null, description: null, category: "Helados" },
      { id: "p4", name: "Llavero", price: 8000, photoPath: null, description: null, category: null },
    ],
    courtesies: [],
    reviewUrl: null,
    canBook: true,
    jobsEnabled: false,
    ...over,
  };
}
const html = (d: Data = data()) => renderToStaticMarkup(<SiteHome data={d} />);
const section = (out: string, id: string) => {
  const i = out.indexOf(`id="${id}"`);
  return out.slice(i, out.indexOf("</section>", i));
};

describe("REQ-103 servicios y equipo con foto protagonista y Ver más", () => {
  it("REQ-103.1 la foto del servicio va arriba, grande, y nombre, precio y duración se ven sin abrir", () => {
    const s = section(html(), "servicios");
    const card = s.slice(s.indexOf('data-testid="service-card"'), s.indexOf("</li>"));
    expect(card).toMatch(/aspect-\[4\/5\]/);
    expect(card.indexOf("<img")).toBeLessThan(card.indexOf("Corte</h3>"));
    const summaryAt = card.indexOf("<details");
    for (const t of ["Corte</h3>", "$ 30.000", "40 min"]) expect(card.indexOf(t)).toBeLessThan(summaryAt);
  });

  it("REQ-103.2 con descripción hay Ver más (acordeón nativo de 48 px) que dice Ver menos abierto; sin descripción no hay", () => {
    const s = section(html(), "servicios");
    const cards = s.split('data-testid="service-card"').slice(1);
    expect(cards[0]).toMatch(/<details[^>]*>[\s\S]*<summary[^>]*min-h-12[^>]*>[\s\S]*Ver más[\s\S]*Ver menos[\s\S]*<\/summary>[\s\S]*Corte a tijera o máquina[\s\S]*<\/details>/);
    expect(cards[1]).not.toContain("<details");
    expect(cards[1]).not.toContain("Ver más");
  });

  it("REQ-103.4 la foto del barbero es lo principal y su descripción abre con Ver más; sin descripción, no", () => {
    const s = section(html(), "equipo");
    const cards = s.split('data-testid="team-card"').slice(1);
    expect(cards[0]).toMatch(/aspect-\[3\/4\]/);
    expect(cards[0]).toMatch(/<details[\s\S]*Ver más[\s\S]*Experto en degradados[\s\S]*<\/details>/);
    expect(cards[1]).toContain("Stiven");
    expect(cards[1]).not.toContain("<details");
  });

  it("REQ-103.6 el acordeón es nativo: se abre con teclado y lo anuncia el lector sin JavaScript", () => {
    const out = html();
    expect(out).not.toMatch(/<summary[^>]*(tabindex="-1"|aria-hidden="true")/);
    expect(out).toMatch(/<summary[^>]*>/);
  });
});

describe("REQ-103.5 menú por categoría", () => {
  it("REQ-103.5 agrupa en el orden del primer producto de cada categoría y deja Otros al final", () => {
    const p = data().products;
    expect(groupProductsByCategory(p).map((g) => [g.category, g.items.map((i) => i.id)])).toEqual([
      ["Helados", ["p1", "p3"]],
      ["Cuidado del cabello", ["p2"]],
      ["Otros", ["p4"]],
    ]);
  });

  it("REQ-103.5 la web muestra un subtítulo por categoría, con precio", () => {
    const s = section(html(), "productos");
    const heads = [...s.matchAll(/<h3[^>]*>([^<]+)<\/h3>/g)].map((m) => m[1]);
    expect(heads).toEqual(["Helados", "Cuidado del cabello", "Otros"]);
    expect(s).toContain("$ 25.000");
    expect(s).toContain("Lo que tenemos a la venta. Se paga en caja.");
  });

  it("REQ-103.5 con una sola categoría no sale subtítulo", () => {
    const one = data({
      products: [{ id: "p1", name: "Helado", price: 5000, photoPath: null, description: null, category: "Helados" }],
    });
    expect(section(html(one), "productos")).not.toMatch(/<h3[^>]*>Helados<\/h3>/);
  });
});

describe("REQ-103.3 descripción del barbero", () => {
  it("REQ-103.3 máximo 200 letras, sin espacios sobrantes; vacía es sin descripción", () => {
    expect(BARBER_DESCRIPTION_MAX).toBe(200);
    expect(normalizeDescription("  Experto   en degradados ", BARBER_DESCRIPTION_MAX)).toEqual({
      ok: true,
      value: "Experto en degradados",
    });
    expect(normalizeDescription("   ", BARBER_DESCRIPTION_MAX)).toEqual({ ok: true, value: null });
    expect(normalizeDescription("a".repeat(201), BARBER_DESCRIPTION_MAX).ok).toBe(false);
  });
});

describe("REQ-103.7 Productos y cortesía aparte", () => {
  const withCourtesy = () =>
    data({
      courtesies: [
        { id: "c1", name: "Tinto", photoPath: "b1/products/tinto.webp" },
        { id: "c2", name: "Agua", photoPath: null },
      ],
    });

  it("REQ-103.7 lo que se vende se llama Productos y ya no Algo rico", () => {
    const s = section(html(withCourtesy()), "productos");
    expect(s).toContain("Productos");
    expect(s).toContain("$ 25.000");
    expect(html()).not.toContain("Algo rico");
  });

  it("REQ-103.7 la cortesía sale aparte, sin precio y con foto", () => {
    const s = section(html(withCourtesy()), "cortesia");
    expect(s).toContain("Mientras esperas,");
    expect(s).toContain("te invitamos.");
    expect(s).toContain("Tinto");
    expect(s).toContain("Agua");
    expect(s).not.toMatch(/\$\s?\d/);
    expect(s).toMatch(/<img[^>]*alt="Tinto"/);
  });

  it("REQ-103.7 sin cortesías no sale el bloque", () => {
    expect(html()).not.toContain('id="cortesia"');
  });
});
