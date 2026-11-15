import { expect, test } from "@playwright/test";
import { loginAsBarber, loginAsOwner, SEED } from "./helpers";
import { clsSlow4G, noHorizontalScroll } from "./visual-helpers";

/**
 * T-242 · Montserrat sin romper el ancho (REQ-091.5, design §27.2, §27.5): sin desplazamiento
 * horizontal en 360, 390 y 1280 px; los botones largos en una línea o más altos, sin cortar
 * palabras; el cambio de letra no mueve la página (CLS ≤ 0,1).
 */

/** Ninguna palabra de un botón queda partida: su texto cabe en el ancho del botón. */
async function noBrokenWords(page: import("@playwright/test").Page) {
  const broken = await page.evaluate(() =>
    [...document.querySelectorAll("button, a.btn-primary, a.btn-secondary")]
      .filter((b) => (b as HTMLElement).offsetParent !== null)
      .filter((b) => b.scrollWidth > b.clientWidth + 1)
      .map((b) => (b.textContent ?? "").trim()),
  );
  expect(broken).toEqual([]);
}

test.describe("REQ-091.5 Montserrat sin desplazamiento horizontal", () => {
  // Varias pantallas en tres anchos cada una
  test.describe.configure({ timeout: 120_000 });

  test("REQ-091.5 cliente: portada, pasos de tomar turno y Entrar", async ({ page }) => {
    for (const path of [
      `/${SEED.slug}`,
      `/${SEED.slug}?paso=servicio`,
      `/${SEED.slug}?paso=barbero`,
      "/entrar",
    ]) {
      await noHorizontalScroll(page, path);
      await noBrokenWords(page);
    }
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(font).toMatch(/^Montserrat/);
  });

  test("REQ-091.5 dueño: Hoy, Fila y Caja", async ({ page }) => {
    await loginAsOwner(page);
    for (const path of ["/admin", "/admin/fila", "/admin/caja"]) {
      await noHorizontalScroll(page, path);
      await noBrokenWords(page);
    }
  });

  test("REQ-091.5 barbero: Mi fila", async ({ page }) => {
    await loginAsBarber(page);
    await noHorizontalScroll(page, "/app/fila");
    await noBrokenWords(page);
  });

  test("REQ-091.5 el cambio a Montserrat no mueve la portada (CLS ≤ 0,1 con Slow 4G)", async ({
    page,
    browserName,
  }) => {
    test.skip(browserName !== "chromium", "la red lenta va por CDP");
    expect(await clsSlow4G(page, `/${SEED.slug}`)).toBeLessThanOrEqual(0.1);
  });
});
