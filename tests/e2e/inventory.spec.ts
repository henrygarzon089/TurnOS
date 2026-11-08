import { expect, test, type Page } from "@playwright/test";
import { loginAsBarber, loginAsOwner, openBarberMore } from "./helpers";

/**
 * Hito 13 de punta a punta (design.md §18.7): el dueño crea un ítem, registra una entrada, repone
 * con envase vacío y cuenta la estación con alerta; el barbero ve "Mi estación".
 * Ítem con nombre nuevo en cada corrida: en local las corridas se acumulan en la misma base.
 */

/** Cuenta todo lo del sitio tal como está calculado ("Calculado: N"). */
async function countAsCalculated(page: Page) {
  const form = page.getByRole("form", { name: "Conteo" });
  await expect(form).toBeVisible();
  const items = form.getByRole("listitem");
  const n = await items.count();
  for (let i = 0; i < n; i++) {
    const row = items.nth(i);
    const calc = (await row.getByText(/^Calculado: /).textContent()) ?? "";
    await row.getByRole("textbox").first().fill(calc.match(/-?\d+/)![0]);
  }
  await form.getByRole("button", { name: "Guardar conteo" }).click();
}

/** Después de guardar, la página se refresca sola: navegar antes cortaba la navegación en WebKit. */
async function go(page: Page, url: string) {
  await page.waitForLoadState("networkidle");
  await page.goto(url);
}

async function movement(page: Page, tab: "Reponer" | "Entrada a bodega" | "Transferir") {
  await go(page, "/admin/inventario");
  await page.getByRole("tab", { name: tab }).click();
  return page.getByRole("form", { name: tab });
}

test.describe("REQ-070 / REQ-071 / REQ-073 / REQ-074 Inventario", () => {
  test("REQ-074.4 el dueño arma la dotación, repone, cuenta con alerta y el barbero ve Mi estación", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const name = `Cera E2E ${Date.now().toString().slice(-6)}`;
    const option = `${name} (Frasco 150 g)`;

    await loginAsOwner(page);

    // REQ-070.1 crear el ítem con dotación de 1 por estación
    await page.goto("/admin/inventario/catalogo");
    await page.getByText("Nuevo ítem", { exact: true }).click();
    const create = page.getByRole("form", { name: "Nuevo ítem" });
    await create.getByLabel("Nombre").fill(name);
    await create.getByLabel("Grupo").selectOption({ label: "Acabado" });
    await create.getByLabel("Presentación").fill("Frasco 150 g");
    await create.getByLabel("Unidad de conteo").fill("frasco");
    await create.getByLabel("Precio por unidad").fill("18.000");
    await create.getByLabel("Mínimo en bodega").fill("1");
    await create.getByLabel("Máximo en bodega").fill("5");
    await create.getByLabel("Dotación por estación").fill("1");
    await create.getByRole("button", { name: "Crear ítem" }).click();
    await expect(create.getByRole("status")).toHaveText("Guardado.", { timeout: 15_000 });

    // REQ-073.1 con rendimiento: deja de estar en "Midiendo" y puede alertar
    await page.reload();
    await page.getByText(name, { exact: true }).click();
    const usage = page.getByRole("form", { name: `Servicios que gastan ${name}` });
    await usage.getByRole("checkbox", { name: "Corte", exact: true }).check();
    await usage.getByLabel("Rendimiento de Corte", { exact: true }).fill("40");
    await usage.getByRole("button", { name: "Guardar servicios" }).click();
    await expect(usage.getByRole("status")).toHaveText("Servicios guardados.", { timeout: 15_000 });

    // REQ-071.2 entrada a bodega
    let form = await movement(page, "Entrada a bodega");
    await form.getByRole("combobox", { name: /^Ítem/ }).selectOption({ label: option });
    await form.getByLabel("Cantidad").fill("3");
    await form.getByLabel("Precio pagado por unidad").fill("18.000");
    await form.getByRole("button", { name: "Registrar entrada" }).click();
    await expect(form.getByRole("status")).toBeVisible({ timeout: 15_000 });

    // REQ-071.3 bodega → estación de Juan, hasta la dotación
    form = await movement(page, "Transferir");
    await form.getByRole("combobox", { name: /^Ítem/ }).selectOption({ label: option });
    await form.getByLabel("Desde").selectOption({ label: "Bodega" });
    await form.getByLabel("Hacia").selectOption({ label: "Estación de Juan" });
    await form.getByRole("button", { name: "Transferir" }).click();
    await expect(form.getByRole("status")).toBeVisible({ timeout: 15_000 });

    // Conteo de la estación: punto de partida de la ventana
    await go(page, "/admin/inventario/conteo");
    await page.getByRole("link", { name: "Juan", exact: true }).click();
    await countAsCalculated(page);
    await expect(page.getByRole("heading", { name: /guardado$/ })).toBeVisible({ timeout: 15_000 });

    // REQ-071.4 reponer exige el envase vacío
    form = await movement(page, "Reponer");
    await form.getByLabel("Barbero").selectOption({ label: "Juan" });
    await form.getByRole("combobox", { name: /^Ítem/ }).selectOption({ label: option });
    await form.getByLabel("Recibí el envase vacío").check();
    await form.getByRole("button", { name: "Reponer" }).click();
    await expect(form.getByRole("status")).toBeVisible({ timeout: 15_000 });

    // REQ-073.3 / REQ-073.4 conteo semanal: gastó 1 frasco sin cortes que lo expliquen → alerta
    await go(page, "/admin/inventario/conteo");
    await page.getByRole("link", { name: "Juan", exact: true }).click();
    await countAsCalculated(page);
    await expect(page.getByRole("heading", { name: "Conteo semanal guardado" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("listitem").filter({ hasText: name })).toContainText("Revisar");

    await go(page, "/admin/inventario");
    await expect(page.getByText(`Revisar con Juan: ${name}`)).toBeVisible();

    // REQ-074.4 el barbero ve su dotación, la reposición y el conteo, sin precios
    await page.context().clearCookies();
    await loginAsBarber(page, 0);
    await openBarberMore(page, "Mi estación");
    await expect(page.getByRole("heading", { name: "Mi estación" })).toBeVisible();
    const mine = page.getByRole("listitem").filter({ hasText: name });
    await expect(mine.first()).toContainText("1 de 1 frasco");
    await expect(page.getByText(`${name} · 1`)).toBeVisible();
    await expect(page.getByText("$")).toHaveCount(0);
  });
});
