import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DescriptionField } from "@/components/admin/DescriptionField";

/** T-261 / T-263 · campo de descripción en "Servicios" y "Negocio" (REQ-096.1, REQ-097.1). */
describe("DescriptionField", () => {
  it("REQ-096.1 campo de varias líneas con etiqueta, ayuda y contador N/140", () => {
    const html = renderToStaticMarkup(
      <DescriptionField
        label="Descripción"
        help="Opcional. La ve el cliente al escoger el servicio."
        max={140}
        defaultValue="Corte con máquina"
      />,
    );
    expect(html).toMatch(/<textarea[^>]*name="description"/);
    expect(html).toMatch(/<textarea[^>]*maxLength="140"/);
    expect(html).toContain("Descripción");
    expect(html).toContain("Opcional. La ve el cliente al escoger el servicio.");
    expect(html).toContain("Corte con máquina</textarea>");
    expect(html).toMatch(/aria-live="polite"[^>]*>17\/140</);
  });

  it("REQ-096.1 al crear un servicio el campo arranca vacío con 0/140", () => {
    const html = renderToStaticMarkup(
      <DescriptionField label="Descripción" help="Opcional." max={140} />,
    );
    expect(html).toMatch(/<textarea[^>]*><\/textarea>/);
    expect(html).toMatch(/>0\/140</);
  });

  it("REQ-097.1 en Negocio el contador es N/200", () => {
    const html = renderToStaticMarkup(
      <DescriptionField
        label="Descripción del negocio"
        help="Opcional. Sale en la portada, debajo del nombre."
        max={200}
        defaultValue={null}
      />,
    );
    expect(html).toContain("Descripción del negocio");
    expect(html).toContain("Opcional. Sale en la portada, debajo del nombre.");
    expect(html).toMatch(/<textarea[^>]*maxLength="200"/);
    expect(html).toMatch(/>0\/200</);
  });
});
