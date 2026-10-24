import { expect, test } from "@playwright/test";
import { loginAsBarber, loginAsOwner, SEED } from "./helpers";

test.describe("REQ-030 acceso del personal", () => {
  test("REQ-030.1 dueño entra con correo y contraseña y llega a /admin", async ({ page }) => {
    await loginAsOwner(page);
    await expect(page.getByRole("heading", { name: "Barbería La 33" })).toBeVisible();
    await expect(page.getByText("Dueño")).toBeVisible();
  });

  test("ADR-010 barbero entra con celular y PIN y llega a su fila", async ({ page }) => {
    await loginAsBarber(page, 0);
    await expect(page.getByRole("heading", { name: "Mi fila" })).toBeVisible();
    await expect(page.getByText(`Barbero · ${SEED.barbers[0].name}`)).toBeVisible();
  });

  test("REQ-030.1 credenciales malas muestran error en español sin salir de /entrar", async ({
    page,
  }) => {
    await page.goto("/entrar");
    await page.getByLabel("Celular").fill("300 100 0001");
    await page.getByLabel("PIN (6 números)").fill("999999");
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page.getByRole("alert")).toHaveText("Celular o PIN incorrectos.");
    await expect(page).toHaveURL(/\/entrar/);
  });

  test("REQ-030.1 /admin sin sesión redirige a /entrar con retorno", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/entrar\?volver=%2Fadmin/);
  });

  test("REQ-030 barbero no entra a /admin (lo manda a /app)", async ({ page }) => {
    await loginAsBarber(page, 1);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/app\/fila/);
  });

  test("REQ-030.3 la sesión sobrevive a cerrar y reabrir el navegador", async ({
    page,
    context,
  }) => {
    await loginAsBarber(page, 2);
    const cookies = await context.cookies();
    const authCookie = cookies.find((c) => c.name.startsWith("sb-") && c.name.includes("auth"));
    expect(authCookie).toBeDefined();
    // 30 días de inactividad como mínimo
    const days = (authCookie!.expires * 1000 - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThanOrEqual(29);

    const page2 = await context.newPage();
    await page2.goto("/app/fila");
    await expect(page2.getByRole("heading", { name: "Mi fila" })).toBeVisible();
  });

  test("REQ-030.4 salir cierra la sesión", async ({ page }) => {
    await loginAsBarber(page, 3);
    await page.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/entrar/);
    await page.goto("/app/fila");
    await expect(page).toHaveURL(/\/entrar/);
  });
});
