import { expect, test } from "@playwright/test";
import { ADMIN_GROUPS } from "../../src/lib/domain/admin-nav";
import { loginAsOwner, waitForContent } from "./helpers";

/**
 * T-177 · marco del dueño (REQ-078.27, ADR-053, design §22.8). Proyecto "escritorio" (1280 px):
 * todas las pantallas del menú miden el mismo ancho de contenido (`lg:max-w-6xl`) y ninguna tabla
 * se corta. La barra azul va por encima del menú lateral y "Salir" vive en el menú del dueño; en el
 * celular, en "Más".
 */

const ROUTES = ADMIN_GROUPS.flatMap((g) => g.items.map((i) => i.href));

test.describe("T-177 marco del dueño en escritorio", () => {
  test.use({ serviceWorkers: "block" });
  test.skip(({ isMobile }) => isMobile, "solo escritorio");

  test.beforeEach(async ({ page }) => {
    await loginAsOwner(page);
  });

  test("REQ-078.27 todas las pantallas del dueño usan el mismo ancho y ninguna tabla se corta", async ({
    page,
  }) => {
    test.setTimeout(180_000); // 20 rutas, la primera compilación de cada una en dev
    expect(ROUTES).toHaveLength(20);
    const widths: Record<string, number> = {};
    for (const path of ROUTES) {
      await page.goto(path);
      await waitForContent(page);
      const m = await page.evaluate(() => {
        const main = document.querySelector("main")!;
        const cut = [...document.querySelectorAll<HTMLElement>("main table")]
          .map((t) => [t, t.parentElement!] as const)
          .flatMap(([t, box]) => [t, box])
          .filter((el) => el.scrollWidth > el.clientWidth + 1)
          .map((el) => el.tagName);
        return {
          width: Math.round(main.getBoundingClientRect().width),
          cut,
          pageScroll: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        };
      });
      widths[path] = m.width;
      expect(m.cut, `${path}: tabla cortada`).toEqual([]);
      expect(m.pageScroll, `${path}: desplazamiento horizontal`).toBe(false);
    }
    // 1280 − 240 del menú lateral − 32 de márgenes = 1008 px; todas iguales
    const distinct = [...new Set(Object.values(widths))];
    expect(distinct, JSON.stringify(widths)).toHaveLength(1);
    expect(distinct[0]).toBeGreaterThan(900);
  });

  test("REQ-078.27 el número de Fila en el menú es el mismo de esperando en Hoy", async ({
    page,
  }) => {
    await page.goto("/admin");
    const waiting = Number(await page.getByTestId("today-waiting").textContent());
    const fila = page
      .getByRole("navigation", { name: "Menú del dueño" })
      .getByRole("link", { name: /^Fila/ });
    if (waiting === 0) await expect(fila).toHaveText("Fila");
    else await expect(fila.getByLabel(`${waiting} esperando`)).toHaveText(String(waiting));
  });

  test("REQ-078.27 barra azul de 56 px por encima del menú lateral, con fecha y Salir en el menú del dueño", async ({
    page,
  }) => {
    const bar = page.locator("header").first();
    const box = (await bar.boundingBox())!;
    expect(box.height).toBe(56);
    expect(box.x).toBe(0);
    expect(box.width).toBe(1280);
    await expect(bar).toHaveCSS("background-color", "rgb(14, 30, 61)");
    await expect(bar).toContainText("Barbería La 33");
    await expect(
      bar.getByText(/^(Lunes|Martes|Miércoles|Jueves|Viernes|Sábado|Domingo) \d+ de /),
    ).toBeVisible();

    const side = page.getByRole("navigation", { name: "Menú del dueño" });
    expect((await side.boundingBox())!.y).toBe(56);

    await expect(bar.getByRole("button", { name: "Salir" })).toBeHidden();
    await bar.locator("summary").click();
    await bar.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/entrar/);
  });
});

test.describe("T-177 Salir en el celular", () => {
  test.use({ serviceWorkers: "block", viewport: { width: 390, height: 844 } });

  test("REQ-078.27 en el celular Salir está en Más y no en la barra", async ({ page }) => {
    await loginAsOwner(page);
    await expect(page.locator("header").getByRole("button", { name: "Salir" })).toBeHidden();
    await page.getByRole("button", { name: "Más" }).click();
    const sheet = page.getByRole("dialog", { name: "Todo el menú" });
    await sheet.getByRole("button", { name: "Salir" }).click();
    await expect(page).toHaveURL(/\/entrar/);
  });
});
