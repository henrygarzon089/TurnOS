import { expect, test } from "@playwright/test";
import { loginAsBarber, loginAsOwner } from "./helpers";

test.describe("REQ-018.6 eliminar datos del cliente (Ley 1581)", () => {
  test("REQ-018.6 el dueño elimina una ficha con doble confirmación y deja de aparecer", async ({
    page,
  }) => {
    await loginAsOwner(page);
    const suffix = Date.now().toString().slice(-7);
    const name = `Borrar ${suffix}`;

    // Ficha con un turno activo
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    const add = page.getByRole("dialog", { name: "Agregar cliente" });
    await add.getByLabel("Nombre").fill(name);
    await add.getByLabel("Celular (opcional)").fill(`313${suffix}`);
    await add.getByRole("button", { name: "Agregar" }).click();
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row).toBeVisible({ timeout: 15_000 });

    // Con turno activo no se puede eliminar
    await page.goto("/app/clientes");
    await page.getByLabel("Buscar cliente").fill(suffix.slice(-4));
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "Eliminar datos del cliente" }).click();
    let dialog = page.getByRole("dialog", { name: "Eliminar datos del cliente" });
    await dialog.getByRole("button", { name: "Sí, eliminar sus datos" }).click();
    await expect(dialog.getByRole("alert")).toContainText("turno activo");
    await dialog.getByRole("button", { name: "Cancelar" }).click();

    // Se cancela el turno y ahora sí
    await page.goto("/admin/fila");
    page.once("dialog", (d) => d.accept());
    await row.getByRole("button", { name: new RegExp(name) }).click();
    await row.getByRole("button", { name: "Cancelar turno" }).click();
    await expect(row).toBeHidden({ timeout: 15_000 });

    await page.goto("/app/clientes");
    await page.getByLabel("Buscar cliente").fill(suffix.slice(-4));
    await page.getByRole("link", { name: new RegExp(name) }).click();
    await page.getByRole("button", { name: "Eliminar datos del cliente" }).click();
    dialog = page.getByRole("dialog", { name: "Eliminar datos del cliente" });
    await expect(dialog).toContainText("no se puede deshacer");
    await dialog.getByRole("button", { name: "Sí, eliminar sus datos" }).click();

    await expect(page).toHaveURL(/\/app\/clientes\?eliminado=1$/);
    await expect(page.getByRole("status")).toContainText("Se eliminaron los datos");
    await page.getByLabel("Buscar cliente").fill(suffix.slice(-4));
    await expect(page.getByRole("link", { name: new RegExp(name) })).toHaveCount(0);
  });

  test("REQ-018.6 el barbero no ve la opción de eliminar", async ({ page }) => {
    await loginAsBarber(page, 0);
    await page.goto("/app/clientes");
    await page.getByLabel("Buscar cliente").fill("mateo");
    await page.getByRole("link", { name: /Mateo Londoño/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Mateo Londoño" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Eliminar datos del cliente" })).toHaveCount(0);
  });
});
