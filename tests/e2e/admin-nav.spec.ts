import { expect, test } from "@playwright/test";
import { loginAsOwner } from "./helpers";

/**
 * Menú del dueño por grupos (T-150, design §21.4). En el celular: barra inferior y "Más"; en el
 * proyecto "escritorio" (1280 px): menú lateral fijo.
 */
const MODULES: [string, RegExp][] = [
  ["Fila", /\/admin\/fila/],
  ["Citas", /\/admin\/citas/],
  ["Caja", /\/admin\/caja/],
  ["Semana", /\/admin\/semana/],
  ["Clientes", /\/app\/clientes/],
  ["Fidelidad", /\/admin\/fidelidad/],
  ["Recordar", /\/admin\/recordar/],
  ["Membresías", /\/admin\/membresias/],
  ["Tarjetas de regalo", /\/admin\/regalos/],
  ["Limpieza", /\/admin\/limpieza/],
  ["Productos", /\/admin\/productos/],
  ["Inventario", /\/admin\/inventario/],
  ["Barberos", /\/admin\/barberos/],
  ["Servicios", /\/admin\/servicios/],
  ["Horario", /\/admin\/horario/],
  ["QR", /\/admin\/qr/],
  ["Mensajes", /\/admin\/mensajes/],
  ["Negocio", /\/admin\/negocio/],
  ["Privacidad", /\/admin\/privacidad/],
];

test.describe("menú del dueño en el celular", () => {
  test.skip(({ isMobile }) => !isMobile, "solo celular");

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("REQ-077.1 la barra inferior lleva a Fila, Caja y Clientes y marca dónde está", async ({
    page,
  }) => {
    const bar = page.getByRole("navigation", { name: "Accesos rápidos" });
    await expect(bar).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Menú del dueño" })).toBeHidden();
    await expect(bar.getByRole("link", { name: "Hoy" })).toHaveAttribute("href", "/admin");
    for (const [label, url] of [
      ["Caja", /\/admin\/caja/],
      ["Clientes", /\/app\/clientes/],
      ["Fila", /\/admin\/fila/],
    ] as const) {
      await bar.getByRole("link", { name: label }).click();
      await expect(page).toHaveURL(url, { timeout: 15_000 }); // primera compilación de la ruta en dev
      await expect(bar.getByRole("link", { name: label })).toHaveAttribute("aria-current", "page");
    }
  });

  test("REQ-077.1 Más abre los grupos y cada módulo se abre desde ahí", async ({ page }) => {
    test.setTimeout(120_000); // recorre los 19 módulos
    const bar = page.getByRole("navigation", { name: "Accesos rápidos" });
    for (const [label, url] of MODULES) {
      await bar.getByRole("button", { name: "Más" }).click();
      const sheet = page.getByRole("dialog", { name: "Todo el menú" });
      for (const group of ["Operación", "Clientes", "Local", "Configuración"])
        await expect(sheet.getByRole("heading", { name: group })).toBeVisible();
      await sheet.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url, { timeout: 15_000 }); // primera compilación de la ruta en dev
      await expect(sheet).toBeHidden();
    }
  });

  test("REQ-077.5 cada destino de la barra mide al menos 48 px", async ({ page }) => {
    const bar = page.getByRole("navigation", { name: "Accesos rápidos" });
    const targets = bar.locator("a, button");
    await expect(targets).toHaveCount(5);
    for (const box of await targets.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().height),
    ))
      expect(box).toBeGreaterThanOrEqual(48);
  });

  test("REQ-077.1 la barra no tapa el botón principal de la fila", async ({ page }) => {
    const add = page.getByRole("button", { name: "Agregar cliente" });
    const bar = page.getByRole("navigation", { name: "Accesos rápidos" });
    const [a, b] = [await add.boundingBox(), await bar.boundingBox()];
    expect(a!.y + a!.height).toBeLessThanOrEqual(b!.y + 1);
  });
});

test.describe("menú del dueño en escritorio", () => {
  test.skip(({ isMobile }) => isMobile, "solo escritorio");

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("REQ-077.2 el menú lateral muestra los grupos y lleva a cada módulo", async ({ page }) => {
    test.setTimeout(120_000); // recorre los 19 módulos
    const side = page.getByRole("navigation", { name: "Menú del dueño" });
    await expect(side).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Accesos rápidos" })).toBeHidden();
    for (const group of ["Operación", "Clientes", "Local", "Configuración"])
      await expect(side.getByRole("heading", { name: group })).toBeVisible();
    for (const [label, url] of MODULES) {
      await side.getByRole("link", { name: label, exact: true }).click();
      await expect(page).toHaveURL(url, { timeout: 15_000 }); // primera compilación de la ruta en dev
      await expect(side.getByRole("link", { name: label, exact: true })).toHaveAttribute(
        "aria-current",
        "page",
      );
    }
  });

  test("REQ-077.5 cada destino del menú lateral mide al menos 48 px", async ({ page }) => {
    const heights = await page
      .getByRole("navigation", { name: "Menú del dueño" })
      .getByRole("link")
      .evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
    expect(heights).toHaveLength(20);
    for (const h of heights) expect(h).toBeGreaterThanOrEqual(48);
  });
});
