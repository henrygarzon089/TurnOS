import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED, waitForContent } from "./helpers";

/**
 * T-263 · REQ-097 (ADR-070): el dueño escribe la descripción del negocio en "Negocio" y sale en la
 * portada, debajo del nombre; no sale durante los pasos. Al final queda sin descripción.
 */
const TEXT = "Barbería de barrio. Cortes clásicos y modernos, barba y cejas.";

async function clear() {
  await adminDb().from("businesses").update({ description: null }).eq("slug", SEED.slug);
}

/** Espera a que la base tenga la descripción (la hoja relee la página al guardar). */
async function savedDescription() {
  const { data } = await adminDb()
    .from("businesses")
    .select("description")
    .eq("slug", SEED.slug)
    .single();
  return (data?.description as string | null) ?? null;
}

test.describe("REQ-097 descripción del negocio", () => {
  test.describe.configure({ mode: "serial" });
  test.beforeAll(clear);
  test.afterAll(clear);

  test("REQ-097.1 / REQ-097.3 el dueño la escribe en Negocio y sale en la portada, no en los pasos", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/negocio");
    const form = page.getByRole("form", { name: "Datos del negocio" });
    await expect(form.getByText("Opcional. Sale en la portada, debajo del nombre.")).toBeVisible();
    await expect(form.getByText("0/200")).toBeVisible();
    await form.getByLabel("Descripción del negocio").fill(TEXT);
    await expect(form.getByText(`${TEXT.length}/200`)).toBeVisible();
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();
    await expect.poll(savedDescription).toBe(TEXT);

    // El cliente en otra pestaña, para no cruzarse con la relectura de "Negocio"
    const client = await page.context().newPage();
    await client.goto(`/${SEED.slug}`);
    await waitForContent(client);
    await expect(client.getByTestId("business-description")).toHaveText(TEXT);

    // REQ-097.3: en la cabecera compacta de los pasos no va
    await client.getByRole("button", { name: "Tomar turno" }).click();
    await expect(client.getByText("Paso 1 de 3")).toBeVisible();
    await expect(client.getByTestId("business-description")).toHaveCount(0);
  });

  test("REQ-097.4 al borrarla, la portada se ve igual que hoy", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/negocio");
    const form = page.getByRole("form", { name: "Datos del negocio" });
    await form.getByLabel("Descripción del negocio").fill("");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form.getByText("Guardado.")).toBeVisible();
    await expect.poll(savedDescription).toBeNull();

    const client = await page.context().newPage();
    await client.goto(`/${SEED.slug}`);
    await waitForContent(client);
    await expect(client.getByTestId("public-hero")).toBeVisible();
    await expect(client.getByTestId("business-description")).toHaveCount(0);
  });
});
