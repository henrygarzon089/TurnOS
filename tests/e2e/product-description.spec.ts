import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED, waitForContent } from "./helpers";

/**
 * T-272 · REQ-098 (ADR-072): el dueño escribe la descripción de un producto en "Productos" y el
 * cliente la ve en "Ver menú" de la portada. Producto de prueba por proyecto (android / iphone).
 */
let NAME = "Cera E2E";
const TEXT = "Cera mate de fijación fuerte, sin brillo";

async function bizId() {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function cleanup() {
  await adminDb()
    .from("products")
    .delete()
    .eq("business_id", await bizId())
    .eq("name", NAME);
}

async function savedDescription() {
  const { data } = await adminDb()
    .from("products")
    .select("description")
    .eq("business_id", await bizId())
    .eq("name", NAME)
    .single();
  return data?.description ?? null;
}

async function editProduct(page: import("@playwright/test").Page, text: string) {
  await loginAsOwner(page);
  await page.goto("/admin/productos");
  await page
    .getByRole("article", { name: `Producto ${NAME}` })
    .getByRole("button", { name: "Editar" })
    .click();
  const form = page.getByRole("form", { name: `Producto ${NAME}` });
  await expect(form.getByText("Opcional. La ve el cliente en el menú.")).toBeVisible();
  await form.getByLabel("Descripción").fill(text);
  await form.getByRole("button", { name: "Guardar" }).click();
  await expect(form).toBeHidden();
}

async function openMenu(page: import("@playwright/test").Page) {
  await page.goto(`/${SEED.slug}`);
  await waitForContent(page);
  await page.getByRole("button", { name: "Ver menú" }).click();
  return page
    .getByRole("dialog", { name: "Menú" })
    .getByRole("region", { name: "Lo que vendemos" })
    .getByRole("listitem")
    .filter({ hasText: NAME });
}

test.describe("REQ-098 descripción de los productos del menú", () => {
  test.describe.configure({ mode: "serial" });
  test.use({ serviceWorkers: "block" });

  test.beforeAll(async ({}, info) => {
    NAME = `Cera E2E ${info.project.name}`;
    await cleanup();
    await adminDb()
      .from("products")
      .insert({ business_id: await bizId(), name: NAME, price: 25000, sort_order: 95 });
  });
  test.afterAll(cleanup);

  test("REQ-098.1 el dueño escribe la descripción en la hoja de editar producto", async ({
    page,
  }) => {
    await editProduct(page, `  ${TEXT}\n`);
    // REQ-098.2: se guardó limpia
    await expect.poll(savedDescription).toBe(TEXT);
  });

  test("REQ-098.3 el cliente ve la descripción en Ver menú", async ({ page }) => {
    const row = await openMenu(page);
    await expect(row.getByTestId("product-description")).toHaveText(TEXT);
  });

  test("REQ-098.4 al borrar la descripción, la fila del menú vuelve a verse como antes", async ({
    page,
  }) => {
    await editProduct(page, "");
    await expect.poll(savedDescription).toBeNull();
    const client = await page.context().newPage();
    const row = await openMenu(client);
    await expect(row).toBeVisible();
    await expect(row.getByTestId("product-description")).toHaveCount(0);
  });
});
