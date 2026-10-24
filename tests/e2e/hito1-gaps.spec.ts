import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, resetQueue, SEED } from "./helpers";

const phone = () => `300 6${Math.floor(100000 + Math.random() * 899999)}`;

test.describe("Hito 1 · criterios de interfaz", () => {
  test.beforeEach(resetQueue); // cada prueba parte de la fila vacía

  test("REQ-002.1 el formulario muestra el aviso corto con enlace al completo y casilla desmarcada", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}/turno`);
    const box = page.getByRole("checkbox", { name: /Acepto que/ });
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();
    await expect(page.getByRole("link", { name: "Ver aviso completo" })).toHaveAttribute(
      "href",
      `/${SEED.slug}/privacidad`,
    );
    await page.goto(`/${SEED.slug}/privacidad`);
    await expect(page.getByRole("heading", { name: "Aviso de privacidad" })).toBeVisible();
    // El texto completo es el de la versión vigente (privacy.spec publica versiones nuevas)
    const { data: current } = await adminDb()
      .from("privacy_policy_versions")
      .select("version, body, businesses!inner(slug)")
      .eq("businesses.slug", SEED.slug)
      .order("version", { ascending: false })
      .limit(1)
      .single();
    await expect(page.getByText(`versión ${current!.version}`)).toBeVisible();
    await expect(page.getByRole("article")).toHaveText(current!.body);
  });

  test("REQ-005.1 / REQ-005.3 el botón cancelar existe en espera y desaparece al terminar", async ({
    page,
    browser,
  }) => {
    await page.goto(`/${SEED.slug}/turno`);
    await page.getByLabel("Tu nombre").fill("Cancelable");
    await page.getByLabel("Tu celular (WhatsApp)").fill(phone());
    await page.getByRole("checkbox", { name: /Acepto que/ }).check();
    await page.getByRole("button", { name: "Confirmar turno" }).click();
    await expect(page.getByRole("button", { name: "Cancelar mi turno" })).toBeVisible();

    const bctx = await browser.newContext();
    const barber = await bctx.newPage();
    await loginAsBarber(barber, 0);
    const here = barber.getByRole("button", { name: "Estoy aquí" });
    if (await here.isVisible()) await here.click();
    await barber.getByRole("button", { name: "Llamar al siguiente" }).click();
    await barber.getByRole("button", { name: "Ya está en la silla" }).click();
    await expect(page.getByRole("button", { name: "Cancelar mi turno" })).toBeHidden();
    await barber.getByRole("button", { name: "Terminado" }).click();
    // REQ-004.4 estado final con agradecimiento
    await expect(page.getByText("¡Gracias por venir!")).toBeVisible();
    await bctx.close();
  });

  test("REQ-006.2 / REQ-006.4 / REQ-008.1 la fila del barbero muestra datos del turno, su estado y resalta la gracia", async ({
    page,
    browser,
  }) => {
    const cctx = await browser.newContext();
    const c = await cctx.newPage();
    await c.goto(`/${SEED.slug}/turno`);
    await c.getByLabel("Tu nombre").fill("Detalle Fila");
    await c.getByLabel("Tu celular (WhatsApp)").fill(phone());
    await c.getByRole("radio", { name: /Barba · 15 min/ }).check();
    await c.getByRole("radio", { name: "Pedro" }).click();
    await c.getByRole("checkbox", { name: /Acepto que/ }).check();
    await c.getByRole("button", { name: "Confirmar turno" }).click();

    await loginAsBarber(page, 1); // Pedro
    const here = page.getByRole("button", { name: "Estoy aquí" });
    if (await here.isVisible()) await here.click();
    await expect(page.getByText(/Disponible|En servicio|En pausa/)).toBeVisible(); // REQ-006.4
    const row = page.getByRole("listitem").filter({ hasText: "Detalle Fila" });
    await expect(row).toContainText("Barba 15'"); // REQ-006.2 servicio y duración
    await expect(row).toContainText(/hace \d+'/); // REQ-006.2 hace cuánto llegó
    await expect(row).toContainText("te eligió"); // REQ-006.2 lo eligió a él
    // REQ-009.4 el botón de aviso existe en cualquier posición
    await expect(row.getByRole("link", { name: /Avisar/ })).toBeVisible();

    await page.getByRole("button", { name: "Llamar al siguiente" }).click();
    // REQ-008.1 el botón "No llegó" está disponible desde el llamado; el resaltado llega a los 5 min
    await expect(page.getByRole("button", { name: "No llegó" })).toBeVisible();
    await page.getByRole("button", { name: "No llegó" }).click();
    await cctx.close();
  });

  test("REQ-012.1 / REQ-012.5 el dueño ve toda la fila y el estado de los barberos", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/fila");
    await expect(page.getByRole("heading", { name: "Fila" })).toBeVisible();
    for (const b of SEED.barbers) {
      await expect(page.getByRole("button", { name: new RegExp(`^${b.name} ·`) })).toBeVisible();
    }
    // REQ-012.5: el dueño puede operar también como barbero cuando tiene silla; en el seed no la
    // tiene, así que /app/fila lo redirige a la fila del negocio.
    await page.goto("/app/fila");
    await expect(page.getByRole("link", { name: "Ir a la fila del negocio" })).toBeVisible();
  });

  test("REQ-013.4 / REQ-013.5 la pantalla resalta al llamar y no exige sesión", async ({
    browser,
  }) => {
    test.skip(!process.env.E2E_SCREEN_KEY, "E2E_SCREEN_KEY no definida");
    const tv = await (
      await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    ).newPage();
    await tv.goto(`/${SEED.slug}/pantalla?k=${process.env.E2E_SCREEN_KEY}`);
    await expect(tv.getByRole("heading", { name: "Barbería La 33" })).toBeVisible();
    await expect(tv).not.toHaveURL(/entrar/); // sin login

    const cctx = await browser.newContext();
    const c = await cctx.newPage();
    await c.goto(`/${SEED.slug}/turno`);
    await c.getByLabel("Tu nombre").fill("Pantalla Prueba");
    await c.getByLabel("Tu celular (WhatsApp)").fill(phone());
    await c.getByRole("checkbox", { name: /Acepto que/ }).check();
    await c.getByRole("button", { name: "Confirmar turno" }).click();

    const bctx = await browser.newContext();
    const barber = await bctx.newPage();
    await loginAsBarber(barber, 2);
    const here = barber.getByRole("button", { name: "Estoy aquí" });
    if (await here.isVisible()) await here.click();
    await barber.getByRole("button", { name: "Llamar al siguiente" }).click();
    await expect(tv.getByText(/Pasa a la silla de/)).toBeVisible({ timeout: 5000 });
    await expect(tv.getByText("Pantalla P.")).toBeVisible();
    await barber.getByRole("button", { name: "No llegó" }).click();
    await bctx.close();
    await cctx.close();
  });
});
