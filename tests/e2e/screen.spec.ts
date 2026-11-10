import { expect, test } from "@playwright/test";
import { loginAsOwner, SEED } from "./helpers";

// La clave de pantalla del seed se lee de la base; en E2E la pasa la variable E2E_SCREEN_KEY.
const key = process.env.E2E_SCREEN_KEY;

test.describe("REQ-013 pantalla del televisor", () => {
  test("REQ-013.1 clave incorrecta → no encontrado", async ({ page }) => {
    await page.goto(`/${SEED.slug}/pantalla?k=clave-mala-123`);
    await expect(page.getByRole("heading", { name: "Negocio no encontrado" })).toBeVisible();
  });

  test("REQ-013.2 / REQ-013.3 muestra columnas por barbero, nombres abreviados y QR, a 1080p sin scroll", async ({
    browser,
  }) => {
    test.skip(!key, "E2E_SCREEN_KEY no definida");
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    const res = await page.goto(`/${SEED.slug}/pantalla?k=${key}`);
    expect(res?.headers()["x-robots-tag"]).toContain("noindex");
    await expect(page.getByRole("heading", { name: "Barbería La 33" })).toBeVisible();
    await expect(page.getByRole("img", { name: "QR para tomar turno" })).toBeVisible();
    const scrollable = await page.evaluate(
      () => document.documentElement.scrollHeight > window.innerHeight + 2,
    );
    expect(scrollable).toBe(false);
    const text = await page.locator("main").innerText();
    expect(text).not.toMatch(/\+57|300 \d{3}/);
    await ctx.close();
  });

  // T-183: el botón del dueño abría /<slug>/pantalla sin la clave → "Negocio no encontrado".
  test("REQ-013.1 desde la fila del dueño, Ver pantalla del televisor abre la pantalla con su clave", async ({
    page,
  }) => {
    test.skip(!key, "E2E_SCREEN_KEY no definida");
    await loginAsOwner(page);
    await page.goto("/admin/fila");
    const link = page.getByRole("link", { name: "Ver pantalla del televisor" });
    await expect(link).toHaveAttribute("href", `/${SEED.slug}/pantalla?k=${key}`);
    const [screen] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
    await expect(screen.getByRole("heading", { name: "Barbería La 33" })).toBeVisible();
    await expect(screen.getByRole("heading", { name: "Negocio no encontrado" })).toBeHidden();
  });
});
