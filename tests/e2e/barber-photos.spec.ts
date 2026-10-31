import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, resetQueue, SEED } from "./helpers";

/** T-062 · REQ-039. Juan es el barbero 0 del seed; Mateo, el 4. */
const CONSENT = "El cliente me dio permiso de publicar esta foto";
const LIMIT = "Ya tienes 12 fotos. Borra una para subir otra";
/** PNG de 1 × 1: basta para pasar por el canvas de `resize.ts`. */
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
const photo = { name: "corte.png", mimeType: "image/png", buffer: PNG };

async function ids(barber: string) {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: b } = await db
    .from("barbers")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("display_name", barber)
    .single();
  return { biz: biz!.id as string, barber: b!.id as string };
}

async function clearPhotos() {
  const { biz } = await ids("Juan");
  await adminDb().from("barber_photos").delete().eq("business_id", biz);
}

/** Filas sin archivo: bastan para el conteo; estas pruebas no miran la imagen. */
async function seedPhotos(barber: string, n: number) {
  const { biz, barber: id } = await ids(barber);
  const rows = Array.from({ length: n }, () => ({
    business_id: biz,
    barber_id: id,
    path: `${biz}/barbers/${id}/${randomUUID()}.webp`,
  }));
  const { error } = await adminDb().from("barber_photos").insert(rows);
  if (error) throw new Error(error.message);
}

async function countPhotos(barber: string) {
  const { barber: id } = await ids(barber);
  const { count } = await adminDb()
    .from("barber_photos")
    .select("id", { count: "exact", head: true })
    .eq("barber_id", id);
  return count ?? 0;
}

async function uploadWithConsent(page: Page) {
  await page.getByLabel("Escoger foto").setInputFiles(photo);
  await page.getByRole("checkbox", { name: CONSENT }).check();
  await page.getByRole("button", { name: "Subir foto" }).click();
}

test.describe("T-062 fotos de cortes", () => {
  test.beforeEach(async () => {
    await resetQueue();
    await clearPhotos();
  });
  test.afterAll(clearPhotos);

  test("REQ-039.3 sin confirmar no deja subir; con confirmación sube y sale en Ver cortes", async ({
    page,
    browser,
  }) => {
    await loginAsBarber(page);
    await page.getByRole("link", { name: "Mis fotos" }).click();
    await expect(page).toHaveURL(/\/app\/mis-fotos/);
    await page.getByLabel("Escoger foto").setInputFiles(photo);
    await expect(page.getByRole("button", { name: "Subir foto" })).toBeDisabled();
    expect(await countPhotos("Juan")).toBe(0);

    await page.getByRole("checkbox", { name: CONSENT }).check();
    await page.getByRole("button", { name: "Subir foto" }).click();
    await expect(page.getByRole("img", { name: "Corte de Juan" })).toBeVisible({ timeout: 15_000 });
    expect(await countPhotos("Juan")).toBe(1);

    // Cada foto se confirma: la casilla no queda marcada para la siguiente
    await page.getByLabel("Escoger foto").setInputFiles(photo);
    await expect(page.getByRole("checkbox", { name: CONSENT })).not.toBeChecked();

    const ctx = await browser.newContext();
    const customer = await ctx.newPage();
    await customer.goto(`/${SEED.slug}/turno`);
    await customer.getByLabel("Tu nombre").fill("Valentina Ríos");
    await customer.getByLabel("Tu celular (WhatsApp)").fill("300 811 2233");
    await customer.getByRole("radio", { name: "Juan" }).click();

    await customer.getByRole("button", { name: "Ver cortes de Juan" }).click();
    const sheet = customer.getByRole("dialog", { name: "Cortes de Juan" });
    const img = sheet.getByRole("img", { name: "Corte de Juan" });
    await expect(img).toBeVisible();
    await expect
      .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
      .toBeGreaterThan(0);
    await sheet.getByRole("button", { name: "Cerrar" }).click();

    // REQ-039.5: lo escrito sigue ahí
    await expect(sheet).toHaveCount(0);
    await expect(customer.getByLabel("Tu nombre")).toHaveValue("Valentina Ríos");
    await expect(customer.getByLabel("Tu celular (WhatsApp)")).toHaveValue("300 811 2233");
    await expect(customer.getByRole("radio", { name: "Juan" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await ctx.close();
  });

  test("REQ-039.5 sin fotos no aparece Ver cortes", async ({ page }) => {
    await seedPhotos("Juan", 1);
    await page.goto(`/${SEED.slug}/turno`);
    await expect(page.getByRole("button", { name: "Ver cortes de Juan" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ver cortes de Pedro" })).toHaveCount(0);
  });

  test("REQ-039.4 un archivo que no es imagen se rechaza", async ({ page }) => {
    await loginAsBarber(page);
    await page.goto("/app/mis-fotos");
    await page.getByLabel("Escoger foto").setInputFiles({
      name: "lista.txt",
      mimeType: "text/plain",
      buffer: Buffer.from("no soy una foto"),
    });
    await expect(page.getByText("Ese archivo no es una foto")).toBeVisible();
    await expect(page.getByRole("button", { name: "Subir foto" })).toHaveCount(0);
  });

  test("REQ-039.2 con 12 fotos no deja subir otra y al borrar una vuelve a dejar", async ({
    page,
  }) => {
    await seedPhotos("Juan", 12);
    await loginAsBarber(page);
    await page.goto("/app/mis-fotos");
    await expect(page.getByText(LIMIT)).toBeVisible();
    await expect(page.getByLabel("Escoger foto")).toHaveCount(0);

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Borrar foto" }).first().click();
    await expect(page.getByLabel("Escoger foto")).toBeVisible();
    expect(await countPhotos("Juan")).toBe(11);
  });

  test("REQ-039.2 si otra sesión llenó las 12 mientras escogía, la foto 13 se rechaza", async ({
    page,
  }) => {
    await seedPhotos("Juan", 11);
    await loginAsBarber(page);
    await page.goto("/app/mis-fotos");
    await page.getByLabel("Escoger foto").setInputFiles(photo);
    await expect(page.getByRole("checkbox", { name: CONSENT })).toBeVisible();
    await seedPhotos("Juan", 1);

    await page.getByRole("checkbox", { name: CONSENT }).check();
    await page.getByRole("button", { name: "Subir foto" }).click();
    await expect(page.getByText(LIMIT)).toBeVisible();
    expect(await countPhotos("Juan")).toBe(12);
  });

  test("REQ-039.1 el barbero borra una suya: se va la fila y el archivo", async ({ page }) => {
    await loginAsBarber(page);
    await page.goto("/app/mis-fotos");
    await uploadWithConsent(page);
    const img = page.getByRole("img", { name: "Corte de Juan" });
    await expect(img).toBeVisible({ timeout: 15_000 });
    const url = await img.getAttribute("src");

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Borrar foto" }).click();
    await expect(img).toHaveCount(0);
    expect(await countPhotos("Juan")).toBe(0);
    await expect.poll(async () => (await page.request.get(url!)).ok()).toBe(false);
  });

  test("REQ-039.1 el dueño sube y borra las de cualquier barbero", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/barberos");
    const card = page.getByRole("article", { name: "Barbero Pedro" });
    await card.getByText("Fotos de cortes").click();
    await card.getByLabel("Escoger foto").setInputFiles(photo);
    await card.getByRole("checkbox", { name: CONSENT }).check();
    await card.getByRole("button", { name: "Subir foto" }).click();
    await expect(card.getByRole("img", { name: "Corte de Pedro" })).toBeVisible({
      timeout: 15_000,
    });
    expect(await countPhotos("Pedro")).toBe(1);

    page.once("dialog", (d) => d.accept());
    await card.getByRole("button", { name: "Borrar foto" }).click();
    await expect(card.getByRole("img", { name: "Corte de Pedro" })).toHaveCount(0);
    expect(await countPhotos("Pedro")).toBe(0);
  });

  test("REQ-039.6 barbero desactivado: el público no ve sus fotos y se conservan", async ({
    page,
  }) => {
    await seedPhotos("Mateo", 2);
    const { barber } = await ids("Mateo");
    await page.goto(`/${SEED.slug}/turno`);
    const open = page.getByRole("button", { name: "Ver cortes de Mateo" });
    await expect(open).toBeVisible();
    try {
      await adminDb().from("barbers").update({ is_active: false }).eq("id", barber);
      // Con el formulario ya abierto tampoco salen
      await open.click();
      const sheet = page.getByRole("dialog", { name: "Cortes de Mateo" });
      await expect(sheet.getByText("Este barbero no tiene fotos para mostrar")).toBeVisible();
      await expect(sheet.getByRole("img")).toHaveCount(0);

      await page.reload();
      await expect(page.getByRole("button", { name: "Ver cortes de Mateo" })).toHaveCount(0);
      expect(await countPhotos("Mateo")).toBe(2);
    } finally {
      await adminDb().from("barbers").update({ is_active: true }).eq("id", barber);
    }
  });
});
