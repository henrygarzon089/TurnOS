import { expect, test } from "@playwright/test";
import { adminDb, loginAsOwner, SEED } from "./helpers";

test.describe("REQ-049 Citas: encender y elegir barberos", () => {
  test("REQ-049.1 nacen apagadas, REQ-049.6 el dueño las enciende y REQ-049.2 marca quién las recibe", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    await loginAsOwner(page);
    await page.goto("/admin/citas");
    await expect(page.getByRole("heading", { name: "Citas", exact: true })).toBeVisible();

    try {
      await page.getByLabel("Recibir citas").check();
      await page.getByRole("checkbox", { name: "Juan", exact: true }).check();
      await page.getByRole("button", { name: "Guardar" }).click();
      await expect(page.getByRole("status")).toContainText("Guardado", { timeout: 15_000 });

      const { data: z } = await db
        .from("businesses")
        .select("appointments_enabled")
        .eq("id", biz!.id)
        .single();
      expect(z!.appointments_enabled).toBe(true);
      const { data: juan } = await db
        .from("barbers")
        .select("accepts_appointments")
        .eq("business_id", biz!.id)
        .eq("display_name", "Juan")
        .single();
      expect(juan!.accepts_appointments).toBe(true);

      await page.reload();
      await expect(page.getByLabel("Recibir citas")).toBeChecked();
    } finally {
      // Las demás pruebas suponen las citas apagadas (REQ-049.1)
      await db.from("businesses").update({ appointments_enabled: false }).eq("id", biz!.id);
      await db.from("barbers").update({ accepts_appointments: false }).eq("business_id", biz!.id);
    }
  });
});
