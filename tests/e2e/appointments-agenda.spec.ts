import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

const phone = () => `300 7${Math.floor(100000 + Math.random() * 899999)}`;

test.describe("REQ-054 Agenda del dueño", () => {
  test("REQ-050.6 nueva cita con wa.me, REQ-054.3 citas de mañana, REQ-054.2 pasar a otro barbero y cancelar", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz!.id);
    await db
      .from("barbers")
      .update({ accepts_appointments: true })
      .eq("business_id", biz!.id)
      .in("display_name", ["Juan", "Pedro"]);
    const name = `Agenda E2E ${Math.floor(Math.random() * 10000)}`;

    try {
      await loginAsOwner(page);
      await page.goto("/admin/citas");
      await page.getByRole("button", { name: "Nueva cita" }).click();
      // "Corte" es el primer servicio: viene escogido
      await page
        .getByRole("radiogroup", { name: "Barbero" })
        .getByRole("radio", { name: "Juan" })
        .click();
      await page
        .getByRole("radiogroup", { name: "Día" })
        .getByRole("radio", { name: "Mañana" })
        .click();
      const hours = page.getByRole("radiogroup", { name: "Hora" }).getByRole("radio");
      await expect(hours.first()).toBeVisible({ timeout: 15_000 });
      await hours.first().click();
      await page.getByLabel("Nombre del cliente").fill(name);
      await page.getByLabel("Celular del cliente").fill(phone());
      await page.getByRole("button", { name: "Crear cita" }).click();

      await expect(page.getByRole("status")).toContainText("Cita creada.", { timeout: 15_000 });
      const send = page.getByRole("link", { name: "Enviar por WhatsApp" });
      await expect(send).toHaveAttribute("href", /^https:\/\/wa\.me\/57.*%2Fc%2F/);

      const tomorrow = page.getByRole("region", { name: "Citas de mañana" });
      await expect(tomorrow).toContainText(name);
      await expect(tomorrow.getByRole("link", { name: `Recordar a ${name}` })).toHaveAttribute(
        "href",
        /^https:\/\/wa\.me\//,
      );

      const row = page.getByRole("listitem", { name: `Cita de ${name}` });
      await expect(row).toContainText("con Juan");
      await row.getByLabel(`Pasar la cita de ${name} a`).selectOption({ label: "Pedro" });
      await row.getByRole("button", { name: "Pasar" }).click();
      await expect(row).toContainText("con Pedro", { timeout: 15_000 });

      page.once("dialog", (d) => d.accept());
      await row.getByRole("button", { name: "Cancelar" }).click();
      await expect(row).toContainText("Cancelada", { timeout: 15_000 });
      await expect(row.getByRole("link", { name: "Avisarle por WhatsApp" })).toHaveAttribute(
        "href",
        /^https:\/\/wa\.me\//,
      );
    } finally {
      await db
        .from("appointments")
        .update({ status: "cancelled", cancel_reason: "business" })
        .eq("business_id", biz!.id)
        .eq("status", "booked");
      await db.from("businesses").update({ appointments_enabled: false }).eq("id", biz!.id);
      await db.from("barbers").update({ accepts_appointments: false }).eq("business_id", biz!.id);
    }
  });
});
