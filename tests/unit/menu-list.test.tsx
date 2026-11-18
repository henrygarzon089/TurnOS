import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MenuList } from "@/components/public/MenuSheet";

/** T-272 · descripción del producto en el menú (REQ-098.3, REQ-098.4, REQ-098.5, ADR-072). */
const TEXT = "Cera mate de fijación fuerte, sin brillo";
const product = (description?: string | null) => ({
  id: "p1",
  name: "Cera mate",
  price: 25000,
  photoPath: null,
  ...(description === undefined ? {} : { description }),
});
const menu = (description?: string | null) =>
  renderToStaticMarkup(<MenuList address={null} products={[product(description)]} />);

describe("REQ-098 descripción del producto en el menú", () => {
  it("REQ-098.3 con descripción, la muestra completa en texto secundario debajo del nombre", () => {
    const html = menu(TEXT);
    expect(html).toMatch(
      new RegExp(
        `data-testid="product-description"[^>]*class="[^"]*text-muted[^"]*text-sm[^"]*"[^>]*>${TEXT}<`,
      ),
    );
    expect(html).not.toMatch(/data-testid="product-description"[^>]*(truncate|line-clamp)/);
  });

  it("REQ-098.5 se lee nombre, después descripción y después precio", () => {
    const html = menu(TEXT);
    expect(html.indexOf("Cera mate<")).toBeLessThan(html.indexOf(TEXT));
    expect(html.indexOf(TEXT)).toBeLessThan(html.indexOf("25.000"));
  });

  it("REQ-098.4 sin descripción, la fila se ve igual que hoy", () => {
    expect(menu(null)).toBe(menu());
    expect(menu()).not.toContain("product-description");
  });
});
