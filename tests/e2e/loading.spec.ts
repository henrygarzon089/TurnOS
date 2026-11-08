import { expect, test, type Page } from "@playwright/test";
import { loginAsBarber, loginAsOwner } from "./helpers";

/**
 * REQ-075.1 (design §19.1): esqueletos del personal. La consulta lenta es del servidor a Supabase,
 * así que no se simula frenando la red en la carga inicial: se navega dentro de la app y se demora
 * la petición de datos de la página (`?_rsc=`), y para el link directo se revisa el HTML inicial.
 */

/** Demora las peticiones `?_rsc=` (no los prefetch) de `path` hasta llamar a `release()`. */
async function holdRsc(page: Page, path: string) {
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await page.route(
    (url) => url.pathname === path && url.searchParams.has("_rsc"),
    async (route) => {
      if (!route.request().headers()["next-router-prefetch"]) await gate;
      await route.continue();
    },
  );
  return () => release();
}

const busy = (page: Page) => page.locator('[aria-busy="true"]');

test.describe("Hito 14 · esqueletos del personal", () => {
  test("REQ-075.1 barbero: navegando a Mi fila con datos lentos ve el esqueleto y después la fila", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    await page.getByRole("link", { name: "Clientes" }).click();
    await expect(page).toHaveURL(/\/app\/clientes/);
    await page.waitForLoadState("networkidle");

    const release = await holdRsc(page, "/app/fila");
    await page.getByRole("link", { name: "Mi fila" }).click();
    await expect(busy(page)).toBeVisible();
    await expect(busy(page).getByText("Cargando…")).toBeAttached();
    release();
    await expect(page.getByRole("heading", { name: "Mi fila" })).toBeVisible({ timeout: 10_000 });
    await expect(busy(page)).toHaveCount(0);
  });

  for (const [path, label, heading] of [
    ["/admin/fila", "Fila", "Fila"],
    ["/admin/caja", "Caja", "Caja de hoy"],
  ] as const) {
    test(`REQ-075.1 dueño: navegando a ${path} con datos lentos ve el esqueleto y después la pantalla`, async ({
      page,
    }) => {
      await loginAsOwner(page);
      if (path === "/admin/fila") {
        await page
          .getByRole("navigation", { name: "Accesos rápidos" })
          .getByRole("link", { name: "Caja" })
          .click();
        await expect(page).toHaveURL(/\/admin\/caja/);
      }
      await page.waitForLoadState("networkidle");

      const release = await holdRsc(page, path);
      await page
        .getByRole("navigation", { name: "Accesos rápidos" })
        .getByRole("link", { name: label, exact: true })
        .click();
      await expect(busy(page)).toBeVisible();
      release();
      await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible({
        timeout: 10_000,
      });
      await expect(busy(page)).toHaveCount(0);
    });
  }

  test("REQ-075.1 al abrir /app/fila directo el HTML inicial ya trae el esqueleto antes del contenido", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    const html = await (await page.request.get("/app/fila")).text();
    const skeleton = html.indexOf('aria-busy="true"');
    expect(skeleton).toBeGreaterThan(-1);
    // "Salir" es del encabezado, que se pinta cuando llega la sesión
    expect(skeleton).toBeLessThan(html.indexOf("Salir"));
  });

  test("REQ-075.1 sin sesión /app/fila sigue redirigiendo a /entrar", async ({ page }) => {
    await page.goto("/app/fila");
    await expect(page).toHaveURL(/\/entrar\?volver=%2Fapp%2Ffila/);
  });
});
