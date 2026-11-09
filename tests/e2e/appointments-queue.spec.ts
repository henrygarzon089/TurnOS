import { expect, test } from "@playwright/test";
import { CALL, adminDb, appAlert, loginAsBarber, loginAsOwner, resetQueue, SEED } from "./helpers";

const phone = () => `+5730070${Math.floor(10000 + Math.random() * 89999)}`;

/** Citas encendidas para Juan y una cita suya hoy, `inMin` minutos después de ahora. */
async function appointmentToday(name: string, inMin: number) {
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
  // Siempre hoy: cerca de la medianoche de Bogotá (sin horario de verano, -05:00) ahora + inMin caía
  // en el día siguiente. A más tardar a las 23:59: sigue pronto y dentro de los 10 min de gracia.
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const lastMinute = new Date(`${today}T23:59:00-05:00`).getTime();
  const start = new Date(Math.min(Date.now() + inMin * 60_000, lastMinute));
  const { error } = await db.from("appointments").insert({
    business_id: biz!.id,
    customer_name: name,
    customer_phone_e164: phone(),
    service_id: corte!.id,
    service_name: corte!.name,
    service_duration_min: corte!.duration_min,
    service_price: corte!.price,
    barber_id: juan!.id,
    starts_at: start.toISOString(),
    ends_at: new Date(start.getTime() + corte!.duration_min * 60_000).toISOString(),
    business_day: start.toLocaleDateString("en-CA", { timeZone: "America/Bogota" }),
    source: "owner",
  });
  if (error) throw new Error(error.message);
  return { db, businessId: biz!.id as string, juanId: juan!.id as string, corteId: corte!.id };
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

test.describe("REQ-052 Citas en la fila", () => {
  test.beforeEach(resetQueue);

  test("REQ-052.1 el barbero ve su cita de hoy, REQ-052.2 marca 'Llegó' y la llama primero", async ({
    page,
  }) => {
    const { businessId } = await appointmentToday("Cita Llega E2E", 5);
    try {
      await loginAsBarber(page, 0);
      const mine = page.getByRole("region", { name: "Mis citas de hoy" });
      await expect(mine).toContainText("Cita Llega E2E");
      await mine.getByRole("button", { name: "Llegó Cita Llega E2E" }).click();

      const next = page.getByRole("region", { name: "Turno" });
      await expect(next).toContainText("Cita Llega E2E", { timeout: 15_000 });
      await expect(next).toContainText(/Cita \d{1,2}:\d{2}/);
      await expect(page.getByRole("region", { name: "Mis citas de hoy" })).toHaveCount(0);

      await page.getByRole("button", { name: CALL }).click();
      await expect(page.getByRole("article", { name: "Turno actual Cita Llega E2E" })).toBeVisible({
        timeout: 15_000,
      });
    } finally {
      await cleanUp(businessId);
    }
  });

  test("REQ-052.4 no llama a quien no cabe antes de la cita: 'Tu próxima cita es a las…'", async ({
    page,
  }) => {
    const { db, businessId, juanId, corteId } = await appointmentToday("Cita Pronto E2E", 10);
    try {
      const { error } = await db.rpc("join_queue", {
        p_slug: SEED.slug,
        p_name: "Sin Cita E2E",
        p_phone: phone(),
        p_service_id: corteId,
        p_preferred_barber_id: juanId,
        p_privacy_version: null,
        p_source: "link",
        p_birthday_month: null,
        p_birthday_day: null,
        p_courtesy_product_id: null,
        p_whatsapp_opt_in: false,
      });
      if (error) throw new Error(error.message);

      await loginAsBarber(page, 0);
      await page.getByRole("button", { name: CALL }).click();
      await expect(appAlert(page)).toContainText("Tu próxima cita es a las", { timeout: 15_000 });
    } finally {
      await cleanUp(businessId);
    }
  });

  test("REQ-052.1 el dueño ve todas las citas de hoy con su barbero", async ({ page }) => {
    const { businessId } = await appointmentToday("Cita Dueño E2E", 30);
    try {
      await loginAsOwner(page);
      const all = page.getByRole("region", { name: "Citas de hoy" });
      await expect(all).toContainText("Cita Dueño E2E");
      await expect(all).toContainText("con Juan");
      await expect(all.getByRole("button", { name: "Llegó Cita Dueño E2E" })).toBeVisible();
    } finally {
      await cleanUp(businessId);
    }
  });
});
