import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

test.describe("REQ-015/016/017/033 administración del negocio", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("REQ-015.1 crea un servicio con duración múltiplo de 5 y precio entero", async ({
    page,
  }) => {
    await page.goto("/admin/servicios");
    const form = page.getByRole("form", { name: "Nuevo servicio" });
    const name = `Servicio E2E ${Date.now().toString(36)}`;
    await form.getByLabel("Servicio").fill(name);
    await form.getByLabel("Minutos").fill("22");
    await form.getByLabel("Precio").fill("12.000");
    await form.getByRole("button", { name: "Agregar servicio" }).click();
    // El campo tiene step=5: el navegador bloquea el envío antes de llegar al servidor (que
    // también lo valida con zod en admin.ts).
    const minutes = form.getByLabel("Minutos");
    expect(await minutes.evaluate((el: HTMLInputElement) => el.validity.stepMismatch)).toBe(true);
    await expect(page.getByRole("form", { name: `Servicio ${name}` })).toHaveCount(0);

    await form.getByLabel("Minutos").fill("25");
    await form.getByRole("button", { name: "Agregar servicio" }).click();
    await expect(page.getByRole("form", { name: `Servicio ${name}` })).toBeVisible();
  });

  test("REQ-015.2 desactivar un servicio lo deja visible pero apagado", async ({ page }) => {
    await page.goto("/admin/servicios");
    const cejas = page.getByRole("form", { name: "Servicio Cejas" });
    await cejas.getByRole("button", { name: "Desactivar" }).click();
    await expect(cejas.getByRole("button", { name: "Activar" })).toBeVisible();
    await cejas.getByRole("button", { name: "Activar" }).click();
    await expect(cejas.getByRole("button", { name: "Desactivar" })).toBeVisible();
  });

  test("REQ-024.1 crea un producto", async ({ page }) => {
    await page.goto("/admin/productos");
    const form = page.getByRole("form", { name: "Nuevo producto" });
    const name = `Producto E2E ${Date.now().toString(36)}`;
    await form.getByLabel("Producto").fill(name);
    await form.getByLabel("Precio").fill("3.500");
    await form.getByRole("button", { name: "Agregar producto" }).click();
    await expect(page.getByRole("form", { name: `Producto ${name}` })).toBeVisible();
  });

  test("REQ-016.4 marca a un barbero como presente hoy", async ({ page }) => {
    await page.goto("/admin/barberos");
    const card = page.getByRole("article", { name: "Barbero Mateo" });
    const hoy = card.getByLabel("Hoy");
    const was = await hoy.isChecked();
    await hoy.click();
    await expect(hoy).toBeChecked({ checked: !was });
    await expect(card.getByText(was ? "No está hoy" : "Disponible")).toBeVisible();
    await hoy.click();
    await expect(hoy).toBeChecked({ checked: was });
  });

  test("REQ-017.1 guarda el horario por día", async ({ page }) => {
    await page.goto("/admin/horario");
    await page.getByRole("button", { name: "Guardar horario" }).click();
    await expect(page.getByText("Horario guardado.")).toBeVisible();
  });

  test("REQ-033.1 edita una plantilla y ve la vista previa", async ({ page }) => {
    await page.goto("/admin/mensajes");
    const ta = page.getByLabel("Compartir la fila");
    await ta.fill("Hola {nombre}, toma turno en {negocio}: {enlace}");
    await expect(
      page.getByText("Hola Camilo, toma turno en Barbería La 33: https://turnos.app/t/abc123"),
    ).toBeVisible();
    await page.getByRole("button", { name: "Guardar plantillas" }).click();
    await expect(page.getByText("Plantillas guardadas.")).toBeVisible();
  });
});
