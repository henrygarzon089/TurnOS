import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsOwner, resetQueue, SEED } from "./helpers";
import { noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-165 · REQ-078 en la fila y la caja del dueño (design §22.4, §22.5; tableros Dueno-Fila,
 * Dueno-Caja y Dueno-Caja-Movil): carriles por barbero en escritorio y lista en el celular con
 * celulares enmascarados, caja en 390/768/1280, anular y cerrar caja con hoja de confirmación y
 * venta nueva con resaltado. T-179 (REQ-078.30, REQ-078.31, design §22.8): carriles de igual
 * ancho sin chips, "⋯", cobros pendientes en una fila, pestañas en el celular; caja con fecha,
 * "Cierres anteriores", tabla con buscador y filtros, y "Por barbero" con Total.
 */

async function businessId() {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function idOf(table: string, name: string, col = "name") {
  const { data } = await adminDb()
    .from(table)
    .select("id")
    .eq("business_id", await businessId())
    .eq(col, name)
    .single();
  return data!.id as string;
}

let seq = 0;
/** Turno tomado por la portada (service_role, como la acción pública); devuelve el celular. */
async function addTicket(name: string, barber: string | null = null) {
  const phone = `+57304${(Date.now() + seq++).toString().slice(-7)}`;
  const { error } = await adminDb().rpc("join_queue", {
    p_slug: SEED.slug,
    p_name: name,
    p_phone: phone,
    p_service_id: await idOf("services", "Corte"),
    p_preferred_barber_id: barber ? await idOf("barbers", barber, "display_name") : null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(error.message);
  return phone;
}

/** Venta de un corte de Juan por Nequi registrada "desde otro celular" (service_role). */
async function saleFromOutside(): Promise<string> {
  const { data, error } = await adminDb().rpc("register_sale", {
    p_business_id: await businessId(),
    p_ticket_id: null,
    p_barber_id: await idOf("barbers", "Juan", "display_name"),
    p_items: [{ kind: "service", ref_id: await idOf("services", "Corte"), qty: 1 }],
    p_payments: [{ method: "nequi", amount: 25000 }],
  });
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

/** La caja de hoy abierta (otra prueba pudo dejarla cerrada si falló a la mitad). */
async function cashOpen() {
  await adminDb()
    .from("cash_closures")
    .update({ status: "voided", reopen_reason: "E2E visual", voided_at: new Date().toISOString() })
    .eq("business_id", await businessId())
    .eq("status", "active")
    .eq("business_day", new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" }));
}

/** El barbero presente hoy (service_role): su carril sale aunque no tenga turnos. */
async function present(page: Page, barber: string) {
  await adminDb()
    .from("barbers")
    .update({ status: "available" })
    .eq("id", await idOf("barbers", barber, "display_name"))
    .eq("status", "off");
  await page.reload();
}

/** Abre el "⋯" de un turno y devuelve su menú. */
async function menuOf(page: Page, name: string) {
  await page.getByRole("button", { name: `Acciones para ${name}` }).click();
  return page.getByRole("group", { name: `Acciones para ${name}` });
}

/** Turno terminado con el cobro pendiente (service_role), como si el barbero tocara "Cobrar después". */
async function pendingPayment(name: string) {
  await addTicket(name, "Juan");
  const { error } = await adminDb()
    .from("tickets")
    .update({
      status: "done",
      payment_status: "pending",
      assigned_barber_id: await idOf("barbers", "Juan", "display_name"),
      called_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
    })
    .eq("customer_name", name);
  if (error) throw new Error(error.message);
}

test.describe("T-165 fila y caja del dueño con el sistema visual (REQ-078)", () => {
  // Comparten la fila y la caja del negocio del seed: una a la vez
  test.describe.configure({ mode: "default" });
  test.use({ serviceWorkers: "block" });
  test.beforeEach(resetQueue);

  test("REQ-078.15 la fila y la caja no se desplazan de lado en 360, 390 y 1280 px (caja también en 768)", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await addTicket("Visual Ancho Dueño", "Juan");
    await loginAsOwner(page);
    await noHorizontalScroll(page, "/admin/fila");
    await noHorizontalScroll(page, "/admin/caja", [360, 390, 768, 1280]);
  });

  test("REQ-078.4 la fila y la caja tienen a lo más un botón principal y botones de ≥ 48 px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await addTicket("Visual Botones Dueño");
    await loginAsOwner(page);
    for (const width of [390, 768, 1280])
      for (const path of ["/admin/fila", "/admin/caja"]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        expect(await primaryButtons(page), `${path} a ${width}`).toBeLessThanOrEqual(1);
        expect(await smallTargets(page), `${path} a ${width}`).toEqual([]);
      }
  });

  test("REQ-078.15 en escritorio la fila va por carriles (uno por barbero y el primero libre); en el celular, lista", async ({
    page,
  }) => {
    await addTicket("Carril Juan", "Juan");
    await addTicket("Carril Libre");
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/fila");
    await present(page, "Juan");

    const juan = page.getByRole("region", { name: "Carril de Juan" });
    const free = page.getByRole("region", { name: "El primero libre" });
    // En escritorio, nombre corto como el tablero ("Carril J.")
    await expect(juan.getByText("Carril J.")).toBeVisible();
    await expect(free.getByText("Carril L.")).toBeVisible();
    const a = (await juan.boundingBox())!;
    const b = (await free.boundingBox())!;
    expect(Math.abs(a.y - b.y)).toBeLessThan(2); // lado a lado
    expect(a.x).not.toEqual(b.x);

    await page.setViewportSize({ width: 390, height: 844 });
    const rows = page.getByRole("listitem").filter({ hasText: /Carril (Juan|Libre)/ });
    await expect(rows).toHaveCount(2);
    const r1 = (await rows.nth(0).boundingBox())!;
    const r2 = (await rows.nth(1).boundingBox())!;
    expect(r1.x).toEqual(r2.x); // una sola columna
    expect(r2.y).toBeGreaterThan(r1.y);
  });

  test("REQ-078.6 la fila del dueño muestra el celular enmascarado, nunca completo", async ({
    page,
  }) => {
    const phone = await addTicket("Visual Celular");
    await loginAsOwner(page);
    await page.goto("/admin/fila");
    const row = await menuOf(page, "Visual Celular");
    const local = phone.slice(3); // 304XXXXXXX
    await expect(row).toContainText(`${local.slice(0, 3)} *** ${local.slice(-4)}`);
    await expect(row).not.toContainText(local.slice(3, 6) + " " + local.slice(-4));
    await expect(page.locator("body")).not.toContainText(local);
  });

  test("REQ-078.3 cancelar un turno pide confirmación en una hoja y el botón va en contorno", async ({
    page,
  }) => {
    await addTicket("Visual Cancelar");
    await loginAsOwner(page);
    await page.goto("/admin/fila");
    const row = page.getByRole("listitem").filter({ hasText: "Visual Cancelar" });
    const cancel = (await menuOf(page, "Visual Cancelar")).getByRole("button", {
      name: "Cancelar turno",
    });
    expect(await cancel.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgb(194, 30, 47)",
    );
    await cancel.click();
    const sheet = page.getByRole("dialog", { name: /¿Cancelar el turno .* de Visual Cancelar\?/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "No, dejarlo" }).click();
    await expect(sheet).toBeHidden();
    await expect(row).toBeVisible();

    await (
      await menuOf(page, "Visual Cancelar")
    )
      .getByRole("button", { name: "Cancelar turno" })
      .click();
    await page.getByRole("button", { name: "Sí, cancelar turno" }).click();
    await expect(row).toBeHidden();
  });

  test("REQ-078.3 cerrar la fila por hoy pide confirmación en una hoja", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/fila");
    await page.getByRole("button", { name: "Cerrar fila por hoy" }).click();
    const sheet = page.getByRole("dialog", { name: "¿Cerrar la fila por hoy?" });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "No, dejarla abierta" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByText("Abierta", { exact: true })).toBeVisible();
  });

  test("REQ-078.12 el turno nuevo entra en la fila del dueño con resaltado sin mover lo de arriba", async ({
    page,
  }) => {
    await addTicket("Visual Dueño Primero");
    await loginAsOwner(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/fila");
    const first = page.getByText("Visual Dueño Primero");
    await expect(first).toBeVisible();
    const before = (await first.boundingBox())!.y;

    await addTicket("Visual Dueño Nuevo");
    const row = page.getByRole("listitem").filter({ hasText: "Visual Dueño Nuevo" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator(".animate-flash")).toHaveCount(1);
    expect((await first.boundingBox())!.y).toEqual(before);
  });

  test("REQ-078.12 la venta nueva entra con resaltado y REQ-078.3 anularla pide confirmación en una hoja", async ({
    page,
  }) => {
    await cashOpen();
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    await expect(page.getByTestId("cash-total")).toBeVisible();

    const saleId = await saleFromOutside();
    const row = page.getByTestId(`sale-${saleId}`);
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator(".animate-flash")).toHaveCount(1);

    await row.getByRole("button", { name: "Anular" }).click();
    const sheet = page.getByRole("dialog", { name: "Anular venta" });
    await expect(sheet).toBeVisible();
    const confirm = sheet.getByRole("button", { name: "Anular venta" });
    expect(await confirm.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgb(194, 30, 47)",
    );
    await sheet.getByLabel("Motivo").fill("Prueba visual");
    await confirm.click();
    await expect(sheet).toBeHidden();
    // La fila trae la celda del celular y las de escritorio: vale la que se ve
    await expect(row.locator(".line-through:visible").first()).toBeVisible();
  });

  test("REQ-078.3 cerrar caja abre una hoja con la diferencia y se puede salir sin cerrar", async ({
    page,
  }) => {
    await cashOpen();
    await loginAsOwner(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/caja");
    const expected = Number(
      ((await page.getByTestId("method-cash").textContent()) ?? "0").replace(/[^\d]/g, ""),
    );
    await page.getByRole("button", { name: "Cerrar caja" }).click();
    const sheet = page.getByRole("dialog", { name: "Cerrar caja" });
    await expect(sheet).toBeVisible();
    await sheet.getByLabel("Efectivo contado").fill(String(expected));
    await expect(sheet.getByTestId("close-difference")).toHaveText("Cuadra");
    expect(await primaryButtons(page)).toBe(1);
    await sheet.getByRole("button", { name: "Todavía no" }).click();
    await expect(sheet).toBeHidden();
    await expect(page.getByRole("button", { name: "+ Nueva venta" })).toBeVisible();
  });

  test("REQ-078.15 la caja en 768 px pone el resumen a la izquierda y las ventas a la derecha", async ({
    page,
  }) => {
    await cashOpen();
    await saleFromOutside();
    await loginAsOwner(page);
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.goto("/admin/caja");
    const summary = (await page
      .getByRole("region", { name: "Totales por medio de pago" })
      .boundingBox())!;
    const sales = (await page.getByRole("region", { name: "Ventas del día" }).boundingBox())!;
    expect(sales.x).toBeGreaterThan(summary.x + summary.width - 1);
  });
  test('REQ-078.30 los carriles miden lo mismo y un nombre largo en "El primero libre" no se parte', async ({
    page,
  }) => {
    await addTicket("Maximiliano Alejandro Bustamante Restrepo");
    await addTicket("Carril Igual Juan", "Juan");
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/admin/fila");
    await present(page, "Juan");

    await expect(page.getByRole("region", { name: "El primero libre" })).toBeVisible();
    const lanes = page.getByRole("region", { name: /^(Carril de |El primero libre)/ });
    const widths = await lanes.evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().width),
    );
    expect(widths.length).toBeGreaterThanOrEqual(2);
    for (const w of widths) expect(Math.abs(w - widths[0])).toBeLessThan(1.5);

    // Cada texto de la cabecera y de la fila queda en un solo renglón (no letra por letra)
    const free = page.getByRole("region", { name: "El primero libre" });
    for (const text of [
      free.getByText("El primero libre", { exact: true }),
      free.getByText("Maximiliano A."),
    ]) {
      const box = (await text.boundingBox())!;
      expect(box.height).toBeLessThan(30);
      expect(box.width).toBeGreaterThan(40);
    }
    await noHorizontalScroll(page, "/admin/fila", [1440]);
  });

  test("REQ-078.30 no hay hilera de chips: el estado va en el encabezado del carril", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/fila");
    await present(page, "Juan");
    await expect(page.getByRole("button", { name: /^Juan · / })).toHaveCount(0);
    const juan = page.getByRole("region", { name: "Carril de Juan" });
    await expect(juan.getByText(/\d+ en fila/)).toBeVisible();
    // El bloque fijo de 40 px bajo el encabezado dice qué pasa ahora
    const block = juan.getByRole("listitem").first();
    await expect(block).toHaveText(/Libre|Atiende|Llamó a|En pausa|No está/);
    expect((await block.boundingBox())!.height).toBeCloseTo(40, 0);
  });

  test('REQ-078.30 las acciones del turno van en el menú "⋯" flotante, sin empujar la fila', async ({
    page,
  }) => {
    await addTicket("Menu Primero");
    await addTicket("Menu Segundo");
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/fila");
    const second = page.getByRole("listitem").filter({ hasText: "Menu S." });
    const before = (await second.boundingBox())!.y;
    const menu = await menuOf(page, "Menu Primero");
    for (const action of ["Subir un puesto", "Bajar un puesto", "Llamar", "Cancelar turno"])
      await expect(menu.getByRole("button", { name: action })).toBeVisible();
    await expect(menu.getByLabel("Pasar a otro barbero")).toBeVisible();
    await expect(menu.getByLabel("Llamar con")).toBeVisible();
    expect((await second.boundingBox())!.y).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(menu).toBeHidden();
  });

  test("REQ-078.30 los cobros pendientes van en una sola fila que abre la lista y no empuja la fila", async ({
    page,
  }) => {
    await addTicket("Pendiente Visual Espera");
    await pendingPayment("Pendiente Visual Cobro");
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/fila");
    const row = page.getByRole("button", { name: /cobros? pendientes?$/ });
    await expect(row).toBeVisible();
    expect((await row.boundingBox())!.height).toBeLessThanOrEqual(64);
    // La lista no está en la página: solo la fila
    await expect(page.getByText("Pendiente Visual Cobro")).toHaveCount(0);
    await row.click();
    const sheet = page.getByRole("dialog", { name: "Cobros pendientes" });
    const item = sheet.getByRole("listitem").filter({ hasText: "Pendiente Visual Cobro" });
    await expect(item.getByRole("button", { name: "Cobrar" })).toBeVisible();
  });

  test('REQ-078.30 en el celular: pestañas Todos / <barbero> N y "Llamar al siguiente de <barbero>"', async ({
    page,
  }) => {
    await addTicket("Pestaña Juan", "Juan");
    await addTicket("Pestaña Libre");
    await loginAsOwner(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/admin/fila");
    await present(page, "Juan");
    await expect(page.getByRole("tab", { name: "Todos" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("button", { name: "Agregar cliente" })).toBeVisible();
    await expect(page.getByText("Pestaña Libre")).toBeVisible();

    await page.getByRole("tab", { name: /^Juan \d+$/ }).click();
    await expect(page.getByText("Pestaña Juan")).toBeVisible();
    await expect(page.getByText("Pestaña Libre")).toBeHidden();
    await expect(page.getByRole("button", { name: "Llamar al siguiente de Juan" })).toBeVisible();
    expect(await primaryButtons(page)).toBe(1);
  });

  test('REQ-078.31 la caja tiene junto al título la fecha y "Cierres anteriores"', async ({
    page,
  }) => {
    await cashOpen();
    await loginAsOwner(page);
    for (const width of [390, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto("/admin/caja");
      const title = (await page.getByRole("heading", { name: "Caja de hoy" }).boundingBox())!;
      const date = (await page.getByLabel("Ver la caja de otro día").boundingBox())!;
      expect(Math.abs(date.y + date.height / 2 - (title.y + title.height / 2))).toBeLessThan(20);
      await expect(page.getByRole("link", { name: "Cierres anteriores" })).toBeVisible();
    }
    await expect(
      page.locator("label").filter({ has: page.getByLabel("Ver la caja de otro día") }),
    ).toHaveText(/^(dom|lun|mar|mié|jue|vie|sáb) \d+ [a-z]+\.\s*▾$/);
    await expect(page.getByText("Transf. y tarjeta")).toBeVisible();
    await expect(page.getByText("Vitrina", { exact: true })).toBeVisible();
  });

  test("REQ-078.31 en escritorio las ventas son una tabla con buscador y filtros por barbero y medio", async ({
    page,
  }) => {
    await cashOpen();
    const saleId = await saleFromOutside();
    await loginAsOwner(page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/admin/caja");
    const sales = page.getByRole("region", { name: "Ventas del día" });
    for (const col of ["Hora", "Concepto", "Cliente", "Barbero", "Medio", "Valor"])
      await expect(sales.getByRole("columnheader", { name: col })).toBeVisible();
    const row = page.getByTestId(`sale-${saleId}`);
    await expect(row).toBeVisible();

    await sales.getByLabel("Barbero").selectOption("Juan");
    await expect(row).toBeVisible();
    await sales.getByLabel("Medio de pago").selectOption("Nequi");
    await expect(row).toBeVisible();
    await sales.getByLabel("Buscar cliente o concepto").fill("concepto que no existe");
    await expect(row).toBeHidden();
    await expect(sales.getByText("Ninguna venta coincide.")).toBeVisible();
    await sales.getByLabel("Buscar cliente o concepto").fill("corte");
    await expect(row).toBeVisible();

    const byBarber = page.getByRole("region", { name: "Por barbero" });
    for (const col of ["Barbero", "Serv.", "Comisión"])
      await expect(byBarber.getByRole("columnheader", { name: col })).toBeVisible();
    await expect(byBarber.getByRole("row").filter({ hasText: /^Total/ })).toBeVisible();
    await noHorizontalScroll(page, "/admin/caja", [1440]);
  });
});
