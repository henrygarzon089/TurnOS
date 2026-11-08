import { expect, test, type Page } from "@playwright/test";
import { maskPhone } from "../../src/lib/domain/phone";
import { adminDb, loginAsOwner, SEED } from "./helpers";
import { noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-167 · REQ-078 en el local y la configuración del dueño (design §22.4, §22.5; tableros
 * Dueno-Local y Dueno-Config): un solo botón principal, sin píldoras, lo destructivo con
 * confirmación, celulares de barberos enmascarados y vacíos que dicen qué hacer.
 */

const ROUTES = [
  "/admin/limpieza",
  "/admin/productos",
  "/admin/inventario",
  "/admin/inventario/catalogo",
  "/admin/inventario/conteo",
  "/admin/inventario/compra",
  "/admin/inventario/costos",
  "/admin/barberos",
  "/admin/servicios",
  "/admin/horario",
  "/admin/qr",
  "/admin/mensajes",
  "/admin/negocio",
  "/admin/privacidad",
];

const ACCENT = "rgb(194, 30, 47)"; // --color-accent (#C21E2F)

/** Botones o enlaces con forma de píldora o con rojo relleno (REQ-078.3). */
async function pillsAndRedActions(page: Page) {
  return page.evaluate((accent) => {
    return [...document.querySelectorAll<HTMLElement>("main button, main a")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        const s = getComputedStyle(el);
        const pill = parseFloat(s.borderTopLeftRadius) >= Math.min(r.height, r.width) / 2;
        return pill || s.backgroundColor === accent;
      })
      .map((el) => `${el.tagName} "${(el.textContent ?? "").trim().slice(0, 30)}"`);
  }, ACCENT);
}

async function barberPct(name: string) {
  const { data } = await adminDb()
    .from("barbers")
    .select("commission_pct")
    .eq("display_name", name)
    .single();
  return Number(data!.commission_pct);
}

async function setBarberPct(name: string, pct: number) {
  await adminDb().from("barbers").update({ commission_pct: pct }).eq("display_name", name);
}

test.describe("T-167 local y configuración del dueño con el sistema visual (REQ-078)", () => {
  test.use({ serviceWorkers: "block" });

  test("REQ-078.15 las pantallas del local y la configuración no se desplazan de lado", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginAsOwner(page);
    for (const path of ROUTES) await noHorizontalScroll(page, path);
  });

  test("REQ-078.4 cada pantalla tiene a lo más un botón principal, sin píldoras ni botones chicos", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await loginAsOwner(page);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of ROUTES) {
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const at = `${path} a ${width} px`;
        expect(await primaryButtons(page), at).toBeLessThanOrEqual(1);
        expect(await smallTargets(page), at).toEqual([]);
        expect(await pillsAndRedActions(page), at).toEqual([]);
      }
    }
  });

  test("REQ-078.6 los celulares de los barberos van enmascarados en la lista", async ({ page }) => {
    await loginAsOwner(page);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto("/admin/barberos");
      const juan = page.getByRole("article", { name: "Barbero Juan" });
      await expect(juan).toContainText(maskPhone("+573001000001"));
      const text = (await page.locator("main").innerText()).replace(/\s/g, "");
      for (const b of SEED.barbers) expect(text).not.toContain(b.phone.replace(/\s/g, ""));
    }
  });

  test("REQ-078.3 cambiar el % de un barbero pide confirmación y no cambia si se dice que no", async ({
    page,
  }) => {
    const name = "Luis";
    const before = await barberPct(name);
    const next = before === 99 ? 98 : before + 1;
    await loginAsOwner(page);
    await page.goto("/admin/barberos");
    const card = page.getByRole("article", { name: `Barbero ${name}` });
    try {
      await card.getByRole("button", { name: "Editar" }).click();
      await card.getByLabel("Comisión (%)").fill(String(next));
      await card.getByRole("button", { name: "Guardar" }).click();
      const ask = page.getByRole("dialog", {
        name: `¿Cambiar la parte de ${name} de ${before} % a ${next} %?`,
      });
      await expect(ask).toBeVisible();
      await expect(ask.getByRole("button", { name: `Sí, cambiar a ${next} %` })).toBeVisible();
      await ask.getByRole("button", { name: `No, dejar ${before} %` }).click();
      await expect(ask).toBeHidden();
      expect(await barberPct(name)).toBe(before);

      await card.getByRole("button", { name: "Guardar" }).click();
      await ask.getByRole("button", { name: `Sí, cambiar a ${next} %` }).click();
      await expect.poll(() => barberPct(name)).toBe(next);
      await expect(card).toContainText(`${next} %`);
    } finally {
      await setBarberPct(name, before);
    }
  });

  test("REQ-078.3 guardar un barbero sin cambiar su % no pregunta", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/barberos");
    const card = page.getByRole("article", { name: "Barbero Luis" });
    await card.getByRole("button", { name: "Editar" }).click();
    await card.getByRole("button", { name: "Guardar" }).click();
    await expect(page.getByRole("dialog", { name: /¿Cambiar la parte/ })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Guardar" })).toHaveCount(0);
  });

  test("REQ-078.3 retirar a un barbero pide confirmación en contorno rojo", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/barberos");
    const card = page.getByRole("article", { name: "Barbero Luis" });
    await card.getByRole("button", { name: "Editar" }).click();
    await card.getByRole("button", { name: "Retirar…" }).click();
    const ask = page.getByRole("dialog", { name: "¿Retirar a Luis?" });
    await expect(ask).toContainText("su historial se conserva");
    const yes = ask.getByRole("button", { name: "Sí, retirar a Luis" });
    expect(await yes.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(ACCENT);
    await ask.getByRole("button", { name: "No, dejarlo" }).click();
    await expect(ask).toBeHidden();
    const { data } = await adminDb()
      .from("barbers")
      .select("is_active")
      .eq("display_name", "Luis")
      .single();
    expect(data!.is_active).toBe(true);
  });

  test("REQ-078.3 borrar los datos de un cliente pide confirmación y se puede echar atrás", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/app/clientes");
    await page.getByLabel("Buscar cliente").fill("mateo");
    await page.getByRole("link", { name: /Mateo Londoño/ }).click();
    await page.getByRole("button", { name: "Eliminar datos del cliente" }).click();
    const ask = page.getByRole("dialog", { name: "Eliminar datos del cliente" });
    await expect(ask).toContainText("no se puede deshacer");
    const yes = ask.getByRole("button", { name: "Sí, eliminar sus datos" });
    expect(await yes.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(ACCENT);
    await ask.getByRole("button", { name: "Cancelar" }).click();
    await expect(ask).toBeHidden();
    await expect(page.getByRole("heading", { level: 1, name: "Mateo Londoño" })).toBeVisible();
  });

  test("REQ-078.11 la privacidad dice dónde se borran los datos de un cliente que lo pide", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/privacidad");
    await expect(page.getByText(/abre su ficha en Clientes/)).toBeVisible();
    await expect(page.getByRole("link", { name: "Ir a Clientes" })).toHaveAttribute(
      "href",
      "/app/clientes",
    );
  });

  test("REQ-078.11 una categoría de productos vacía dice qué pasa y qué hacer", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/productos?categoria=Sin%20productos%20E2E");
    await expect(page.getByText("No hay productos en Sin productos E2E")).toBeVisible();
    await page.getByRole("link", { name: "Ver todos" }).click();
    await expect(page).toHaveURL(/\/admin\/productos$/);
  });
});
