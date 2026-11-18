import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { normalizeDescription } from "@/lib/domain/description";
import { parseProductForm } from "@/lib/domain/product-form";

/**
 * T-261 / T-263 · los textos nuevos del Hito 23 son los de los CA, en español (REQ-096.7,
 * REQ-097.5, NFR-006). `pnpm lint:texts` cubre todo el JSX; aquí se fijan los literales.
 */
const ENGLISH =
  /(?<!\p{L})(Description|Optional|Save|Business|Service|characters|letters)(?!\p{L})/u;
const read = (p: string) => readFileSync(p, "utf8");

describe("textos del Hito 23", () => {
  it("REQ-096.7 la hoja de servicio y el error de largo están en español", () => {
    const form = read("src/components/admin/ItemForms.tsx");
    expect(form).toContain('label="Descripción"');
    expect(form).toContain('help="Opcional. La ve el cliente al escoger el servicio."');
    const error = normalizeDescription("a".repeat(141), 140);
    expect(error).toEqual({ ok: false, error: "La descripción puede tener hasta 140 letras." });
    expect(error.ok ? "" : error.error).not.toMatch(ENGLISH);
  });

  it("REQ-097.5 el campo de Negocio está en español", () => {
    const form = read("src/components/admin/SettingsForms.tsx");
    expect(form).toContain('label="Descripción del negocio"');
    expect(form).toContain('help="Opcional. Sale en la portada, debajo del nombre."');
    const error = normalizeDescription("b".repeat(201), 200);
    expect(error.ok ? "" : error.error).toBe("La descripción puede tener hasta 200 letras.");
  });

  it("REQ-098.6 el campo de producto y su error están en español", () => {
    const form = read("src/components/admin/ItemForms.tsx");
    expect(form).toContain('help="Opcional. La ve el cliente en el menú."');
    const parsed = parseProductForm(
      {
        name: "Cera",
        price: "1.000",
        forSale: true,
        isCourtesy: false,
        photoPath: null,
        description: "c".repeat(141),
      },
      "11111111-2222-4333-8444-555555555555",
    );
    expect(parsed).toEqual({ ok: false, error: "La descripción puede tener hasta 140 letras." });
    expect(parsed.ok ? "" : parsed.error).not.toMatch(ENGLISH);
  });
});
