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
    // En el celular "Hoy" abre con su cabecera azul y oculta la barra del negocio (REQ-078.29,
    // design §22.8): el nombre del negocio nuevo está en la página, pero no a la vista.
    await expect(page.getByTestId("today-mobile-header")).toBeVisible();
    await expect(page.getByText(`Barbería E2E ${id}`)).toBeAttached();
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
    await page.getByLabel("Celular", { exact: true }).fill(phone);
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

  test("REQ-081.1 REQ-081.3 REQ-081.4 REQ-081.5 barbero con celular de Argentina: se crea, acepta y entra", async ({
    page,
    browser,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/barberos");
    const last = String(Math.floor(1000 + Math.random() * 8999));
    const typed = `+54 9 11 2345 ${last}`;
    const name = `Pedro E2E ${last}`;
    await page.getByRole("button", { name: "Nuevo barbero" }).click();
    await page.getByLabel("Nombre").fill(name);
    await page.getByLabel("País del celular").selectOption("other");
    await page.getByLabel("Celular", { exact: true }).fill(typed);
    await page.getByLabel("Comisión (%)").fill("50");
    await page.getByRole("button", { name: "Crear e invitar" }).click();
    const link = await page.getByTestId("invite-url").textContent();
    expect(link).toMatch(/\/invitacion\/[A-Za-z0-9_-]+$/);
    await page.getByRole("button", { name: "Listo" }).click();

    // REQ-081.5: en la lista sale con su indicativo y enmascarado
    await page.reload();
    const row = page.getByRole("article", { name: `Barbero ${name}` });
    await expect(row.getByText(`+54 *** ${last}`)).toBeVisible();

    // REQ-081.3: acepta la invitación con su número de otro país
    const ctx = await browser.newContext();
    const barberPage = await ctx.newPage();
    await barberPage.goto(link!);
    await barberPage.getByLabel("PIN (6 números)").fill("615243");
    await barberPage.getByLabel("Repite el PIN").fill("615243");
    await barberPage.getByRole("button", { name: "Crear mi acceso" }).click();
    await expect(barberPage).toHaveURL(/\/app\/fila/);
    await ctx.close();

    // REQ-081.4: entra desde /entrar con "Mi celular no es de Colombia"
    const ctx2 = await browser.newContext();
    const login = await ctx2.newPage();
    await login.goto("/entrar");
    await login.getByRole("button", { name: "Mi celular no es de Colombia" }).click();
    await login.getByLabel("Celular").fill(typed);
    await login.getByLabel("PIN (6 números)").fill("615243");
    await login.getByRole("button", { name: "Entrar" }).click();
    await expect(login).toHaveURL(/\/app\/fila/, { timeout: 15_000 });
    await ctx2.close();
  });

  test("REQ-030.2 un enlace inexistente muestra invitación no válida", async ({ page }) => {
    await page.goto("/invitacion/no-existe-123456");
    await expect(page.getByRole("heading", { name: "Invitación no válida" })).toBeVisible();
  });
});
