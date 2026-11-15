import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED, waitForContent } from "./helpers";

/**
 * T-262 · REQ-096 (ADR-070): el dueño escribe la descripción de un servicio en "Servicios" y el
 * cliente la ve en la tarjeta al tomar turno y al reservar. Se usa un servicio de prueba por
 * proyecto (android / iphone) para no pisar "Corte".
 */
let NAME = "Peinado E2E";
const TEXT = "Lavado, secado y peinado con cera";

async function ids() {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: juan } = await db
    .from("barbers")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("display_name", "Juan")
    .single();
  return { db, biz: biz!.id as string, juan: juan!.id as string };
}

async function cleanup() {
  const { db, biz } = await ids();
  await db.from("services").delete().eq("business_id", biz).eq("name", NAME);
}

const serviceCard = (page: import("@playwright/test").Page) =>
  page.getByRole("radio", { name: new RegExp(`^${NAME}`) });

test.describe("REQ-096 descripción de los servicios", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeAll(async ({}, info) => {
    NAME = `Peinado E2E ${info.project.name}`;
    await cleanup();
    const { db, biz } = await ids();
    // El trigger marca a todos los barberos para el servicio nuevo (REQ-035.2)
    await db
      .from("services")
      .insert({ business_id: biz, name: NAME, duration_min: 20, price: 15000, sort_order: 95 });
  });
  test.afterAll(cleanup);

  test("REQ-096.1 el dueño escribe la descripción en la hoja de editar servicio, con contador", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/servicios");
    await page
      .getByRole("article", { name: `Servicio ${NAME}` })
      .getByRole("button", { name: "Editar" })
      .click();
    const form = page.getByRole("form", { name: `Servicio ${NAME}` });
    await expect(
      form.getByText("Opcional. La ve el cliente al escoger el servicio."),
    ).toBeVisible();
    await expect(form.getByText("0/140")).toBeVisible();
    await form.getByLabel("Descripción").fill(`  ${TEXT}\n`);
    await expect(form.getByText(`${TEXT.length + 3}/140`)).toBeVisible();
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form).toBeHidden();

    // REQ-096.2: se guardó limpia
    const { db, biz } = await ids();
    const { data } = await db
      .from("services")
      .select("description")
      .eq("business_id", biz)
      .eq("name", NAME)
      .single();
    expect(data!.description).toBe(TEXT);
  });

  test("REQ-096.4 al tomar turno, la tarjeta muestra la descripción", async ({ page }) => {
    await page.goto(`/${SEED.slug}`);
    await waitForContent(page);
    await page.getByRole("button", { name: "Tomar turno" }).click();
    const card = serviceCard(page);
    await expect(card.getByTestId("service-description")).toHaveText(TEXT);
    // REQ-096.6: hace parte de la misma opción, después del nombre
    await expect(card).toHaveAccessibleName(new RegExp(`^${NAME}.*${TEXT}`));
  });

  test("REQ-096.4 al reservar una cita, la tarjeta muestra la descripción", async ({ page }) => {
    const { db, biz, juan } = await ids();
    await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz);
    await db.from("barbers").update({ accepts_appointments: true }).eq("id", juan);
    try {
      await page.goto(`/${SEED.slug}/cita?paso=servicio`);
      await expect(serviceCard(page).getByTestId("service-description")).toHaveText(TEXT);
    } finally {
      await db.from("businesses").update({ appointments_enabled: false }).eq("id", biz);
      await db.from("barbers").update({ accepts_appointments: false }).eq("business_id", biz);
    }
  });

  test("REQ-096.5 al borrar la descripción, la tarjeta vuelve a verse como antes", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/servicios");
    await page
      .getByRole("article", { name: `Servicio ${NAME}` })
      .getByRole("button", { name: "Editar" })
      .click();
    const form = page.getByRole("form", { name: `Servicio ${NAME}` });
    await form.getByLabel("Descripción").fill("");
    await form.getByRole("button", { name: "Guardar" }).click();
    await expect(form).toBeHidden();

    await page.goto(`/${SEED.slug}?paso=servicio`);
    await waitForContent(page);
    const card = serviceCard(page);
    await expect(card).toBeVisible();
    await expect(card.getByTestId("service-description")).toHaveCount(0);
  });
});
