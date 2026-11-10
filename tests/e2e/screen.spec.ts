import { expect, test } from "@playwright/test";
import { SEED } from "./helpers";

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

  test("REQ-078.25 / REQ-078.16 como el tablero Cliente-Pantalla: marca, esperando, hora, columnas y QR", async ({
    browser,
  }) => {
    test.skip(!key, "E2E_SCREEN_KEY no definida");
    const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
    const page = await ctx.newPage();
    await page.goto(`/${SEED.slug}/pantalla?k=${key}`);
    // "● N esperando" con el local abierto; "Cerrado" fuera de horario (el seed cierra a las 23:59)
    await expect(page.getByText(/^\d+ esperando$|^Cerrado$/)).toBeVisible();
    await expect(page.getByText(/\d{1,2}:\d{2} [ap]\. m\./)).toBeVisible();
    await expect(page.getByText("Escanea para tomar turno")).toBeVisible();
    await expect(page.getByText("y espera en tu casa. Te avisamos por WhatsApp.")).toBeVisible();
    const lanes = page.locator("[data-lane]");
    expect(await lanes.count()).toBeGreaterThan(0);
    expect(await lanes.count()).toBeLessThanOrEqual(5);
    await expect(lanes.first()).toContainText(/Atendiendo|Llamando|En pausa|Libre/);
    // El espacio de la franja está reservado aunque no haya llamado (no salta lo de abajo)
    await expect(page.locator("[data-call-slot]")).toHaveCount(1);
    const box = await page.locator("[data-call-slot]").boundingBox();
    expect(Math.round(box!.height)).toBe(196);
    await ctx.close();
  });
});
