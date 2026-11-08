import { expect, test, type Browser, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, resetQueue, SEED, cancelMyTicket } from "./helpers";

/**
 * Hito 6 (design.md §12.7): el servidor corre con WHATSAPP_FAKE_CHANNEL=1 (playwright.config.ts y
 * ci.yml), así que ninguna de estas pruebas manda mensajes reales (REQ-043.4). El aviso queda
 * apagado al terminar cada prueba: las demás suites no deben ver nada nuevo.
 */
const OPT_IN = "Avísame por WhatsApp cuando falte poco";
const HAS_CONSENT = "Te avisamos por WhatsApp cuando falte poco";
const OPT_OUT = "No quiero avisos por WhatsApp";

function phone(): string {
  return `31${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

/** Encendido exige negocio habilitado (REQ-043.6); `allowed` solo lo cambia el operador. */
async function setAuto(enabled: boolean, allowed = enabled) {
  const { error } = await adminDb()
    .from("businesses")
    .update({
      whatsapp_allowed: allowed,
      whatsapp_auto_enabled: enabled,
      whatsapp_contact_phone: null,
    })
    .eq("slug", SEED.slug);
  expect(error).toBeNull();
}

async function consent(cel: string) {
  const { data } = await adminDb()
    .from("customers")
    .select("whatsapp_opt_in_at, whatsapp_opt_out_at")
    .eq("phone_e164", `+57${cel}`)
    .single();
  return data;
}

async function fillForm(page: Page, name: string, cel: string) {
  await page.goto(`/${SEED.slug}/turno`);
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Tu celular (WhatsApp)").fill(cel);
}

async function confirm(page: Page) {
  const privacy = page.getByRole("checkbox", { name: /Acepto que/ });
  if (await privacy.isVisible()) await privacy.check();
  await page.getByRole("button", { name: "Confirmar turno" }).click();
  await expect(page).toHaveURL(/\/t\//, { timeout: 15_000 });
}

async function join(browser: Browser, name: string, cel: string, optIn = false) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await fillForm(page, name, cel);
  if (optIn) await page.getByRole("checkbox", { name: OPT_IN }).check();
  await confirm(page);
  await ctx.close();
}

test.describe("REQ-041 / REQ-042 / REQ-043 aviso por WhatsApp activo", () => {
  test.use({ serviceWorkers: "block" });
  test.beforeEach(async () => {
    await resetQueue();
    await setAuto(true);
  });
  test.afterEach(() => setAuto(false));

  test("REQ-041.1 casilla sin marcar por defecto; no marcarla no impide tomar turno", async ({
    page,
  }) => {
    const cel = phone();
    await fillForm(page, "Sin Permiso", cel);
    const box = page.getByRole("checkbox", { name: OPT_IN });
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();
    await confirm(page);
    expect((await consent(cel))?.whatsapp_opt_in_at).toBeNull();
    await expect(page.getByRole("button", { name: OPT_OUT })).toHaveCount(0);
  });

  test("REQ-041.1 cambiar de celular desmarca la casilla", async ({ page }) => {
    await fillForm(page, "Dos Celulares", phone());
    const box = page.getByRole("checkbox", { name: OPT_IN });
    await box.check();
    await page.getByLabel("Tu celular (WhatsApp)").fill(phone());
    await expect(box).toBeVisible();
    await expect(box).not.toBeChecked();
  });

  test("REQ-041.2 / REQ-041.3 marcarla guarda el permiso; la próxima vez sale la línea", async ({
    page,
  }) => {
    const cel = phone();
    await fillForm(page, "Con Permiso", cel);
    await page.getByRole("checkbox", { name: OPT_IN }).check();
    await confirm(page);
    expect((await consent(cel))?.whatsapp_opt_in_at).not.toBeNull();

    await cancelMyTicket(page);
    await expect(page.getByText("Turno cancelado")).toBeVisible();

    await page.goto(`/${SEED.slug}/turno`);
    await expect(page.getByText(HAS_CONSENT)).toBeVisible();
    await expect(page.getByRole("checkbox", { name: OPT_IN })).toHaveCount(0);
  });

  test('REQ-042.1 / REQ-042.3 baja en "Mi turno" con confirmación; luego vuelve la casilla', async ({
    page,
  }) => {
    const cel = phone();
    await fillForm(page, "Se Da De Baja", cel);
    await page.getByRole("checkbox", { name: OPT_IN }).check();
    await confirm(page);

    // Si no confirma, no pasa nada
    page.once("dialog", (d) => d.dismiss());
    await page.getByRole("button", { name: OPT_OUT }).click();
    await expect(page.getByRole("button", { name: OPT_OUT })).toBeVisible();
    expect((await consent(cel))?.whatsapp_opt_out_at).toBeNull();

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: OPT_OUT }).click();
    await expect(page.getByText("Listo, ya no te avisamos por WhatsApp.")).toBeVisible();
    await expect(page.getByRole("button", { name: OPT_OUT })).toHaveCount(0);
    expect((await consent(cel))?.whatsapp_opt_out_at).not.toBeNull();

    await cancelMyTicket(page);
    await expect(page.getByText("Turno cancelado")).toBeVisible();
    await page.goto(`/${SEED.slug}/turno`);
    await expect(page.getByRole("checkbox", { name: OPT_IN })).toBeVisible();
    await expect(page.getByText(HAS_CONSENT)).toHaveCount(0);
  });

  test('REQ-040.6 / REQ-040.8 con canal falso queda "Avisado ✓" y el botón sigue', async ({
    browser,
    page,
  }) => {
    const cel = phone();
    await join(browser, "Primero Fila", phone());
    await join(browser, "Segundo Fila", phone());
    await join(browser, "Tercero Fila", phone());
    await join(browser, "Con Aviso", cel, true); // 3 delante: al crearse no toca "faltan 2"

    await loginAsBarber(page, 0);
    const here = page.getByRole("button", { name: "Estoy aquí" });
    if (await here.isVisible()) await here.click();
    const back = page.getByRole("button", { name: "Volver" });
    if (await back.isVisible()) await back.click();
    await page.getByRole("button", { name: "Llamar al siguiente" }).click();

    const db = adminDb();
    await expect
      .poll(
        async () => {
          const { data } = await db
            .from("ticket_notifications")
            .select("status, tickets!inner(customer_phone_e164)")
            .eq("tickets.customer_phone_e164", `+57${cel}`)
            .eq("kind", "two_left");
          return data?.[0]?.status;
        },
        { timeout: 10_000 },
      )
      .toBe("sent");

    const row = page.getByRole("listitem").filter({ hasText: "Con Aviso" });
    await expect(row.getByRole("link", { name: "Avisado ✓" })).toBeVisible({ timeout: 10_000 });
  });

  test("REQ-041.4 el turno manual no deja marcar el permiso por el cliente", async ({ page }) => {
    await loginAsOwner(page);
    await page.getByRole("button", { name: "Agregar cliente" }).click();
    const sheet = page.getByRole("dialog", { name: "Agregar cliente" });
    await expect(sheet.getByLabel("Nombre")).toBeVisible();
    await expect(sheet.getByRole("checkbox")).toHaveCount(0);
    await expect(sheet.getByText(/WhatsApp/)).toHaveCount(0);
  });

  test("REQ-040.9 / REQ-043.2 textos fijos y contadores del mes en /admin/mensajes", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/mensajes");
    const auto = page.getByRole("region", { name: "Avisos automáticos" });
    await expect(auto.getByText(/ya casi es tu turno/)).toBeVisible();
    await expect(auto.getByText(/te están llamando en/)).toBeVisible();
    await expect(auto.getByRole("textbox")).toHaveCount(0);
    await expect(auto.getByText("Enviados este mes")).toBeVisible();
    await expect(auto.getByText("Fallidos este mes")).toBeVisible();
    // REQ-040.9 las plantillas de wa.me siguen editables
    await expect(page.getByLabel("Aviso: faltan 2 turnos")).toBeEditable();
  });
});

test.describe("REQ-043.3 interruptor del aviso", () => {
  test.beforeEach(() => setAuto(false));
  test.afterEach(() => setAuto(false));

  test("REQ-043.3 / REQ-042.4 el dueño activa el aviso y guarda el número de contacto", async ({
    page,
  }) => {
    await setAuto(false, true);
    await loginAsOwner(page);
    await page.goto("/admin/negocio");
    const form = page.getByRole("form", { name: "Avisos por WhatsApp" });
    const toggle = form.getByRole("checkbox", { name: "Avisos automáticos activos" });
    await expect(toggle).not.toBeChecked();

    await form.getByLabel("Número de contacto").fill("123");
    await toggle.check();
    await form.getByRole("button", { name: "Guardar avisos" }).click();
    await expect(form.getByText(/celular colombiano/)).toBeVisible();

    await form.getByLabel("Número de contacto").fill("300 123 4567");
    await form.getByRole("button", { name: "Guardar avisos" }).click();
    await expect(form.getByText("Avisos guardados.")).toBeVisible();

    const { data } = await adminDb()
      .from("businesses")
      .select("whatsapp_auto_enabled, whatsapp_contact_phone")
      .eq("slug", SEED.slug)
      .single();
    expect(data).toEqual({
      whatsapp_auto_enabled: true,
      whatsapp_contact_phone: "+573001234567",
    });

    await page.goto(`/${SEED.slug}/turno`);
    await page.getByLabel("Tu celular (WhatsApp)").fill(phone());
    await expect(page.getByRole("checkbox", { name: OPT_IN })).toBeVisible();
  });

  test("REQ-043.6 sin habilitación del operador el dueño no ve el interruptor", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/negocio");
    await expect(page.getByRole("heading", { name: "Mi negocio" })).toBeVisible();
    await expect(page.getByRole("form", { name: "Avisos por WhatsApp" })).toHaveCount(0);
  });

  test("REQ-043.3 apagado no aparece nada nuevo para el cliente ni en mensajes", async ({
    page,
  }) => {
    await resetQueue();
    await fillForm(page, "Aviso Apagado", phone());
    await expect(page.getByText("¿Cuándo cumples años? (opcional)")).toBeVisible();
    await expect(page.getByText(OPT_IN)).toHaveCount(0);
    await expect(page.getByText(HAS_CONSENT)).toHaveCount(0);
    await confirm(page);
    await expect(page.getByRole("button", { name: OPT_OUT })).toHaveCount(0);

    await loginAsOwner(page);
    await page.goto("/admin/mensajes");
    await expect(page.getByLabel("Aviso: faltan 2 turnos")).toBeVisible();
    await expect(page.getByRole("region", { name: "Avisos automáticos" })).toHaveCount(0);
  });
});
