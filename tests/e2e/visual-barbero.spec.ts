import { expect, test, type Page } from "@playwright/test";
import { CALL, adminDb, loginAsBarber, resetQueue, SEED } from "./helpers";
import { clsSlow4G, noHorizontalScroll, primaryButtons, smallTargets } from "./visual-helpers";

/**
 * T-163 · REQ-078 en las pantallas del barbero (design §22.4, §22.5; tableros Barbero-Fila,
 * Barbero-Cobro y Barbero-Otros): botón gigante ≥ 80 px, cobro con total y botón fijos abajo,
 * turno nuevo al final con resaltado sin mover lo de arriba y "Llamar" deshabilitado sin red.
 */

const ROUTES = [
  "/app/fila",
  "/app/clientes",
  "/app/mis-numeros",
  "/app/limpieza",
  "/app/estacion",
  "/app/mis-fotos",
];

async function serviceId() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data } = await db
    .from("services")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("name", "Corte")
    .single();
  return data!.id as string;
}

let seq = 0;
/** Turno para "el que esté libre" tomado por la portada (service_role, como la acción pública). */
async function addTicket(name: string) {
  const { error } = await adminDb().rpc("join_queue", {
    p_slug: SEED.slug,
    p_name: name,
    p_phone: `+57304${(Date.now() + seq++).toString().slice(-7)}`,
    p_service_id: await serviceId(),
    p_preferred_barber_id: null,
    p_privacy_version: 1,
    p_source: "qr",
  });
  if (error) throw new Error(error.message);
}

async function barberReady(page: Page) {
  await loginAsBarber(page, 0);
  for (const name of ["Estoy aquí", "Volver"]) {
    const b = page.getByRole("button", { name });
    if (await b.isVisible()) await b.click();
  }
}

async function height(page: Page, name: string | RegExp) {
  const box = await page.getByRole("button", { name, exact: true }).boundingBox();
  return box?.height ?? 0;
}

test.describe("T-163 pantallas del barbero con el sistema visual (REQ-078)", () => {
  // Comparten la fila del negocio del seed: una a la vez (sin modo "serial" para ver todas)
  test.describe.configure({ mode: "default" });
  test.use({ serviceWorkers: "block" });
  test.beforeEach(resetQueue);

  test("REQ-078.15 las pantallas del barbero no se desplazan de lado en 360, 390 y 1280 px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await addTicket("Visual Ancho");
    await barberReady(page);
    for (const path of ROUTES) await noHorizontalScroll(page, path);
  });

  test("REQ-078.4 cada pantalla del barbero tiene a lo más un botón principal y botones de ≥ 48 px", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await addTicket("Visual Botones");
    await barberReady(page);
    for (const path of ROUTES) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      expect(await primaryButtons(page), path).toBeLessThanOrEqual(1);
      expect(await smallTargets(page), path).toEqual([]);
    }
  });

  test("REQ-078.5 el botón principal de la fila mide ≥ 80 px en cada paso y queda sobre el menú", async ({
    page,
  }) => {
    await addTicket("Visual Gigante");
    await barberReady(page);
    expect(await height(page, CALL)).toBeGreaterThanOrEqual(80);
    const nav = await page.getByRole("navigation", { name: "Menú del barbero" }).boundingBox();
    const call = await page.getByRole("button", { name: CALL }).boundingBox();
    expect(call!.y + call!.height).toBeLessThanOrEqual(nav!.y);

    await page.getByRole("button", { name: CALL }).click();
    await expect(page.getByRole("button", { name: "Empezar corte" })).toBeVisible();
    expect(await height(page, "Empezar corte")).toBeGreaterThanOrEqual(80);
    expect(await height(page, "No vino")).toBeGreaterThanOrEqual(48);
    expect(await primaryButtons(page)).toBe(1);

    await page.getByRole("button", { name: "Empezar corte" }).click();
    await expect(page.getByRole("button", { name: "Terminar y cobrar" })).toBeVisible();
    expect(await height(page, "Terminar y cobrar")).toBeGreaterThanOrEqual(80);
  });

  test("REQ-078.4 el cobro deja el total y el botón fijos abajo, con un solo botón principal", async ({
    page,
  }) => {
    await addTicket("Visual Cobro");
    await barberReady(page);
    await page.getByRole("button", { name: CALL }).click();
    await page.getByRole("button", { name: "Empezar corte" }).click();
    await page.getByRole("button", { name: "Terminar y cobrar" }).click();
    const sheet = page.getByRole("dialog", { name: /^Cobrar a / });
    const pay = sheet.getByRole("button", { name: /^Cobrar \$/ });
    await expect(pay).toBeVisible({ timeout: 15_000 });
    await expect(sheet.getByText("Total", { exact: true })).toBeVisible();
    const viewport = page.viewportSize()!;
    const box = (await pay.boundingBox())!;
    expect(viewport.height - (box.y + box.height)).toBeLessThanOrEqual(40);
    expect(box.height).toBeGreaterThanOrEqual(48);
    expect(await primaryButtons(page)).toBe(1);
    await sheet.getByRole("button", { name: "Cobrar después" }).click();
  });

  test("REQ-078.12 el turno nuevo entra al final resaltado sin mover lo que está arriba", async ({
    page,
  }) => {
    await addTicket("Visual Primero");
    await addTicket("Visual Segundo");
    await barberReady(page);
    const first = page.getByText("Visual Primero");
    const second = page.getByText("Visual Segundo");
    await expect(second).toBeVisible();
    const before = [(await first.boundingBox())!.y, (await second.boundingBox())!.y];

    await addTicket("Visual Nuevo");
    const row = page.getByTestId("waiting-row").filter({ hasText: "Visual Nuevo" });
    await expect(row).toBeVisible({ timeout: 10_000 });
    await expect(row.locator(".animate-flash")).toHaveCount(1);
    const rows = page.getByTestId("waiting-row");
    await expect(rows.last()).toContainText("Visual Nuevo");
    expect([(await first.boundingBox())!.y, (await second.boundingBox())!.y]).toEqual(before);
  });

  test("REQ-078.10 sin conexión: franja con la hora y Llamar deshabilitado con el motivo", async ({
    page,
    context,
  }) => {
    await addTicket("Visual Sin Red");
    await barberReady(page);
    await expect(page.getByRole("button", { name: CALL })).toBeEnabled();
    await context.setOffline(true);
    try {
      await expect(page.getByText(/Sin conexión\. Mostrando lo último que vimos/)).toBeVisible();
      await expect(page.getByRole("button", { name: CALL })).toBeDisabled();
      await expect(
        page.getByText("Sin señal no podemos avisarle. Reintentamos solos."),
      ).toBeVisible();
    } finally {
      await context.setOffline(false);
    }
  });

  test("REQ-078.8 la fila del barbero con CLS ≤ 0,1 en Slow 4G", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium", "la red lenta se simula por CDP");
    test.setTimeout(180_000);
    await addTicket("Visual CLS 1");
    await addTicket("Visual CLS 2");
    await barberReady(page);
    expect(await clsSlow4G(page, "/app/fila")).toBeLessThanOrEqual(0.1);
  });
});
