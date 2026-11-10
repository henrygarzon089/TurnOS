import { expect, test } from "@playwright/test";
import { adminDb, SEED } from "./helpers";

const phone = () => `300 8${Math.floor(100000 + Math.random() * 899999)}`;

test.describe("REQ-050 y REQ-051 Reservar cita y Mi cita", () => {
  test("REQ-050.1 reserva desde la portada, REQ-051.1 la ve, REQ-051.3 baja el calendario y REQ-051.2 cancela", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz!.id);
    await db
      .from("barbers")
      .update({ accepts_appointments: true })
      .eq("business_id", biz!.id)
      .eq("display_name", "Juan");

    try {
      // La portada (T-173) lleva a /cita con lo que el cliente ya eligió
      await page.goto(`/${SEED.slug}`);
      await page.getByRole("link", { name: "Reservar una cita" }).click();
      await expect(page.getByRole("heading", { name: "Reservar una cita" })).toBeVisible();

      // El primer servicio va elegido (en CI puede no ser "Corte": otras pruebas crean servicios)
      await expect(page.getByTestId("row-service")).toContainText(/^Servicio\S.+Cambiar$/);
      // Un día con horas que no sea hoy: hoy puede no tener horas a 1 hora de ahora
      const days = page.getByRole("radiogroup", { name: "Día" });
      await expect(days.getByRole("radio", { disabled: false }).first()).toBeAttached({
        timeout: 15_000,
      });
      // Espera a que lleguen las horas: los días sin horas quedan deshabilitados
      await expect(
        page
          .getByRole("radiogroup", { name: "Hora" })
          .or(page.getByText(/ya no tiene horas|Ya no quedan horas/)),
      ).toBeVisible({ timeout: 15_000 });
      await days
        .locator("label")
        .filter({ has: page.locator("input:not([disabled])") })
        .last()
        .click();
      const hours = page.getByRole("radiogroup", { name: "Hora" }).locator("label");
      await expect(hours.first()).toBeVisible({ timeout: 15_000 });
      const hourText = (await hours.first().textContent())!.trim();
      await hours.first().click();

      await page.getByLabel("Tu nombre").fill("Cita E2E");
      await page.getByLabel("Tu celular").fill(phone());
      const box = page.getByRole("checkbox", { name: /Acepto el aviso/ });
      if (await box.isVisible()) await box.check();
      await page.getByRole("button", { name: /^Confirmar · / }).click();

      await expect(page).toHaveURL(/\/c\/[A-Za-z0-9_-]{16,}/, { timeout: 15_000 });
      await expect(page.getByText("Tu cita", { exact: true })).toBeVisible();
      await expect(page.getByTestId("appointment-time")).toHaveText(hourText);
      await expect(page.getByText("te esperamos hasta 10 minutos")).toBeVisible();
      await expect(page.getByTestId("row-barbero")).toContainText("Juan");
      // REQ-051.6: nada del celular
      await expect(page.getByText(/\+57|300 8/)).toHaveCount(0);

      const href = await page
        .getByRole("link", { name: "Agregar al calendario" })
        .getAttribute("href");
      const ics = await page.request.get(href!);
      expect(ics.headers()["content-type"]).toContain("text/calendar");
      const body = await ics.text();
      expect(body).toContain("BEGIN:VEVENT");
      expect(body.replace(/\r\n /g, "")).toContain(page.url().split("?")[0].split("/c/")[1]);

      await page.getByRole("button", { name: "Cancelar la cita", exact: true }).click();
      await page
        .getByRole("dialog", { name: /cancelar tu cita/ })
        .getByRole("button", { name: "Sí, cancelar mi cita" })
        .click();
      await expect(page.getByTestId("appointment-status")).toHaveText("Cita cancelada", {
        timeout: 15_000,
      });
      await expect(page.getByRole("link", { name: "Reservar otra" })).toBeVisible();
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
