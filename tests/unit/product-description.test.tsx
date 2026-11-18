import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { parseProductForm } from "@/lib/domain/product-form";
import { PRODUCT_DESCRIPTION_MAX } from "@/lib/domain/description";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/client", () => ({ createSupabaseBrowserClient: () => ({}) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: () => {} }) }));
vi.mock("@/lib/actions/admin", () => ({
  saveProduct: async () => undefined,
  toggleProduct: async () => undefined,
}));

const { ProductForm } = await import("@/components/admin/ItemForms");

/** T-271 · el dueño escribe la descripción del producto (REQ-098.1, REQ-098.2, ADR-072). */
const BIZ = "11111111-2222-4333-8444-555555555555";
const form = (over = {}) => ({
  name: "Cera mate",
  price: "25.000",
  forSale: true,
  isCourtesy: false,
  photoPath: null,
  ...over,
});
const PRODUCT = {
  id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
  name: "Cera mate",
  price: 25000,
  is_active: true,
  for_sale: true,
  is_courtesy: false,
  photo_path: null,
  commissionable: false,
  category: null,
  description: "Fijación fuerte y sin brillo",
};

describe("REQ-098 descripción del producto (formulario)", () => {
  it("REQ-098.1 al editar, campo Descripción con la ayuda del menú y contador N/140", () => {
    const html = renderToStaticMarkup(<ProductForm product={PRODUCT} businessId={BIZ} />);
    expect(html).toMatch(/<textarea[^>]*name="description"/);
    expect(html).toMatch(/<textarea[^>]*maxLength="140"/);
    expect(html).toContain("Opcional. La ve el cliente en el menú.");
    expect(html).toContain("Fijación fuerte y sin brillo</textarea>");
    expect(html).toMatch(/>28\/140</);
    // debajo de nombre y precio
    expect(html.indexOf('name="price"')).toBeLessThan(html.indexOf('name="description"'));
  });

  it("REQ-098.1 al crear un producto el campo también está, vacío", () => {
    const html = renderToStaticMarkup(<ProductForm businessId={BIZ} />);
    expect(html).toMatch(/<textarea[^>]*name="description"[^>]*><\/textarea>/);
    expect(html).toMatch(/>0\/140</);
  });

  it("REQ-098.2 limpia espacios y saltos de línea; vacía queda sin descripción", () => {
    expect(PRODUCT_DESCRIPTION_MAX).toBe(140);
    expect(
      parseProductForm(form({ description: "  Fijación \n fuerte   y sin brillo " }), BIZ),
    ).toMatchObject({ ok: true, row: { description: "Fijación fuerte y sin brillo" } });
    expect(parseProductForm(form({ description: " \n " }), BIZ)).toMatchObject({
      ok: true,
      row: { description: null },
    });
  });

  it("REQ-098.2 hasta 140 caracteres; con 141 no guarda y avisa", () => {
    expect(parseProductForm(form({ description: "a".repeat(140) }), BIZ)).toMatchObject({
      ok: true,
    });
    expect(parseProductForm(form({ description: "a".repeat(141) }), BIZ)).toEqual({
      ok: false,
      error: "La descripción puede tener hasta 140 letras.",
    });
  });

  it("REQ-098.2 si el formulario no trae el campo, la descripción no se toca", () => {
    const parsed = parseProductForm(form(), BIZ);
    expect(parsed.ok && "description" in parsed.row).toBe(false);
  });
});
