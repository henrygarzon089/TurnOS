import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsOwner, resetQueue, SEED } from "./helpers";
import { noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-165 · REQ-078 en la fila y la caja del dueño (design §22.4, §22.5; tableros Dueno-Fila,
 * Dueno-Caja y Dueno-Caja-Movil): carriles por barbero en escritorio y lista en el celular con
 * celulares enmascarados, caja en 390/768/1280, anular y cerrar caja con hoja de confirmación y
 * venta nueva con resaltado.
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

async function present(page: Page, barber: string) {
  const b = page.getByRole("button", { name: new RegExp(`^${barber} ·`) });
  if ((await b.textContent())?.includes("No está")) await b.click();
  await expect(b).not.toContainText("No está");
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
    await expect(juan.getByText("Carril Juan")).toBeVisible();
    await expect(free.getByText("Carril Libre")).toBeVisible();
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
    const row = page.getByRole("listitem").filter({ hasText: "Visual Celular" });
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
    await row.getByRole("button", { name: /Visual Cancelar/ }).click();
    const cancel = row.getByRole("button", { name: "Cancelar turno" });
    expect(await cancel.evaluate((el) => getComputedStyle(el).backgroundColor)).not.toBe(
      "rgb(194, 30, 47)",
    );
    await cancel.click();
    const sheet = page.getByRole("dialog", { name: /¿Cancelar el turno .* de Visual Cancelar\?/ });
    await expect(sheet).toBeVisible();
    await sheet.getByRole("button", { name: "No, dejarlo" }).click();
    await expect(sheet).toBeHidden();
    await expect(row).toBeVisible();

    await row.getByRole("button", { name: "Cancelar turno" }).click();
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
    await expect(row.locator(".line-through").first()).toBeVisible();
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
});
