import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

test.describe("REQ-019 tarjeta de fidelidad", () => {
  test("REQ-019.1 activa la tarjeta con 10 visitas y premio Corte; REQ-019.6 cambiar a 8 no borra sellos", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/fidelidad");
    const total = page.getByTestId("stamps-total");
    const before = await total.textContent();

    await page.getByLabel("Tarjeta de fidelidad activa").check();
    await page.getByLabel("Visitas para el premio").fill("10");
    await page.getByLabel("Un servicio gratis").check();
    await page.getByLabel("Servicio que se regala").selectOption({ label: "Corte" });
    await page.getByRole("button", { name: "Guardar tarjeta" }).click();
    await expect(page.getByRole("status")).toContainText("Tarjeta guardada");

    await page.reload();
    await expect(page.getByLabel("Tarjeta de fidelidad activa")).toBeChecked();
    await expect(page.getByLabel("Visitas para el premio")).toHaveValue("10");
    await expect(page.getByLabel("Servicio que se regala")).toHaveValue(/.+/);

    await page.getByLabel("Visitas para el premio").fill("8");
    await page.getByRole("button", { name: "Guardar tarjeta" }).click();
    await expect(page.getByRole("status")).toContainText("Tarjeta guardada");
    await page.reload();
    await expect(page.getByLabel("Visitas para el premio")).toHaveValue("8");
    await expect(total).toHaveText(before ?? "");

    // Dejar el seed como estaba (10 visitas)
    await page.getByLabel("Visitas para el premio").fill("10");
    await page.getByRole("button", { name: "Guardar tarjeta" }).click();
    await expect(page.getByRole("status")).toContainText("Tarjeta guardada");
  });

  test("REQ-019.1 el premio de descuento exige un valor", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/fidelidad");
    await page.getByLabel("Un descuento en pesos").check();
    await page.getByLabel("Valor del descuento").fill("");
    await page.getByRole("button", { name: "Guardar tarjeta" }).click();
    await expect(page.getByText("Escribe el valor del descuento en pesos.")).toBeVisible();
  });
});
