import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

test("REQ-054.5 la plantilla 'Recordar cita' editada sale en el WhatsApp de 'Citas de mañana'", async ({
  page,
}) => {
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
  const { data: original } = await db
    .from("message_templates")
    .select("body")
    .eq("business_id", biz!.id)
    .eq("key", "appointment_reminder")
    .single();
  const start = new Date(Date.now() + 24 * 60 * 60_000);
  start.setUTCMinutes(0, 0, 0);
  await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz!.id);
  const { error } = await db.from("appointments").insert({
    business_id: biz!.id,
    customer_name: "Plantilla E2E",
    customer_phone_e164: `+5730060${Math.floor(10000 + Math.random() * 89999)}`,
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

  try {
    await loginAsOwner(page);
    await page.goto("/admin/mensajes");
    await page.getByLabel("Recordar cita").fill("Ojo {nombre}, mañana a las {hora}");
    await expect(page.getByText("Ojo Camilo, mañana a las 10:30 a. m.")).toBeVisible();
    await page.getByRole("button", { name: "Guardar plantillas" }).click();
    await expect(page.getByText("Plantillas guardadas.")).toBeVisible();

    await page.goto("/admin/citas");
    const link = page
      .getByRole("region", { name: "Citas de mañana" })
      .getByRole("link", { name: "Recordar a Plantilla E2E" });
    await expect(link).toHaveAttribute("href", /Ojo%20Plantilla%2C%20ma%C3%B1ana%20a%20las%20/);
  } finally {
    await db
      .from("message_templates")
      .update({ body: original!.body })
      .eq("business_id", biz!.id)
      .eq("key", "appointment_reminder");
    await db
      .from("appointments")
      .update({ status: "cancelled", cancel_reason: "business" })
      .eq("business_id", biz!.id)
      .eq("status", "booked");
    await db.from("businesses").update({ appointments_enabled: false }).eq("id", biz!.id);
  }
});
