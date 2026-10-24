import { expect, test } from "@playwright/test";
import { loginAsBarber, loginAsOwner, SEED } from "./helpers";

/** T-050 · NFR que no tenían prueba con su nombre: NFR-002, NFR-007 (flujo del cliente), NFR-012. */
test.describe("NFR del MVP", () => {
  test("NFR-002 un cambio de la fila llega a otra pantalla en menos de 3 s (dos navegadores)", async ({
    browser,
  }) => {
    const o = await browser.newContext();
    const b = await browser.newContext();
    try {
      const owner = await o.newPage();
      const barber = await b.newPage();
      await loginAsOwner(owner);
      await loginAsBarber(barber, 0);
      const here = barber.getByRole("button", { name: "Estoy aquí" });
      if (await here.isVisible()) await here.click();
      await barber.waitForLoadState("networkidle");

      const name = `Tiempo real ${Date.now().toString().slice(-6)}`;
      await owner.goto("/admin/fila");
      await owner.getByRole("button", { name: "Agregar cliente" }).click();
      const add = owner.getByRole("dialog", { name: "Agregar cliente" });
      await add.getByLabel("Nombre").fill(name);
      await add.getByLabel("Barbero").selectOption({ label: "Juan" });
      const t0 = Date.now();
      await add.getByRole("button", { name: "Agregar" }).click();
      // Sin recargar la pantalla del barbero
      await expect(barber.getByRole("region", { name: "Siguen" }).getByText(name)).toBeVisible({
        timeout: 3000,
      });
      expect(Date.now() - t0).toBeLessThan(3000);

      // Limpieza
      const row = owner
        .getByRole("region", { name: "Turnos activos" })
        .getByRole("listitem")
        .filter({ hasText: name });
      owner.once("dialog", (d) => d.accept());
      await row.getByRole("button", { name: new RegExp(name) }).click();
      await row.getByRole("button", { name: "Cancelar turno" }).click();
    } finally {
      await o.close();
      await b.close();
    }
  });

  test("NFR-007 el flujo del cliente tiene ≤ 4 campos y 1 pantalla", async ({ page }) => {
    await page.goto(`/${SEED.slug}/turno`);
    const form = page.getByRole("form", { name: "Tomar turno" });
    // Campos: nombre, celular, servicio, barbero (+ la casilla de privacidad, REQ-002)
    await expect(form.getByRole("textbox")).toHaveCount(2); // nombre y celular
    await expect(form.getByLabel("Tu nombre")).toBeVisible();
    await expect(form.getByLabel("Tu celular (WhatsApp)")).toBeVisible();
    await expect(form.getByRole("group").filter({ hasText: "Servicio" })).toHaveCount(1);
    await expect(form.getByRole("group").filter({ hasText: "Barbero" })).toHaveCount(1);
    // Una sola pantalla: el botón de confirmar está en el mismo formulario
    await expect(form.getByRole("button", { name: "Confirmar turno" })).toBeVisible();
  });

  test("NFR-012 /salud confirma que la app y la base de datos responden", async ({ request }) => {
    const res = await request.get("/salud");
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, db: true });
    expect(res.headers()["cache-control"]).toContain("no-store");
  });
});
