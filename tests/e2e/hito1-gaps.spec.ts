import { expect, test } from "@playwright/test";
import {
  CALL,
  adminDb,
  loginAsBarber,
  loginAsOwner,
  openTicketSheet,
  resetQueue,
  SEED,
} from "./helpers";

const phone = () => `300 6${Math.floor(100000 + Math.random() * 899999)}`;

test.describe("Hito 1 · criterios de interfaz", () => {
  test.beforeEach(resetQueue); // cada prueba parte de la fila vacía

  test("REQ-002.1 el formulario muestra el aviso corto con enlace al completo y casilla desmarcada", async ({
    page,
  }) => {
    await page.goto(`/${SEED.slug}`);
    const box = page.getByRole("checkbox", { name: /Acepto el aviso/ });
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();
    await expect(page.getByRole("link", { name: "aviso de privacidad" })).toHaveAttribute(
      "href",
      `/${SEED.slug}/privacidad`,
    );
    // La portada se relee en vivo (ADR-008): esperar a que termine antes de navegar (WebKit)
    await page.waitForLoadState("networkidle");
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
    await page.goto(`/${SEED.slug}`);
    await page.getByLabel("Tu nombre").fill("Cancelable");
    await page.getByLabel("Tu celular").fill(phone());
    await page.getByRole("checkbox", { name: /Acepto el aviso/ }).check();
    await page.getByRole("button", { name: "Tomar turno" }).click();
    await expect(page.getByRole("button", { name: "Cancelar turno", exact: true })).toBeVisible();

    const bctx = await browser.newContext();
    const barber = await bctx.newPage();
    await loginAsBarber(barber, 0);
    const here = barber.getByRole("button", { name: "Estoy aquí" });
    if (await here.isVisible()) await here.click();
    await barber.getByRole("button", { name: CALL }).click();
    await barber.getByRole("button", { name: "Empezar corte" }).click();
    await expect(page.getByRole("button", { name: "Cancelar turno", exact: true })).toBeHidden();
    await barber.getByRole("button", { name: "Terminar y cobrar" }).click();
    // REQ-004.4 estado final con agradecimiento ("Quedaste bien, <nombre>.", REQ-078.23)
    await expect(page.getByText(/^Quedaste bien, /)).toBeVisible();
    await bctx.close();
  });

  test("REQ-006.2 / REQ-006.4 / REQ-008.1 la fila del barbero muestra datos del turno, su estado y resalta la gracia", async ({
    page,
    browser,
  }) => {
    const cctx = await browser.newContext();
    const c = await cctx.newPage();
    await c.goto(`/${SEED.slug}`);
    await c.getByLabel("Tu nombre").fill("Detalle Fila");
    await c.getByLabel("Tu celular").fill(phone());
    await c.getByRole("radio", { name: /^Barba\s+\$/ }).check();
    await c.getByRole("radio", { name: "Pedro" }).click();
    await c.getByRole("checkbox", { name: /Acepto el aviso/ }).check();
    await c.getByRole("button", { name: "Tomar turno" }).click();

    await loginAsBarber(page, 1); // Pedro
    const here = page.getByRole("button", { name: "Estoy aquí" });
    if (await here.isVisible()) await here.click();
    await expect(page.getByText(/Disponible|En servicio|En pausa/)).toBeVisible(); // REQ-006.4
    // T-169: el detalle del turno está en su hoja (tocar "Sigue" o la fila)
    const row = await openTicketSheet(page, "Detalle Fila");
    await expect(row).toContainText("Barba 15 min"); // REQ-006.2 servicio y duración
    await expect(row).toContainText(/esperando hace \d+ min/); // REQ-006.2 hace cuánto llegó
    await expect(row).toContainText("te eligió"); // REQ-006.2 lo eligió a él
    // REQ-009.4 el botón de aviso existe en cualquier posición
    await expect(row.getByRole("link", { name: "Avisar por WhatsApp" })).toBeVisible();
    await row.getByRole("button", { name: "Cerrar", exact: true }).click();

    await page.getByRole("button", { name: CALL }).click();
    // REQ-008.1 el botón "No llegó" está disponible desde el llamado; el resaltado llega a los 5 min
    await expect(page.getByRole("button", { name: "No vino" })).toBeVisible();
    await page.getByRole("button", { name: "No vino" }).click();
    await cctx.close();
  });

  test("REQ-012.1 / REQ-012.5 el dueño ve toda la fila y el estado de los barberos", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/fila");
    await expect(page.getByRole("heading", { name: "Fila" })).toBeVisible();
    // REQ-078.30: el estado va en el encabezado de cada carril (escritorio) o en "No están hoy"
    await page.setViewportSize({ width: 1280, height: 900 });
    for (const b of SEED.barbers) {
      const lane = page.getByRole("region", { name: `Carril de ${b.name}` });
      const absent = page.getByRole("button", { name: `Marcar a ${b.name} presente` });
      await expect(lane.or(absent)).toBeVisible();
    }
    // REQ-012.5: el dueño puede operar también como barbero cuando tiene silla; en el seed no la
    // tiene, así que /app/fila lo redirige a la fila del negocio.
    await page.goto("/app/fila");
    await expect(page.getByRole("link", { name: "Ir a la fila del negocio" })).toBeVisible();
  });

  test("REQ-013.4 / REQ-013.5 la pantalla muestra la franja del llamado 30 s y no exige sesión", async ({
    browser,
  }) => {
    test.skip(!process.env.E2E_SCREEN_KEY, "E2E_SCREEN_KEY no definida");
    const tv = await (
      await browser.newContext({ viewport: { width: 1920, height: 1080 } })
    ).newPage();
    await tv.clock.install(); // el reloj corre normal; fastForward salta los 30 s
    await tv.goto(`/${SEED.slug}/pantalla?k=${process.env.E2E_SCREEN_KEY}`);
    await expect(tv.getByRole("heading", { name: "Barbería La 33" })).toBeVisible();
    await expect(tv).not.toHaveURL(/entrar/); // sin login

    const cctx = await browser.newContext();
    const c = await cctx.newPage();
    await c.goto(`/${SEED.slug}`);
    await c.getByLabel("Tu nombre").fill("Pantalla Prueba");
    await c.getByLabel("Tu celular").fill(phone());
    await c.getByRole("checkbox", { name: /Acepto el aviso/ }).check();
    await c.getByRole("button", { name: "Tomar turno" }).click();

    const bctx = await browser.newContext();
    const barber = await bctx.newPage();
    await loginAsBarber(barber, 2);
    const here = barber.getByRole("button", { name: "Estoy aquí" });
    if (await here.isVisible()) await here.click();
    await barber.getByRole("button", { name: CALL }).click();
    const banner = tv.locator('[data-call-slot="full"]');
    await expect(banner).toBeVisible({ timeout: 5000 });
    await expect(banner).toContainText("LLAMANDO A");
    await expect(banner).toContainText("Pantalla P.");
    await expect(banner).toContainText(`→ ${SEED.barbers[2].name}`);
    await expect(banner).not.toContainText(/\+57|300 \d{3}/);
    await tv.clock.fastForward(31_000);
    await expect(banner).toHaveCount(0);
    await expect(tv.locator('[data-call-slot="empty"]')).toHaveCount(1);
    await barber.getByRole("button", { name: "No vino" }).click();
    await bctx.close();
    await cctx.close();
  });
});
