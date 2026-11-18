import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, SEED } from "./helpers";

const phone = () => `+5730071${Math.floor(10000 + Math.random() * 89999)}`;

/** Cita pendiente de Juan para mañana a las 10:00 de Bogotá. */
async function appointmentTomorrow(name: string) {
  const db = adminDb();
  const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: juan } = await db
    .from("barbers")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("display_name", "Juan")
    .single();
  const { data: corte } = await db
    .from("services")
    .select("id, name, duration_min, price")
    .eq("business_id", biz!.id)
    .eq("name", "Corte")
    .single();
  await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz!.id);
  await db.from("barbers").update({ accepts_appointments: true }).eq("id", juan!.id);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const t = new Date(`${today}T10:00:00-05:00`);
  t.setUTCDate(t.getUTCDate() + 1);
  const { data, error } = await db
    .from("appointments")
    .insert({
      business_id: biz!.id,
      customer_name: name,
      customer_phone_e164: phone(),
      service_id: corte!.id,
      service_name: corte!.name,
      service_duration_min: corte!.duration_min,
      service_price: corte!.price,
      barber_id: juan!.id,
      starts_at: t.toISOString(),
      ends_at: new Date(t.getTime() + corte!.duration_min * 60_000).toISOString(),
      business_day: t.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
      source: "owner",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { db, businessId: biz!.id as string, id: data!.id as string };
}

async function cleanUp(businessId: string) {
  const db = adminDb();
  await db
    .from("appointments")
    .update({ status: "cancelled", cancel_reason: "business" })
    .eq("business_id", businessId)
    .eq("status", "booked");
  await db.from("businesses").update({ appointments_enabled: false }).eq("id", businessId);
  await db.from("barbers").update({ accepts_appointments: false }).eq("business_id", businessId);
}

test.describe("REQ-099 Mi agenda del barbero", () => {
  test("REQ-099.1 / REQ-099.2 el barbero ve su cita de mañana en Agenda; REQ-099.7 se va al cancelarla", async ({
    page,
  }) => {
    const name = `Agenda E2E ${Date.now() % 100000}`;
    const { db, businessId, id } = await appointmentTomorrow(name);
    try {
      await loginAsBarber(page, 0);
      await page
        .getByRole("navigation", { name: "Menú del barbero" })
        .getByRole("link", { name: "Mi agenda" })
        .click();
      await expect(page).toHaveURL(/\/app\/agenda/);
      const tomorrow = page.getByRole("region", { name: "Mañana" });
      await expect(tomorrow).toContainText(name);
      await expect(tomorrow).toContainText("10:00 a. m.");
      await expect(
        page.getByText("Para cambiar o cancelar una cita, habla con el dueño."),
      ).toBeVisible();
      // REQ-099.4 solo de lectura
      await expect(page.locator("main").getByRole("button")).toHaveCount(0);

      // REQ-099.7 el dueño la cancela: se va sin recargar
      await db
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: "business" })
        .eq("id", id);
      await expect(page.getByText(name)).toHaveCount(0, { timeout: 15_000 });
    } finally {
      await cleanUp(businessId);
    }
  });

  test("REQ-099.3 otro barbero no ve la cita de Juan", async ({ page }) => {
    const name = `Agenda Ajena ${Date.now() % 100000}`;
    const { businessId } = await appointmentTomorrow(name);
    try {
      await loginAsBarber(page, 1);
      await page.goto("/app/agenda");
      await expect(page.getByRole("heading", { name: "Mi agenda" })).toBeVisible();
      await expect(page.getByText(name)).toHaveCount(0);
      await expect(
        page.getByText("No tienes citas reservadas en los próximos días."),
      ).toBeVisible();
    } finally {
      await cleanUp(businessId);
    }
  });
});
