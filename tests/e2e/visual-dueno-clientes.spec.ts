import { expect, test, type Page } from "@playwright/test";
import { loginAsOwner } from "./helpers";

/**
 * T-180 · REQ-078.33 los clientes del dueño como el tablero Dueno-Clientes (design §22.8):
 * Clientes en tabla con el celular enmascarado; Recordar como tabla Cliente · Por qué · WhatsApp;
 * Fidelidad y Recordar, y Membresías y Tarjetas de regalo, lado a lado desde 1024 px.
 */
test.describe("T-180 clientes del dueño como el tablero (REQ-078.33)", () => {
  test.use({ serviceWorkers: "block", viewport: { width: 1280, height: 900 } });

  async function headers(page: Page, table: string) {
    await expect(page.getByRole("table", { name: table })).toBeVisible();
    return (
      await page.getByRole("table", { name: table }).getByRole("columnheader").allTextContents()
    ).map((h) => h.trim());
  }

  /** Dos regiones en la misma hilera: una a la izquierda de la otra, arriba a la misma altura. */
  async function sideBySide(page: Page, left: string, right: string) {
    const a = await page.getByRole("region", { name: left, exact: true }).boundingBox();
    const b = await page.getByRole("region", { name: right, exact: true }).boundingBox();
    expect(a && b).toBeTruthy();
    expect(a!.x + a!.width).toBeLessThanOrEqual(b!.x);
    expect(Math.abs(a!.y - b!.y)).toBeLessThan(4);
  }

  test("REQ-078.33 Clientes del dueño es una tabla con el celular enmascarado", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/app/clientes");
    expect(await headers(page, "Tabla de clientes")).toEqual([
      "Nombre",
      "Celular",
      "Última vez",
      "Barbero habitual",
      "Cortes",
      "Fidelidad",
      "Membresía",
    ]);
    // Fidelidad X/10 de la tarjeta abierta (lectura aprobada por Henry, 2026-11-09)
    const stamps = await page
      .getByRole("table", { name: "Tabla de clientes" })
      .locator("tbody tr td:nth-child(6)")
      .allTextContents();
    expect(stamps.some((t) => /^\d+\/\d+$/.test(t))).toBe(true);
    const phones = await page
      .getByRole("table", { name: "Tabla de clientes" })
      .locator("tbody tr td:nth-child(2)")
      .allTextContents();
    expect(phones.length).toBeGreaterThan(0);
    for (const p of phones) expect(p).toMatch(/^\d{3} \*\*\* \d{4}$/);
    await expect(page.getByTestId("customers-count")).toContainText(/\d+ clientes?/);

    // Buscar por los últimos dígitos sigue funcionando (REQ-018.3)
    await page.getByLabel("Buscar cliente").fill("0005");
    await expect(page.getByRole("link", { name: /Mateo Londoño/ })).toBeVisible();
    await expect(page.getByText("+573002000005")).toHaveCount(0);
  });

  test("REQ-078.33 Recordar es la tabla Cliente · Por qué · WhatsApp, junto a Fidelidad", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/recordar");
    expect(await headers(page, "Para recordar")).toEqual(["Cliente", "Por qué", "WhatsApp"]);
    const first = page.getByRole("table", { name: "Para recordar" }).locator("tbody tr").first();
    await expect(first.getByRole("link", { name: /por WhatsApp/ })).toHaveText("WhatsApp");
    await sideBySide(page, "Fidelidad", "Recordar");

    await page.goto("/admin/fidelidad");
    await sideBySide(page, "Fidelidad", "Recordar");
  });

  test("REQ-078.33 Membresías y Tarjetas de regalo lado a lado, como tablas", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/membresias");
    await sideBySide(page, "Membresías", "Tarjetas de regalo");
    const families = page.getByRole("table", { name: "Familias" });
    if (await families.count())
      expect(await headers(page, "Familias")).toEqual(["Familia", "Usó", "Cuota"]);
    // "Editar plan" abre el plan en una hoja
    await page.getByRole("button", { name: "Editar plan" }).click();
    await expect(page.getByRole("dialog", { name: "Plan familiar" })).toBeVisible();
    await expect(page.getByLabel("Membresía activa")).toBeVisible();

    await page.goto("/admin/regalos");
    await sideBySide(page, "Tarjetas de regalo", "Membresías");
    const cards = page.getByRole("table", { name: "Tarjetas de regalo" });
    if (await cards.count())
      expect((await headers(page, "Tarjetas de regalo")).slice(0, 4)).toEqual([
        "N.º",
        "Para",
        "Valor",
        "Saldo",
      ]);
  });
});
