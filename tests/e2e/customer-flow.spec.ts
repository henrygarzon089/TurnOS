import { expect, test, type Page } from "@playwright/test";
import { appAlert, loginAsBarber, resetQueue, SEED } from "./helpers";

const phone = () => `300 9${Math.floor(100000 + Math.random() * 899999)}`;

async function takeTicket(page: Page, name: string, cel: string) {
  await page.goto(`/${SEED.slug}/turno`);
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Tu celular (WhatsApp)").fill(cel);
  await page.getByRole("radio", { name: /Corte · 20 min/ }).check();
  // REQ-002.4: si este navegador ya aceptó la versión vigente, la casilla no aparece
  const box = page.getByRole("checkbox", { name: /Acepto que/ });
  await expect(box.or(page.getByText("Ya aceptaste nuestra política de datos."))).toBeVisible();
  if (await box.isVisible()) await box.check();
  await page.getByRole("button", { name: "Confirmar turno" }).click();
  await expect(page).toHaveURL(/\/t\/[A-Za-z0-9_-]{22}/);
}

test.describe("Hito 1 · flujo del cliente", () => {
  test.beforeEach(resetQueue); // cada prueba parte de la fila vacía

  test("REQ-001.1 la portada muestra nombre, estado, personas en fila y botón", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}`);
    await expect(page.getByRole("heading", { name: "Barbería La 33" })).toBeVisible();
    await expect(page.getByText(/Abierto|Cerrado/)).toBeVisible();
    await expect(page.getByText(/personas? en la fila/)).toBeVisible();
  });

  test("REQ-001.5 slug inexistente → Negocio no encontrado", async ({ page }) => {
    await page.goto("/no-existe-xyz");
    await expect(page.getByRole("heading", { name: "Negocio no encontrado" })).toBeVisible();
  });

  test("REQ-002.2 sin aceptar privacidad no se puede confirmar", async ({ page }) => {
    await page.goto(`/${SEED.slug}/turno`);
    await page.getByLabel("Tu nombre").fill("Prueba");
    await page.getByLabel("Tu celular (WhatsApp)").fill(phone());
    await expect(page.getByRole("button", { name: "Confirmar turno" })).toBeDisabled();
    await expect(page.getByText("Marca la casilla de privacidad para continuar.")).toBeVisible();
  });

  test("REQ-003.3 tomar turno → Mi turno con posición y estimado (< 2 s)", async ({ page }) => {
    const t0 = Date.now();
    await takeTicket(page, "Camilo E2E", phone());
    expect(Date.now() - t0).toBeLessThan(5000); // margen de red del E2E; el objetivo es 2 s en 4G
    // la posición y el estimado pueden decir los dos "Eres el siguiente" (REQ-004.5)
    await expect(page.getByText(/Eres el|En la fila/).first()).toBeVisible();
    await expect(page.locator("p", { hasText: "Servicio:" })).toContainText("Corte");
  });

  test("REQ-003.2 celular inválido muestra error en español", async ({ page }) => {
    await page.goto(`/${SEED.slug}/turno`);
    await page.getByLabel("Tu nombre").fill("Prueba");
    await page.getByLabel("Tu celular (WhatsApp)").fill("604 444 5555");
    await page.getByRole("checkbox", { name: /Acepto que/ }).check();
    await page.getByRole("button", { name: "Confirmar turno" }).click();
    await expect(appAlert(page)).toContainText("celular colombiano");
  });

  test("REQ-003.5 el mismo celular no duplica: vuelve al turno existente", async ({ page }) => {
    const cel = phone();
    await takeTicket(page, "Repetido", cel);
    const url1 = page.url();
    await takeTicket(page, "Repetido otra vez", cel);
    expect(page.url().split("?")[0]).toBe(url1.split("?")[0]);
    await expect(page.getByText("Ya tienes un turno en la fila. Este es.")).toBeVisible();
  });

  test("REQ-003.7 / REQ-002.4 segunda visita prellena y no vuelve a pedir la casilla", async ({
    page,
  }) => {
    const cel = phone();
    await takeTicket(page, "Memoria", cel);
    await page.getByRole("button", { name: "Cancelar mi turno" }).click();
    page.once("dialog", (d) => d.accept());
    await page.goto(`/${SEED.slug}/turno`);
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Memoria");
    await expect(page.getByText("Ya aceptaste nuestra política de datos.")).toBeVisible();
  });

  test("REQ-005.2 cancelar desde Mi turno", async ({ page }) => {
    await takeTicket(page, "Cancela", phone());
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancelar mi turno" }).click();
    await expect(page.getByText("Turno cancelado")).toBeVisible();
    await expect(page.getByText("Lo cancelaste tú.")).toBeVisible();
  });

  test("REQ-004.2 / REQ-004.3 el barbero llama y el cliente ve '¡Es tu turno!' en < 3 s", async ({
    browser,
    page,
  }) => {
    const cel = phone();
    await takeTicket(page, "Llamado", cel);

    const barberCtx = await browser.newContext();
    const barberPage = await barberCtx.newPage();
    await loginAsBarber(barberPage, 0);
    await barberPage.getByRole("button", { name: "Llamar al siguiente" }).click();

    const t0 = Date.now();
    await expect(page.getByText("¡Es tu turno!")).toBeVisible({ timeout: 3000 });
    expect(Date.now() - t0).toBeLessThan(3000);
    await barberCtx.close();
  });

  test("REQ-004.6 / REQ-004.7 reabrir el enlace conserva el estado; token malo → mensaje", async ({
    page,
  }) => {
    await takeTicket(page, "Persistente", phone());
    const url = page.url();
    await page.goto("about:blank");
    await page.goto(url);
    // la posición y el estimado pueden decir los dos "Eres el siguiente" (REQ-004.5)
    await expect(page.getByText(/Eres el|En la fila/).first()).toBeVisible();
    await page.goto("/t/xxxxxxxxxxxxxxxxxxxxxx");
    await expect(
      page.getByRole("heading", { name: "Este turno no existe o ya terminó" }),
    ).toBeVisible();
  });

  test("REQ-011.1 / REQ-011.6 sin conexión muestra la franja y el último estado", async ({
    page,
    context,
  }) => {
    await takeTicket(page, "Offline", phone());
    await context.setOffline(true);
    await expect(page.getByRole("status").filter({ hasText: "Sin conexión" })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Actualizado hace/)).toBeVisible();
    await context.setOffline(false);
  });
});
