import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, SEED } from "./helpers";

/**
 * T-171 · ADR-051: las demás pantallas del barbero como el tablero Barbero-Otros (design §22.6):
 * Clientes, detalle, Mis números, Mis fotos, Limpieza y Mi estación. REQ-078.20: ningún control con
 * texto del navegador ("Choose File"); subir una foto es un botón en español.
 */

/** PNG de 1 × 1: basta para pasar por el canvas de `resize.ts`. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function bizId(): Promise<string> {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function resetCleaning(enabled: boolean) {
  const db = adminDb();
  const biz = await bizId();
  const { data: rows } = await db
    .from("cleaning_records")
    .select("photo_paths")
    .eq("business_id", biz);
  const paths = (rows ?? []).flatMap((r) => r.photo_paths as string[]);
  if (paths.length) await db.storage.from("cleaning").remove(paths);
  await db.from("cleaning_records").delete().eq("business_id", biz);
  await db.from("businesses").update({ cleaning_enabled: enabled }).eq("id", biz);
  if (enabled) await db.rpc("cleaning_seed_lists", { p_business_id: biz });
}

/** Ningún selector de archivos a la vista: solo el botón en español (REQ-078.20). */
async function expectNoNativeFileInput(page: import("@playwright/test").Page) {
  const inputs = page.locator('input[type="file"]');
  for (let i = 0; i < (await inputs.count()); i++) await expect(inputs.nth(i)).toBeHidden();
}

test.describe("T-171 barbero fiel al tablero Barbero-Otros (ADR-051)", () => {
  test.describe.configure({ mode: "default" });

  test("REQ-078.16 Clientes: buscador con lupa y lista a todo el ancho con celular oculto y fidelidad", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    await page.goto("/app/clientes");
    await expect(page.getByRole("heading", { level: 1, name: "Clientes" })).toBeVisible();
    const search = page.getByRole("searchbox", { name: "Buscar cliente" });
    await expect(search).toHaveAttribute("placeholder", "Buscar por nombre o celular");

    const list = page.getByRole("list", { name: "Clientes" });
    const first = list.getByRole("link").first();
    await expect(first).toContainText("***");
    // El seed tiene la fidelidad encendida (10 cortes)
    await expect(first).toContainText(/\d+\/10/);
    // Sin tarjetas ni secciones: una sola lista
    await expect(page.getByRole("heading", { name: "Atendidos por ti" })).toHaveCount(0);
    const box = (await first.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(56);

    await first.click();
    await expect(page.getByRole("link", { name: "Clientes" }).first()).toBeVisible();
    const facts = page.getByRole("list", { name: "Datos del cliente" });
    for (const label of ["Fidelidad", "Cumpleaños", "Membresía"])
      await expect(facts.getByText(label, { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Últimos cortes" })).toBeVisible();
  });

  test("REQ-078.16 Mis números: Hoy y Semana, la comisión en grande y el desglose en filas", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    await page.goto("/app/mis-numeros");
    const tabs = page.getByRole("tablist", { name: "Periodo" });
    await expect(tabs.getByRole("tab", { name: "Hoy" })).toHaveAttribute("aria-selected", "true");
    const today = page.getByTestId("today");
    await expect(today).toContainText("Tu comisión hoy");
    const big = today.getByTestId("today-total");
    const size = await big.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(40);
    for (const label of ["Servicios", "Cortes gratis dados", "Productos vendidos"])
      await expect(today.getByText(label, { exact: true })).toBeVisible();

    await tabs.getByRole("tab", { name: "Semana" }).click();
    await expect(page.getByTestId("week")).toContainText("Tu comisión de la semana");
    await expect(today).toBeHidden();
  });

  test("REQ-078.20 Mis fotos: rejilla numerada y botón Subir foto en español, sin el selector del navegador", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    await page.goto("/app/mis-fotos");
    await expect(page.getByText(/^\d+ de 12\.?$/)).toBeVisible();
    await expect(page.getByText("Choose File")).toHaveCount(0);
    await expectNoNativeFileInput(page);
    const button = page.getByText("Subir foto", { exact: true });
    await expect(button).toBeVisible();

    // El botón queda fijo sobre la barra de abajo
    const vp = page.viewportSize()!;
    const b = (await button.boundingBox())!;
    expect(b.y).toBeGreaterThan(vp.height / 2);

    await page.locator('input[type="file"]').setInputFiles({
      name: "corte.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    const sheet = page.getByRole("dialog", { name: "Nueva foto" });
    await sheet.getByRole("checkbox").check();
    await sheet.getByRole("button", { name: "Subir foto" }).click();
    await expect(sheet).toHaveCount(0);
    const cells = page.getByRole("list", { name: "Fotos de cortes" }).getByRole("listitem");
    await expect(cells.first()).toContainText("1");

    // Tocar la foto la borra (con confirmación)
    const before = await cells.count();
    await cells.first().getByRole("button").click();
    await page
      .getByRole("dialog", { name: "¿Borrar esta foto?" })
      .getByRole("button", { name: "Borrar" })
      .click();
    await expect(cells).toHaveCount(before - 1);
  });

  test.describe("Limpieza", () => {
    test.beforeEach(() => resetCleaning(true));
    test.afterAll(() => resetCleaning(false));

    test("REQ-078.16 REQ-078.20 Limpieza: Apertura / Cierre / Profunda, casillas de 48 px, Tomar foto y Enviar con lo que falta", async ({
      page,
    }) => {
      await loginAsBarber(page, 0);
      await page.goto("/app/limpieza");
      const tabs = page.getByRole("tablist", { name: "Limpieza" });
      for (const name of ["Apertura", "Cierre", "Profunda"])
        await expect(tabs.getByRole("tab", { name })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Limpieza de apertura" })).toBeVisible();

      const form = page.getByRole("form", { name: "Apertura" });
      const boxes = form.getByRole("checkbox");
      const n = await boxes.count();
      expect(n).toBeGreaterThan(0);
      const row = (await boxes.first().locator("xpath=ancestor::label").boundingBox())!;
      expect(row.height).toBeGreaterThanOrEqual(48);

      // REQ-078.20 la foto es un botón en español
      await expect(form.getByText("Tomar foto", { exact: true })).toBeVisible();
      await expectNoNativeFileInput(page);

      const send = form.getByRole("button", { name: /^Enviar/ });
      await expect(send).toHaveText(`Enviar (faltan ${n})`);
      await expect(send).toBeDisabled();
      for (let i = 0; i < n; i++) await boxes.nth(i).check();
      await expect(send).toHaveText("Enviar");
      await expect(send).toBeEnabled();

      // El cierre pide la foto
      await tabs.getByRole("tab", { name: "Cierre" }).click();
      await expect(page.getByRole("heading", { name: "Limpieza de cierre" })).toBeVisible();
    });
  });

  test("REQ-078.16 Mi estación: filas a todo el ancho y la ayuda del envase vacío", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    await page.goto("/app/estacion");
    await expect(page.getByRole("heading", { level: 1, name: "Mi estación" })).toBeVisible();
    const assigned = page.getByText("Tu cuenta no tiene una estación asignada.");
    if (await assigned.isVisible()) return;
    await expect(
      page.getByText("entrega el envase vacío en la caja", { exact: false }),
    ).toBeVisible();
    for (const name of ["Reposiciones", "Último conteo"])
      await expect(page.getByRole("region", { name })).toBeVisible();
  });
});
