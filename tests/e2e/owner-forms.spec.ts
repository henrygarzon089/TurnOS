import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner } from "./helpers";

/** Fallas que vio Henry probando Gamma Club (2026-11-13): hojas, guardar y casillas. */
test.describe("REQ-078.34…36 hojas y formularios del dueño", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("REQ-078.34 la hoja se cierra con Cerrar ventana, con Esc y tocando el fondo", async ({
    page,
  }) => {
    await page.goto("/admin/productos");
    const sheet = page.getByRole("dialog", { name: "Nuevo producto" });
    const open = page.getByRole("button", { name: "Nuevo producto" });

    await open.click();
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "Cerrar ventana" }).click();
    await expect(sheet).toBeHidden();

    await open.click();
    await expect(sheet).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();

    await open.click();
    await expect(sheet).toBeVisible();
    // La hoja está abajo: arriba a la izquierda solo hay fondo oscuro
    await page.mouse.click(5, 5);
    await expect(sheet).toBeHidden();
  });

  test("REQ-078.35 el producto nuevo aparece en la lista sin recargar", async ({ page }) => {
    const name = `Prueba ${Date.now() % 100000}`;
    await page.goto("/admin/productos");
    await page.getByRole("button", { name: "Nuevo producto" }).click();
    const sheet = page.getByRole("dialog", { name: "Nuevo producto" });
    await sheet.getByLabel("Producto", { exact: true }).fill(name);
    await sheet.getByLabel("Precio", { exact: true }).fill("3000");
    await sheet.getByRole("button", { name: "Agregar producto" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText(name, { exact: true })).toBeVisible();
    await adminDb().from("products").delete().eq("name", name);
  });

  test("REQ-078.35 fidelidad conserva lo guardado sin recargar", async ({ page }) => {
    await page.goto("/admin/fidelidad");
    const visits = page.getByLabel("Visitas para el premio");
    const before = await visits.inputValue();
    const other = before === "9" ? "11" : "9";
    await visits.fill(other);
    await page.getByRole("button", { name: "Guardar tarjeta" }).click();
    await expect(page.getByRole("status")).toContainText("Tarjeta guardada");
    // Antes, React limpiaba el formulario y volvía a mostrar el valor viejo
    await expect(visits).toHaveValue(other);
    await expect(page.getByLabel("Tarjeta de fidelidad activa")).toBeChecked();
    await page.reload();
    await expect(page.getByLabel("Visitas para el premio")).toHaveValue(other);

    await page.getByLabel("Visitas para el premio").fill(before);
    await page.getByRole("button", { name: "Guardar tarjeta" }).click();
    await expect(page.getByRole("status")).toContainText("Tarjeta guardada");
  });

  test("REQ-078.35 Negocio conserva el % guardado sin recargar", async ({ page }) => {
    await page.goto("/admin/negocio");
    const pct = page.getByLabel("Comisión por productos (%)");
    const before = await pct.inputValue();
    const other = before === "11" ? "13" : "11";
    await pct.fill(other);
    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText("Guardado.")).toBeVisible();
    await expect(pct).toHaveValue(other);

    await pct.fill(before);
    await page.getByRole("button", { name: "Guardar" }).first().click();
    await expect(page.getByText("Guardado.")).toBeVisible();
  });

  test("REQ-078.36 casillas en azul marino y campos de Negocio alineados", async ({ page }) => {
    await page.goto("/admin/fidelidad");
    const box = page.locator('input[type="checkbox"][name="counts"]').first();
    await expect(box).toHaveCSS("accent-color", "rgb(14, 30, 61)");

    await page.goto("/admin/negocio");
    const nums = page.getByTestId("business-numbers");
    const fields = ["Sillas", "Comisión por defecto (%)"].map((l) =>
      nums.getByLabel(l, { exact: true }),
    );
    for (const f of fields) await expect(f).toBeVisible();
    const tops = await Promise.all(fields.map(async (f) => Math.round((await f.boundingBox())!.y)));
    expect(tops[0]).toBe(tops[1]);
  });
});
