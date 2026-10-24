import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

const unique = () => Date.now().toString(36);

test.describe("REQ-030 alta de negocio e invitaciones", () => {
  test("REQ-030.1 un dueño nuevo crea cuenta y negocio en 3 pasos", async ({ page }) => {
    const id = unique();
    await page.goto("/crear-negocio");
    await expect(page.getByText("Paso 1 de 3")).toBeVisible();
    await page.getByLabel("Nombre del negocio").fill(`Barbería E2E ${id}`);
    await expect(page.getByLabel("Enlace de la fila")).toHaveValue(`barberia-e2e-${id}`);
    await page.getByLabel("Correo").fill(`dueno-${id}@e2e.test`);
    await page.getByLabel("Contraseña (mínimo 8)").fill("clave-segura-123");
    await page.getByRole("button", { name: "Crear negocio" }).click();

    await expect(page.getByText("Paso 2 de 3")).toBeVisible();
    await page.getByRole("button", { name: "Siguiente" }).click();

    await expect(page.getByText("Paso 3 de 3")).toBeVisible();
    await page.getByRole("button", { name: "Terminar" }).click();

    await expect(page).toHaveURL(/\/admin/);
    await expect(page.getByRole("heading", { name: `Barbería E2E ${id}` })).toBeVisible();
  });

  test("REQ-030.2 el dueño invita a un barbero y este crea su PIN y entra", async ({
    page,
    browser,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/barberos");
    const phone = `301${Math.floor(1000000 + Math.random() * 8999999)}`;
    await page.getByRole("button", { name: "Nuevo barbero" }).click();
    await page.getByLabel("Nombre").fill("Invitado E2E");
    await page.getByLabel("Celular").fill(phone);
    await page.getByLabel("Comisión (%)").fill("55");
    await page.getByRole("button", { name: "Crear e invitar" }).click();

    const link = await page.getByTestId("invite-url").textContent();
    expect(link).toMatch(/\/invitacion\/[A-Za-z0-9_-]+$/);

    // El barbero abre el enlace en otro navegador
    const ctx = await browser.newContext();
    const barberPage = await ctx.newPage();
    await barberPage.goto(link!);
    await expect(barberPage.getByRole("heading", { name: "Hola, Invitado E2E" })).toBeVisible();
    await barberPage.getByLabel("PIN (6 números)").fill("482913");
    await barberPage.getByLabel("Repite el PIN").fill("482913");
    await barberPage.getByRole("button", { name: "Crear mi acceso" }).click();
    await expect(barberPage).toHaveURL(/\/app\/fila/);

    // El mismo enlace ya no sirve
    await barberPage.goto(link!);
    await expect(barberPage.getByRole("heading", { name: "Invitación no válida" })).toBeVisible();
    await ctx.close();
  });

  test("REQ-030.2 un enlace inexistente muestra invitación no válida", async ({ page }) => {
    await page.goto("/invitacion/no-existe-123456");
    await expect(page.getByRole("heading", { name: "Invitación no válida" })).toBeVisible();
  });
});
