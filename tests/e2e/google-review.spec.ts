import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, resetQueue, SEED } from "./helpers";

/**
 * T-059 · REQ-036. El turno lo agrega el dueño (REQ-012.3, sin validar horario) y el token de
 * "Mi turno" se lee de la base. El enlace se borra al terminar cada prueba: el seed no trae.
 */
const LINK = "https://g.page/r/la-33-e2e/review";
const THANKS = "¡Gracias por venir!";
const BUTTON = "Déjanos tu reseña en Google";

async function setReviewUrl(url: string | null) {
  const { error } = await adminDb()
    .from("businesses")
    .update({ google_review_url: url })
    .eq("slug", SEED.slug);
  if (error) throw new Error(error.message);
}

/** Fila del dueño, solo "Turnos activos" (al terminar, el turno también sale en "Cobros pendientes"). */
const activeRow = (owner: Page, name: string) =>
  owner
    .getByRole("region", { name: "Turnos activos" })
    .getByRole("listitem")
    .filter({ hasText: name });

async function ownerAdds(owner: Page, name: string): Promise<string> {
  await owner.goto("/admin/fila");
  await owner.getByRole("button", { name: "Agregar cliente" }).click();
  const dialog = owner.getByRole("dialog", { name: "Agregar cliente" });
  await dialog.getByLabel("Nombre").fill(name);
  await dialog.getByLabel("Barbero").selectOption({ label: "Juan" });
  await dialog.getByRole("button", { name: "Agregar" }).click();
  await expect(activeRow(owner, name)).toBeVisible({ timeout: 15_000 });
  const { data, error } = await adminDb()
    .from("tickets")
    .select("public_token")
    .eq("customer_name", name)
    .single();
  if (error) throw new Error(error.message);
  return data.public_token;
}

/** El dueño llama con Juan; Juan ya ve el turno en la silla como "Turno actual". */
async function callWithJuan(owner: Page, barber: Page, name: string) {
  await barber.goto("/app/fila");
  const here = barber.getByRole("button", { name: "Estoy aquí" });
  if (await here.isVisible()) await here.click();
  const back = barber.getByRole("button", { name: "Volver" });
  if (await back.isVisible()) await back.click();

  const row = activeRow(owner, name);
  await row.getByRole("button", { name: new RegExp(name) }).click();
  const select = row.getByLabel("Llamar con");
  const juan = await select.locator("option", { hasText: "Juan" }).getAttribute("value");
  await select.selectOption(juan!);
  await row.getByRole("button", { name: "Llamar" }).click();

  await barber.goto("/app/fila");
  await expect(
    barber.getByRole("article", { name: new RegExp(`Turno actual ${name}`) }),
  ).toBeVisible({ timeout: 15_000 });
}

test.describe("REQ-036 reseña en Google", () => {
  test.setTimeout(120_000);

  test.beforeEach(async () => {
    await resetQueue(); // Juan libre: otra prueba pudo dejarle un turno abierto
  });

  test.afterEach(async () => {
    await setReviewUrl(null);
  });

  test("REQ-036.1 el dueño guarda el enlace; si no es https:// ve el error", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/negocio");
    const field = page.getByLabel("Enlace de reseñas de Google");
    const save = page.getByRole("button", { name: "Guardar enlace" });

    await field.fill("http://g.page/r/la-33-e2e/review");
    await save.click();
    await expect(page.getByText("Ese enlace no parece válido")).toBeVisible();

    await field.fill(LINK);
    await save.click();
    await expect(page.getByText("Enlace guardado.")).toBeVisible();
    await page.reload();
    await expect(field).toHaveValue(LINK);

    await field.fill("");
    await save.click();
    await expect(page.getByText("Enlace guardado.")).toBeVisible();
    await page.reload();
    await expect(field).toHaveValue("");
  });

  test("REQ-036.2 al terminar se ve el gracias y el botón en pestaña nueva; REQ-036.3 sin enlace, solo el gracias", async ({
    browser,
  }) => {
    await setReviewUrl(LINK);
    const owner = await (await browser.newContext()).newPage();
    const barber = await (await browser.newContext()).newPage();
    const customer = await (await browser.newContext()).newPage();
    const name = `Resena ${Date.now().toString().slice(-7)}`;
    try {
      await loginAsOwner(owner);
      await loginAsBarber(barber, 0); // Juan
      const token = await ownerAdds(owner, name);
      await callWithJuan(owner, barber, name);
      await barber.getByRole("button", { name: "Ya está en la silla" }).click();

      await customer.goto(`/t/${token}`);
      await expect(customer.getByText("Te están atendiendo")).toBeVisible({ timeout: 15_000 });
      await expect(customer.getByRole("link", { name: BUTTON })).toHaveCount(0);

      // Sin recargar: "Mi turno" se relee con queue_changed (ADR-008)
      await barber.getByRole("button", { name: "Terminado" }).click();
      await expect(customer.getByText(THANKS)).toBeVisible({ timeout: 15_000 });
      const review = customer.getByRole("link", { name: BUTTON });
      await expect(review).toHaveAttribute("href", LINK);
      await expect(review).toHaveAttribute("target", "_blank");
      await expect(review).toHaveAttribute("rel", /noopener/);

      await setReviewUrl(null);
      await customer.reload();
      await expect(customer.getByText(THANKS)).toBeVisible();
      await expect(customer.getByRole("link", { name: BUTTON })).toHaveCount(0);
    } finally {
      await Promise.all([owner, barber, customer].map((p) => p.context().close()));
    }
  });

  test('REQ-036.4 sin botón en turnos cancelados ni en "no llegó"', async ({ browser }) => {
    await setReviewUrl(LINK);
    const owner = await (await browser.newContext()).newPage();
    const barber = await (await browser.newContext()).newPage();
    const customer = await (await browser.newContext()).newPage();
    const suffix = Date.now().toString().slice(-7);
    try {
      await loginAsOwner(owner);
      await loginAsBarber(barber, 0); // Juan

      const cancelled = await ownerAdds(owner, `Cancela ${suffix}`);
      await customer.goto(`/t/${cancelled}`);
      customer.once("dialog", (d) => d.accept());
      await customer.getByRole("button", { name: "Cancelar mi turno" }).click();
      await expect(customer.getByText("Turno cancelado")).toBeVisible({ timeout: 15_000 });
      await expect(customer.getByRole("link", { name: BUTTON })).toHaveCount(0);

      const noShow = await ownerAdds(owner, `Falta ${suffix}`);
      await callWithJuan(owner, barber, `Falta ${suffix}`);
      await barber.getByRole("button", { name: "No llegó" }).click();
      await customer.goto(`/t/${noShow}`);
      await expect(customer.getByText("Te llamamos y no estabas")).toBeVisible({
        timeout: 15_000,
      });
      await expect(customer.getByRole("link", { name: BUTTON })).toHaveCount(0);
    } finally {
      await Promise.all([owner, barber, customer].map((p) => p.context().close()));
    }
  });
});
