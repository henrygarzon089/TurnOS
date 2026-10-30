import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, resetQueue, SEED } from "./helpers";

/** T-061 · REQ-038. Tinto y Aromática son del seed: solo de cortesía, sin precio. */
const phone = () => `300 8${Math.floor(100000 + Math.random() * 899999)}`;
/** PNG de 1 × 1: basta para pasar por el canvas de `resize.ts`. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);

async function fillJoinForm(page: Page, name: string) {
  await page.goto(`/${SEED.slug}/turno`);
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Tu celular (WhatsApp)").fill(phone());
  await page.getByRole("radio", { name: /Corte · 20 min/ }).check();
}

async function takeTicket(ctx: BrowserContext, name: string, drink?: string) {
  const page = await ctx.newPage();
  await fillJoinForm(page, name);
  if (drink) await page.getByRole("radio", { name: drink }).check();
  await page.getByRole("checkbox", { name: /Acepto que/ }).check();
  await page.getByRole("button", { name: "Confirmar turno" }).click();
  await expect(page).toHaveURL(/\/t\//);
  return page;
}

async function setProduct(name: string, fields: Record<string, unknown>) {
  const { data: biz } = await adminDb()
    .from("businesses")
    .select("id")
    .eq("slug", SEED.slug)
    .single();
  const { error } = await adminDb()
    .from("products")
    .update(fields)
    .eq("business_id", biz!.id)
    .eq("name", name);
  if (error) throw new Error(error.message);
}

/** Vuelve a Tinto y Aromática como en el seed aunque la prueba falle a mitad. */
async function restoreSeedProducts() {
  await setProduct("Tinto", { is_active: true });
  await setProduct("Aromática", { is_active: true });
  await setProduct("Agua", {
    is_active: true,
    for_sale: true,
    is_courtesy: false,
    photo_path: null,
  });
}

test.describe("Hito 5 · menú y bebida de cortesía", () => {
  test.use({ serviceWorkers: "block" });
  test.beforeEach(resetQueue);
  test.afterEach(restoreSeedProducts);

  test("REQ-038.2 la portada muestra lo que se vende, sin las cortesías; sin productos no aparece", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}`);
    const menu = page.getByRole("region", { name: "Lo que vendemos" });
    await expect(menu.getByText("Helado")).toBeVisible();
    await expect(menu.getByText("$ 3.000")).toBeVisible();
    await expect(menu.getByText("Tinto")).toHaveCount(0);

    const { data: biz } = await adminDb()
      .from("businesses")
      .select("id")
      .eq("slug", SEED.slug)
      .single();
    await adminDb().from("products").update({ for_sale: false }).eq("business_id", biz!.id);
    try {
      await page.reload();
      await expect(page.getByRole("heading", { name: "Lo que vendemos" })).toHaveCount(0);
    } finally {
      await adminDb()
        .from("products")
        .update({ for_sale: true })
        .eq("business_id", biz!.id)
        .not("name", "in", '("Tinto","Aromática")');
    }
  });

  test("REQ-038.3 el formulario ofrece las bebidas con 'No, gracias' por defecto; sin cortesías no aparece", async ({
    page,
  }) => {
    await fillJoinForm(page, "Cliente Bebida E2E");
    const group = page.getByRole("group", { name: "Bebida de cortesía" });
    await expect(group.getByRole("radio", { name: "No, gracias" })).toBeChecked();
    await expect(group.getByRole("radio", { name: "Tinto" })).toBeVisible();
    await expect(group.getByRole("radio", { name: "Aromática" })).toBeVisible();

    await setProduct("Tinto", { is_active: false });
    await setProduct("Aromática", { is_active: false });
    await page.reload();
    await expect(page.getByRole("group", { name: "Bebida de cortesía" })).toHaveCount(0);
  });

  test("REQ-038.3 REQ-038.5 REQ-038.7 turno con bebida: el barbero la marca servida, Mi turno se entera y la caja no la registra", async ({
    page,
    context,
    browser,
  }) => {
    const name = `Tinto E2E ${Date.now().toString(36)}`;
    const mine = await takeTicket(context, name, "Tinto");
    const section = mine.getByRole("region", { name: "Tu turno" });
    await expect(section.getByText("🥤 Tinto")).toBeVisible();

    await loginAsBarber(page);
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row.getByText("🥤 Tinto")).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "Servida ✓" }).click();

    // Una vez servida ya no es botón: no se puede desmarcar
    await expect(row.getByRole("button", { name: "Servida ✓" })).toHaveCount(0);
    await expect(row.getByText("Servida ✓")).toBeVisible();
    // Sin recargar: llega por el canal de la fila (ADR-008)
    await expect(section.getByText("Servida ✓")).toBeVisible({ timeout: 15_000 });

    const { data: ticket } = await adminDb()
      .from("tickets")
      .select("id, courtesy_served_at, courtesy_served_by")
      .eq("customer_name", name)
      .single();
    expect(ticket!.courtesy_served_at).toBeTruthy();
    expect(ticket!.courtesy_served_by).toBeTruthy();

    // La fila del dueño también la ve, ya servida
    const ownerCtx = await browser.newContext();
    const owner = await ownerCtx.newPage();
    await loginAsOwner(owner);
    const ownerRow = owner.getByRole("listitem").filter({ hasText: name });
    await expect(ownerRow.getByText("🥤 Tinto")).toBeVisible({ timeout: 15_000 });
    await expect(ownerRow.getByText("Servida ✓")).toBeVisible();
    await ownerCtx.close();

    // Termina el turno: en el cobro no aparecen las cortesías y no hay venta
    await page.getByRole("button", { name: "Llamar al siguiente" }).click();
    const current = page.getByRole("article", { name: `Turno actual ${name}` });
    await expect(current.getByText("🥤 Tinto")).toBeVisible();
    await current.getByRole("button", { name: "Ya está en la silla" }).click();
    await current.getByRole("button", { name: "Terminado" }).click();
    const products = page.getByRole("region", { name: "Productos" });
    await expect(products.getByText("Helado")).toBeVisible();
    await expect(products.getByText("Tinto")).toHaveCount(0);
    await expect(products.getByText("Aromática")).toHaveCount(0);

    const { data: sales } = await adminDb().from("sales").select("id").eq("ticket_id", ticket!.id);
    expect(sales).toEqual([]);
  });

  test("REQ-038.5 el dueño marca la bebida desde su fila", async ({ page, context }) => {
    const name = `Aromática E2E ${Date.now().toString(36)}`;
    await takeTicket(context, name, "Aromática");
    await loginAsOwner(page);
    const row = page.getByRole("listitem").filter({ hasText: name });
    await expect(row.getByText("🥤 Aromática")).toBeVisible({ timeout: 15_000 });
    await row.getByRole("button", { name: "Servida ✓" }).click();
    await expect(row.getByRole("button", { name: "Servida ✓" })).toHaveCount(0);
    await expect(row.getByText("Servida ✓")).toBeVisible();
  });

  test("REQ-038.4 en espera cambia o quita la bebida; ya llamado no", async ({ page, context }) => {
    const name = `Cambio E2E ${Date.now().toString(36)}`;
    const mine = await takeTicket(context, name, "Tinto");
    const section = mine.getByRole("region", { name: "Tu turno" });

    await section.getByRole("button", { name: "Cambiar bebida" }).click();
    await section.getByRole("radio", { name: "Aromática" }).click();
    await expect(section.getByText("🥤 Aromática")).toBeVisible();

    await section.getByRole("button", { name: "Cambiar bebida" }).click();
    await section.getByRole("radio", { name: "No, gracias" }).click();
    await expect(section.getByText("🥤", { exact: false })).toHaveText(/Sin bebida/);

    await section.getByRole("button", { name: "Escoger bebida" }).click();
    await section.getByRole("radio", { name: "Tinto" }).click();
    await expect(section.getByText("🥤 Tinto")).toBeVisible();

    await loginAsBarber(page);
    await expect(page.getByRole("listitem").filter({ hasText: name })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Llamar al siguiente" }).click();
    await expect(mine.getByText("¡Es tu turno!")).toBeVisible({ timeout: 15_000 });
    await expect(section.getByText("🥤 Tinto")).toBeVisible();
    await expect(section.getByRole("button", { name: /bebida/ })).toHaveCount(0);
  });

  test("REQ-038.6 la bebida que se acabó con el formulario abierto da error en el campo", async ({
    page,
  }) => {
    await fillJoinForm(page, "Se Acabó E2E");
    await page.getByRole("radio", { name: "Tinto" }).check();
    await page.getByRole("checkbox", { name: /Acepto que/ }).check();
    await setProduct("Tinto", { is_active: false });
    await page.getByRole("button", { name: "Confirmar turno" }).click();
    const group = page.getByRole("group", { name: "Bebida de cortesía" });
    await expect(group.getByText("Esa bebida ya no está disponible")).toBeVisible();
    await expect(page).toHaveURL(/\/turno/);
  });

  test("REQ-038.7 un producto desactivado deja de ofrecerse y el turno que lo tenía lo conserva", async ({
    context,
  }) => {
    const name = `Conserva E2E ${Date.now().toString(36)}`;
    const mine = await takeTicket(context, name, "Tinto");
    await setProduct("Tinto", { is_active: false });

    const fresh = await context.newPage();
    await fillJoinForm(fresh, "Otro Cliente E2E");
    await expect(fresh.getByRole("radio", { name: "Tinto" })).toHaveCount(0);

    await mine.reload();
    await expect(
      mine.getByRole("region", { name: "Tu turno" }).getByText("🥤 Tinto"),
    ).toBeVisible();
  });

  test("REQ-038.1 el dueño marca A la venta / De cortesía y la caja lista solo lo que se vende", async ({
    page,
    browser,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/productos");
    const agua = page.getByRole("form", { name: "Producto Agua" });
    await agua.getByLabel("A la venta").uncheck();
    await agua.getByRole("button", { name: "Guardar" }).click();
    await expect(agua.getByRole("alert")).toHaveText(
      "Marca si es a la venta, de cortesía o ambas.",
    );

    await agua.getByLabel("De cortesía").check();
    await agua.getByRole("button", { name: "Guardar" }).click();
    await expect(agua.getByRole("alert")).toHaveCount(0);
    await expect
      .poll(async () => {
        const { data } = await adminDb()
          .from("products")
          .select("for_sale, is_courtesy")
          .eq("name", "Agua")
          .limit(1)
          .single();
        return data;
      })
      .toEqual({ for_sale: false, is_courtesy: true });

    const ctx = await browser.newContext();
    const customer = await ctx.newPage();
    await customer.goto(`/${SEED.slug}`);
    const menu = customer.getByRole("region", { name: "Lo que vendemos" });
    await expect(menu.getByText("Helado")).toBeVisible();
    await expect(menu.getByText("Agua")).toHaveCount(0);
    const form = await ctx.newPage();
    await form.goto(`/${SEED.slug}/turno`);
    await expect(form.getByRole("radio", { name: "Agua" })).toBeVisible();
    await ctx.close();

    await page.goto("/admin/caja");
    await page.getByRole("button", { name: "+ Nueva venta" }).click();
    const products = page.getByRole("region", { name: "Productos" });
    await expect(products.getByText("Helado")).toBeVisible();
    await expect(products.getByText("Agua")).toHaveCount(0);
  });

  test("REQ-038.1 la foto se reduce, se sube al bucket y sale en la portada", async ({
    page,
    browser,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/productos");
    const agua = page.getByRole("form", { name: "Producto Agua" });
    await agua.getByLabel("Foto (opcional)").setInputFiles({
      name: "agua.png",
      mimeType: "image/png",
      buffer: PNG,
    });
    await expect(agua.getByRole("img", { name: "Agua" })).toBeVisible({ timeout: 15_000 });
    await agua.getByRole("button", { name: "Guardar" }).click();
    await expect
      .poll(async () => {
        const { data } = await adminDb()
          .from("products")
          .select("photo_path")
          .eq("name", "Agua")
          .limit(1)
          .single();
        return data?.photo_path ?? null;
      })
      .toMatch(/\/products\/[0-9a-f-]{36}\.webp$/);

    const ctx = await browser.newContext();
    const customer = await ctx.newPage();
    await customer.goto(`/${SEED.slug}`);
    const img = customer.getByRole("region", { name: "Lo que vendemos" }).getByRole("img", {
      name: "Agua",
    });
    await img.scrollIntoViewIfNeeded();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    await ctx.close();

    await agua.getByRole("button", { name: "Quitar foto" }).click();
    await agua.getByRole("button", { name: "Guardar" }).click();
    await expect
      .poll(async () => {
        const { data } = await adminDb()
          .from("products")
          .select("photo_path")
          .eq("name", "Agua")
          .limit(1)
          .single();
        return data?.photo_path ?? null;
      })
      .toBeNull();
  });
});
