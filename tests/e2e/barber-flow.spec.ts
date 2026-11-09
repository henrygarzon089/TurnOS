import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { CALL, appAlert, loginAsBarber, resetQueue, SEED } from "./helpers";

const phone = () => `300 8${Math.floor(100000 + Math.random() * 899999)}`;

async function customerTakesTicket(ctx: BrowserContext, name: string, preferBarber?: string) {
  const page = await ctx.newPage();
  await page.goto(`/${SEED.slug}/turno`);
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Tu celular (WhatsApp)").fill(phone());
  await page.getByRole("radio", { name: /Corte · 20 min/ }).check();
  if (preferBarber) await page.getByRole("radio", { name: preferBarber }).click();
  await page.getByRole("checkbox", { name: /Acepto que/ }).check();
  await page.getByRole("button", { name: "Confirmar turno" }).click();
  await expect(page).toHaveURL(/\/t\//);
  return page;
}

async function ensurePresent(page: Page) {
  const here = page.getByRole("button", { name: "Estoy aquí" });
  if (await here.isVisible()) await here.click();
  const back = page.getByRole("button", { name: "Volver" });
  if (await back.isVisible()) await back.click();
}

test.describe("Hito 1 · flujo del barbero", () => {
  // En el build de producción la app registra un service worker (PWA) y Playwright no intercepta
  // lo que pasa por él: sin esto, la prueba de "sin red" (REQ-011.3) no logra cortar la red.
  test.use({ serviceWorkers: "block" });
  test.beforeEach(resetQueue); // cada prueba parte de la fila vacía

  test("REQ-007.1 → 7.3 → 7.4 llamar, en la silla, terminado; REQ-007.5 bloqueo con turno abierto", async ({
    browser,
    page,
  }) => {
    const cctx = await browser.newContext();
    const customer = await customerTakesTicket(cctx, "Cliente Flujo");

    await loginAsBarber(page, 0); // Juan
    await ensurePresent(page);
    await page.getByRole("button", { name: CALL }).click();
    await expect(page.getByRole("article", { name: /Turno actual/ })).toBeVisible();
    // REQ-007.5: con turno abierto no hay cómo llamar (T-163: el botón de abajo pasa a lo que sigue)
    await expect(page.getByRole("button", { name: CALL })).toHaveCount(0);

    await page.getByRole("button", { name: "Empezar corte" }).click();
    await expect(page.getByText(/^desde .+ · \d+ min$/)).toBeVisible();
    await expect(customer.getByText("Te están atendiendo")).toBeVisible();

    await page.getByRole("button", { name: "Terminar y cobrar" }).click();
    await expect(page.getByText("Nadie en tu fila por ahora")).toBeVisible();
    await expect(customer.getByText("¡Gracias por venir!")).toBeVisible();
    await cctx.close();
  });

  test("REQ-006.1 / REQ-006.5 un turno tomado por otro barbero desaparece en vivo", async ({
    browser,
    page,
  }) => {
    const cctx = await browser.newContext();
    await customerTakesTicket(cctx, "Compartido");

    await loginAsBarber(page, 1); // Pedro
    await ensurePresent(page);
    await expect(page.getByText("Compartido")).toBeVisible();

    const otherCtx = await browser.newContext();
    const juan = await otherCtx.newPage();
    await loginAsBarber(juan, 0);
    await ensurePresent(juan);
    await juan.getByRole("button", { name: CALL }).click();

    await expect(page.getByText("Compartido")).toBeHidden({ timeout: 5000 });
    await juan.getByRole("button", { name: "No vino" }).click();
    await otherCtx.close();
    await cctx.close();
  });

  test("REQ-008.2 no llegó: el cliente ve el mensaje y puede tomar turno nuevo", async ({
    browser,
    page,
  }) => {
    const cctx = await browser.newContext();
    const customer = await customerTakesTicket(cctx, "No Llega");
    await loginAsBarber(page, 2); // Luis
    await ensurePresent(page);
    await page.getByRole("button", { name: CALL }).click();
    await page.getByRole("button", { name: "No vino" }).click();
    await expect(customer.getByText("Te llamamos y no estabas")).toBeVisible();
    await expect(customer.getByRole("link", { name: "Tomar un turno nuevo" })).toBeVisible();
    await cctx.close();
  });

  test("REQ-010.2 pausar con clientes propios muestra la hoja y los reasigna; REQ-010.3 el cliente lo ve", async ({
    browser,
    page,
  }) => {
    const cctx = await browser.newContext();
    const customer = await customerTakesTicket(cctx, "Fiel", "Andrés");
    await loginAsBarber(page, 3); // Andrés
    await ensurePresent(page);
    await page.getByRole("button", { name: "Pausar" }).click();
    await expect(page.getByRole("dialog", { name: "Pausar" })).toContainText("esperándote");
    await page.getByRole("button", { name: "Que los atienda el que esté libre" }).click();
    await expect(page.getByText("En pausa")).toBeVisible();
    await expect(customer.getByText("El que esté libre")).toBeVisible();
    await page.getByRole("button", { name: "Volver" }).click();
    await expect(page.getByText("Disponible")).toBeVisible();
    await cctx.close();
  });

  test("REQ-009.2 / REQ-009.3 el botón Avisar abre wa.me con el mensaje y queda 'Avisado'", async ({
    browser,
    page,
  }) => {
    test.setTimeout(60_000);
    // Un turno activo por celular: cada cliente en su propio contexto
    const first = await browser.newContext();
    await customerTakesTicket(first, "Primero");
    const cctx = await browser.newContext();
    await customerTakesTicket(cctx, "Avisable");
    await loginAsBarber(page, 4); // Mateo
    await ensurePresent(page);
    // T-169: "Avisar por WhatsApp" está en la hoja de cada turno de "Después"
    await page.getByTestId("waiting-row").filter({ hasText: "Avisable" }).click();
    const sheet = page.getByRole("dialog", { name: /Avisable/ });
    const link = sheet.getByRole("link", { name: "Avisar por WhatsApp" });
    await expect(link).toHaveAttribute("href", /^https:\/\/wa\.me\/57300\d{7}\?text=/);
    const href = await link.getAttribute("href");
    expect(decodeURIComponent(href!)).toContain("Barbería La 33");
    const [popup] = await Promise.all([page.waitForEvent("popup"), link.click()]);
    await popup.close();
    await expect(sheet.getByText("Avisado ✓")).toBeVisible();
    await first.close();
    await cctx.close();
  });

  test("REQ-011.3 si la red falla, el botón reintenta y muestra error sin cambiar el estado", async ({
    browser,
    page,
  }) => {
    const cctx = await browser.newContext();
    await customerTakesTicket(cctx, "Sin red");
    await loginAsBarber(page, 0);
    await ensurePresent(page);
    // La acción del servidor va a /app/fila (en el build de producción, con query): solo la ruta
    const isQueuePage = (url: URL) => url.pathname === "/app/fila";
    await page.route(isQueuePage, (route) =>
      route.request().method() === "POST" ? route.abort("failed") : route.continue(),
    );
    await page.getByRole("button", { name: CALL }).click();
    await expect(appAlert(page)).toContainText("Revisa tu conexión", { timeout: 15000 });
    await expect(page.getByRole("region", { name: "Turno" })).toContainText("Sigue");
    await page.unroute(isQueuePage);
    await cctx.close();
  });
});
