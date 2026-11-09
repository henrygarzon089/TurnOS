import { expect, test, type Page } from "@playwright/test";
import { maskPhone } from "../../src/lib/domain/phone";
import { adminDb, loginAsOwner, SEED } from "./helpers";
import { noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-167 y T-181 · REQ-078 en el local y la configuración del dueño (design §22.4, §22.5; tableros
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

/** El título de la columna de una tabla del dueño: cabecera azul marino visible (REQ-078.33). */
async function brandHeader(page: Page, text: string) {
  return page.evaluate(
    ({ text, brand }) =>
      [...document.querySelectorAll<HTMLElement>("main [aria-hidden='true']")].some((el) => {
        const r = el.getBoundingClientRect();
        return (
          r.width > 0 &&
          getComputedStyle(el).backgroundColor === brand &&
          (el.textContent ?? "").includes(text)
        );
      }),
    { text, brand: "rgb(14, 30, 61)" },
  );
}

test.describe("T-181 local y configuración del dueño como el tablero (ADR-053, design §22.8)", () => {
  test.use({ serviceWorkers: "block" });

  test("REQ-078.20 ninguna pantalla del local ni de la configuración muestra un control del navegador", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of ROUTES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      const native = await page.evaluate(() =>
        [...document.querySelectorAll<HTMLInputElement>("main input")]
          .filter((el) => ["time", "date", "file"].includes(el.type))
          .filter((el) => {
            const r = el.getBoundingClientRect();
            return r.width > 1 && r.height > 1 && getComputedStyle(el).visibility !== "hidden";
          })
          .map((el) => `${el.type} ${el.name}`),
      );
      expect(native, path).toEqual([]);
    }
  });

  test("REQ-078.33 Barberos y Servicios son tablas con cabecera azul marino que caben en 1440 px", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const [path, column] of [
      ["/admin/barberos", "Servicios que hace"],
      ["/admin/servicios", "Visible al público"],
    ] as const) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await brandHeader(page, column), path).toBe(true);
      const cut = await page.evaluate(
        () =>
          [...document.querySelectorAll<HTMLElement>("main section")].filter(
            (el) => el.scrollWidth > el.clientWidth + 1,
          ).length,
      );
      expect(cut, path).toBe(0);
    }
  });

  test("REQ-078.33 Visible al público hace lo mismo que Activar y Desactivar", async ({ page }) => {
    const db = adminDb();
    const active = async () =>
      (await db.from("services").select("is_active").eq("name", "Cejas").single()).data!.is_active;
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/servicios");
    const visible = page.getByRole("switch", { name: "Cejas visible al público" });
    try {
      await expect(visible).toBeChecked();
      await visible.click();
      await expect.poll(active).toBe(false);
      await page.reload();
      await expect(
        page.getByRole("switch", { name: "Cejas visible al público" }),
      ).not.toBeChecked();
      await page.getByRole("switch", { name: "Cejas visible al público" }).click();
      await expect.poll(active).toBe(true);
    } finally {
      await db.from("services").update({ is_active: true }).eq("name", "Cejas");
    }
  });

  test("REQ-078.33 Horario con horas en español, interruptor Abierto y el QR al lado", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/horario");
    const opens = page.getByRole("combobox", { name: "Lunes: abre" });
    await expect(opens.locator("option", { hasText: "9:00 a. m." })).toHaveCount(1);
    await expect(opens.locator("option", { hasText: /AM|PM/ })).toHaveCount(0);
    await opens.selectOption("09:00");
    await expect(opens).toHaveValue("09:00");

    // Apagar el domingo: dice "Cerrado" y no hay horas; volver a encenderlo las devuelve
    const sunday = page.getByRole("group", { name: "Domingo" });
    await sunday.getByRole("switch", { name: "Domingo abierto" }).click();
    await expect(sunday.getByText("Cerrado")).toBeVisible();
    await expect(sunday.getByRole("combobox")).toHaveCount(0);
    await sunday.getByRole("switch", { name: "Domingo abierto" }).click();
    await expect(sunday.getByRole("combobox")).toHaveCount(2);

    // Lado a lado desde 1024 px
    const hours = await page.getByRole("region", { name: "Horario" }).boundingBox();
    const qr = await page.getByRole("region", { name: "QR del local" }).boundingBox();
    expect(Math.abs(hours!.y - qr!.y)).toBeLessThan(2);
    expect(qr!.x).toBeGreaterThan(hours!.x + hours!.width - 1);
  });

  test("REQ-078.33 Productos: filtros, comisión y Nuevo producto en una hilera y 5 columnas", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/productos");
    const vitrina = page.getByRole("region", { name: "Vitrina" });
    const commission = await vitrina.getByText("Comisión de productos:").boundingBox();
    const add = await vitrina.getByRole("button", { name: "Nuevo producto" }).boundingBox();
    expect(
      Math.abs(commission!.y + commission!.height / 2 - (add!.y + add!.height / 2)),
    ).toBeLessThan(8);
    const cols = await vitrina
      .locator("ul")
      .first()
      .evaluate((ul) => getComputedStyle(ul).gridTemplateColumns.split(" ").length);
    expect(cols).toBe(5);
  });

  test("REQ-078.33 Mensajes, Negocio y Privacidad van en 2 columnas desde 1024 px", async ({
    page,
  }) => {
    /** Las dos primeras tarjetas: arriba a la misma altura y una al lado de la otra. */
    const firstTwo = () =>
      page.locator("main [data-two-up]").evaluate((grid) => {
        const [a, b] = [...grid.children].map((c) => c.getBoundingClientRect());
        return { sameRow: Math.abs(a.top - b.top) < 2, sideBySide: b.left >= a.right };
      });
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const path of ["/admin/mensajes", "/admin/negocio", "/admin/privacidad"]) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await firstTwo(), path).toEqual({ sameRow: true, sideBySide: true });
    }
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto("/admin/negocio");
    await page.waitForLoadState("networkidle");
    expect(await firstTwo()).toEqual({ sameRow: false, sideBySide: false });
  });
});
