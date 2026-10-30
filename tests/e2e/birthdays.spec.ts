import { expect, test, type Page } from "@playwright/test";
import { businessDayBogota } from "../../src/lib/domain/time";
import { adminDb, loginAsBarber, loginAsOwner, resetQueue, SEED } from "./helpers";

/** Cliente del seed sin cumpleaños (el seed se lo pone a los tres primeros). */
const CUSTOMER = { name: "Valentina", phone: "+573002000004" };

function phone(): string {
  return `32${Math.floor(10_000_000 + Math.random() * 89_999_999)}`;
}

async function setBirthday(e164: string, on: Date | null) {
  const db = adminDb();
  const { error } = await db
    .from("customers")
    .update(
      on
        ? { birthday_day: on.getUTCDate(), birthday_month: on.getUTCMonth() + 1 }
        : { birthday_day: null, birthday_month: null },
    )
    .eq("phone_e164", e164);
  expect(error).toBeNull();
}

async function fillForm(page: Page, name: string, cel: string) {
  await page.goto(`/${SEED.slug}/turno`);
  await page.getByLabel("Tu nombre").fill(name);
  await page.getByLabel("Tu celular (WhatsApp)").fill(cel);
}

async function confirm(page: Page) {
  const box = page.getByRole("checkbox");
  if (await box.isVisible()) await box.check();
  await page.getByRole("button", { name: "Confirmar turno" }).click();
}

const bdayField = (page: Page) => page.getByRole("group", { name: /Cuándo cumples años/ });

test.describe("REQ-037 cumpleaños", () => {
  test.beforeEach(resetQueue);

  test("REQ-037.2 el campo aparece sin cumpleaños y no reaparece la segunda vez", async ({
    page,
  }) => {
    const cel = phone();
    await fillForm(page, "Cumple Nuevo", cel);
    await expect(page.getByText("¿Cuándo cumples años? (opcional)")).toBeVisible();
    await bdayField(page).getByLabel("Día").fill("29");
    await bdayField(page).getByLabel("Mes").selectOption({ label: "Febrero" });
    await confirm(page);
    await expect(page).toHaveURL(/\/t\//, { timeout: 15_000 });

    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Cancelar mi turno" }).click();
    await expect(page.getByText("Turno cancelado")).toBeVisible();

    // Mismo navegador: el celular se prellena y el campo ya no está
    await page.goto(`/${SEED.slug}/turno`);
    await expect(page.getByLabel("Tu nombre")).toHaveValue("Cumple Nuevo");
    await expect(page.getByLabel("Tu celular (WhatsApp)")).not.toHaveValue("");
    await page.waitForLoadState("networkidle");
    await expect(page.getByText("¿Cuándo cumples años? (opcional)")).toHaveCount(0);
  });

  test("REQ-037.2 el campo es opcional: se toma turno sin llenarlo", async ({ page }) => {
    await fillForm(page, "Sin Cumple", phone());
    await expect(bdayField(page)).toBeVisible();
    await confirm(page);
    await expect(page).toHaveURL(/\/t\//, { timeout: 15_000 });
  });

  test("REQ-037.3 '31 de abril' muestra 'Esa fecha no existe' en el formulario", async ({
    page,
  }) => {
    await fillForm(page, "Fecha Mala", phone());
    await bdayField(page).getByLabel("Día").fill("31");
    await bdayField(page).getByLabel("Mes").selectOption({ label: "Abril" });
    await confirm(page);
    await expect(page.getByText("Esa fecha no existe")).toBeVisible();
    await expect(page).toHaveURL(/\/turno/);
  });

  test("REQ-037.4 la lista muestra al que cumple mañana con botón de WhatsApp", async ({
    page,
  }) => {
    const today = new Date(`${businessDayBogota()}T00:00:00Z`);
    await setBirthday(CUSTOMER.phone, new Date(today.getTime() + 86_400_000));
    try {
      await loginAsOwner(page);
      await page.goto("/admin/recordar");
      const list = page.getByRole("list", { name: "Cumplen esta semana" });
      const row = list.getByRole("listitem").filter({ hasText: CUSTOMER.name });
      await expect(row).toContainText("Mañana");
      const link = row.getByRole("link", { name: /Saludar por WhatsApp/ });
      const href = await link.getAttribute("href");
      expect(href).toMatch(/^https:\/\/wa\.me\/57\d{10}\?text=/);
      expect(decodeURIComponent(href!)).toContain(`¡Feliz cumpleaños, ${CUSTOMER.name}!`);
    } finally {
      await setBirthday(CUSTOMER.phone, null);
    }
  });

  test("REQ-037.5 'no contactar' sale de la lista", async ({ page }) => {
    const db = adminDb();
    const today = new Date(`${businessDayBogota()}T00:00:00Z`);
    await setBirthday(CUSTOMER.phone, today);
    await db.from("customers").update({ do_not_contact: true }).eq("phone_e164", CUSTOMER.phone);
    try {
      await loginAsOwner(page);
      await page.goto("/admin/recordar");
      await expect(page.getByRole("heading", { name: "Cumplen esta semana" })).toBeVisible();
      await expect(
        page
          .getByRole("list", { name: "Cumplen esta semana" })
          .getByRole("listitem")
          .filter({ hasText: CUSTOMER.name }),
      ).toHaveCount(0);
    } finally {
      await db.from("customers").update({ do_not_contact: false }).eq("phone_e164", CUSTOMER.phone);
      await setBirthday(CUSTOMER.phone, null);
    }
  });

  test("REQ-037.4 el dueño edita la plantilla 'cumpleaños' en Mensajes y la lista la usa", async ({
    page,
  }) => {
    await setBirthday(CUSTOMER.phone, new Date(`${businessDayBogota()}T00:00:00Z`));
    await loginAsOwner(page);
    await page.goto("/admin/mensajes");
    const field = page.getByLabel("Cumpleaños");
    const original = await field.inputValue();
    expect(original).toContain("{nombre}");
    try {
      await field.fill("Feliz día, {nombre}. Te abrazan en {negocio}.");
      await page.getByRole("button", { name: "Guardar plantillas" }).click();
      await expect(page.getByText("Plantillas guardadas.")).toBeVisible();

      await page.goto("/admin/recordar");
      const href = await page
        .getByRole("list", { name: "Cumplen esta semana" })
        .getByRole("link", { name: /Saludar por WhatsApp/ })
        .first()
        .getAttribute("href");
      expect(decodeURIComponent(href!)).toContain("Te abrazan en");
    } finally {
      await page.goto("/admin/mensajes");
      await page.getByLabel("Cumpleaños").fill(original);
      await page.getByRole("button", { name: "Guardar plantillas" }).click();
      await expect(page.getByText("Plantillas guardadas.")).toBeVisible();
      await setBirthday(CUSTOMER.phone, null);
    }
  });

  test("REQ-037.1 el dueño edita día y mes en la ficha; fecha imposible no se guarda", async ({
    page,
  }) => {
    try {
      await loginAsOwner(page);
      await page.goto("/app/clientes");
      await page.getByLabel("Buscar cliente").fill(CUSTOMER.name);
      await page
        .getByRole("link", { name: new RegExp(CUSTOMER.name) })
        .first()
        .click();
      const form = page.getByRole("group", { name: "Cumpleaños" });
      await form.getByLabel("Día").fill("30");
      await form.getByLabel("Mes").selectOption({ label: "Febrero" });
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText("Esa fecha no existe")).toBeVisible();
      await expect(form.getByLabel("Mes")).toHaveValue("2"); // no se pierde lo escrito

      await form.getByLabel("Día").fill("29");
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText("Guardado")).toBeVisible();
      await page.reload();
      await expect(form.getByLabel("Día")).toHaveValue("29");
      await expect(form.getByLabel("Mes")).toHaveValue("2");
    } finally {
      await setBirthday(CUSTOMER.phone, null);
    }
  });

  test("REQ-037.1 el barbero con alcance sobre la ficha también la edita", async ({ page }) => {
    const db = adminDb();
    const e164 = "+573002000005"; // Mateo Londoño: del seed, atendido por Juan
    try {
      await loginAsBarber(page, 0);
      await page.goto("/app/clientes");
      await page.getByLabel("Buscar cliente").fill("Mateo");
      await page
        .getByRole("link", { name: /Mateo Londoño/ })
        .first()
        .click();
      const form = page.getByRole("group", { name: "Cumpleaños" });
      await form.getByLabel("Día").fill("15");
      await form.getByLabel("Mes").selectOption({ label: "Junio" });
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByText("Guardado")).toBeVisible();
      const { data: after } = await db
        .from("customers")
        .select("birthday_day, birthday_month")
        .eq("phone_e164", e164)
        .single();
      expect(after).toEqual({ birthday_day: 15, birthday_month: 6 });
    } finally {
      await setBirthday(e164, null);
    }
  });
});
