import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, SEED, waitForContent } from "./helpers";

// Archivos inventados, sin datos reales (CLAUDE.md, Seguridad).
const rnd = () => Math.floor(1_000_000 + Math.random() * 8_999_999);
const pad = (n: number) => String(n).padStart(2, "0");

/** Un día abierto entre mañana y +6, y una hora libre al azar dentro del horario (Bogotá). */
async function openSlot(businessId: string) {
  const db = adminDb();
  const { data: hours } = await db
    .from("business_hours")
    .select("weekday, opens_at, is_closed")
    .eq("business_id", businessId);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  for (let k = 1; k <= 6; k++) {
    const d = new Date(`${today}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + k);
    const h = hours?.find((x) => x.weekday === d.getUTCDay());
    if (h && h.is_closed) continue;
    const [oh, om] = String(h?.opens_at ?? "09:00")
      .split(":")
      .map(Number);
    const start = oh * 60 + om + 15 * Math.floor(Math.random() * 16);
    return {
      day: d.toISOString().slice(0, 10),
      time: `${pad(Math.floor(start / 60))}:${pad(start % 60)}`,
    };
  }
  throw new Error("sin día abierto");
}

test.describe("REQ-100 Importar de Fresha", () => {
  test("REQ-100.1 / 100.2 / 100.7 / 100.8 / 100.10 resumen, pareja de barbero, importar y no duplicar", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    await db.from("businesses").update({ appointments_enabled: true }).eq("id", biz!.id);
    const n = rnd();
    const phoneA = `300${n}`;
    const phoneB = `301${n}`;
    const nameA = `Fresha A ${n}`;
    const nameB = `Fresha B ${n}`;
    const slot = await openSlot(biz!.id);

    const clientsCsv = [
      "First Name,Last Name,Mobile Number,Email,Date of Birth,Note",
      `Fresha,A ${n},${phoneA},a@example.com,1990-05-03,Prefiere tijera`,
      `Fresha,B ${n},${phoneB},,,`,
      `Sin,Celular,,,,`,
    ].join("\n");
    const apptsCsv = [
      "Ref #,Client,Service,Team Member,Scheduled Date,Time,Duration,Status",
      `E2E-${n}-1,${nameA},Corte,Pepe Fresha,${slot.day},${slot.time},30min,Booked`,
      `E2E-${n}-2,${nameB},Corte,Juan,2020-01-01,10:00,30min,Booked`,
      `E2E-${n}-3,${nameB},Corte,Juan,${slot.day},${slot.time},30min,Cancelled`,
    ].join("\n");

    try {
      await loginAsOwner(page);
      await page.goto("/app/clientes");
      await page.getByRole("link", { name: "Importar de Fresha" }).click();
      await expect(
        page.getByRole("heading", { name: "Importar de Fresha", level: 1 }),
      ).toBeVisible();
      await waitForContent(page);

      await page.getByLabel("Archivo de clientes").setInputFiles({
        name: "clientes.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(clientsCsv),
      });
      await page.getByLabel("Archivo de citas").setInputFiles({
        name: "citas.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(apptsCsv),
      });
      await page.getByRole("button", { name: "Revisar" }).click();

      const clients = page.getByRole("list", { name: "Clientes" });
      await expect(
        clients.getByRole("listitem").filter({ hasText: "Clientes nuevos" }),
      ).toContainText("2");
      await expect(clients.getByRole("listitem").filter({ hasText: "Sin celular" })).toContainText(
        "1",
      );
      const appts = page.getByRole("list", { name: "Citas" });
      await expect(
        appts.getByRole("listitem").filter({ hasText: "de hoy en adelante" }),
      ).toContainText("1");
      await expect(appts.getByRole("listitem").filter({ hasText: "días pasados" })).toContainText(
        "1",
      );
      await expect(appts.getByRole("listitem").filter({ hasText: "Canceladas" })).toContainText(
        "1",
      );
      // Nada se guardó todavía
      const before = await db
        .from("customers")
        .select("id")
        .eq("business_id", biz!.id)
        .in("phone_e164", [`+57${phoneA}`]);
      expect(before.data).toHaveLength(0);

      // REQ-100.7 "Pepe Fresha" no existe en la app: se empareja con Pedro
      await page.getByLabel('Barbero "Pepe Fresha"').selectOption({ label: "Pedro" });
      await page.getByRole("button", { name: "Importar", exact: true }).click();

      await expect(page.getByRole("heading", { name: "Importación lista" })).toBeVisible({
        timeout: 15_000,
      });
      await expect(page.getByRole("listitem").filter({ hasText: "Citas creadas" })).toContainText(
        "1",
      );

      const { data: appt } = await db
        .from("appointments")
        .select("barber_id, customer_name, status, barbers:barber_id ( display_name )")
        .eq("business_id", biz!.id)
        .eq("external_ref", `E2E-${n}-1`)
        .single();
      expect(appt?.status).toBe("booked");
      expect(appt?.customer_name).toBe(nameA);
      const { data: cust } = await db
        .from("customers")
        .select("privacy_accepted_at, imported_from, birthday_month, notes")
        .eq("business_id", biz!.id)
        .eq("phone_e164", `+57${phoneA}`)
        .single();
      expect(cust).toMatchObject({
        privacy_accepted_at: null,
        imported_from: "fresha",
        birthday_month: 5,
      });
      expect(cust?.notes).toBe("Fresha: Prefiere tijera");

      // REQ-100.10 otra vez el mismo archivo: no duplica
      await page.getByRole("button", { name: "Importar otro archivo" }).click();
      await page.getByLabel("Archivo de clientes").setInputFiles({
        name: "clientes.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(clientsCsv),
      });
      await page.getByLabel("Archivo de citas").setInputFiles({
        name: "citas.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(apptsCsv),
      });
      await page.getByRole("button", { name: "Revisar" }).click();
      await page.getByLabel('Barbero "Pepe Fresha"').selectOption({ label: "Pedro" });
      await page.getByRole("button", { name: "Importar", exact: true }).click();
      await expect(
        page.getByRole("listitem").filter({ hasText: "Citas que ya estaban" }),
      ).toContainText("1", {
        timeout: 15_000,
      });
      const { data: all } = await db
        .from("appointments")
        .select("id")
        .eq("business_id", biz!.id)
        .like("external_ref", `E2E-${n}-%`);
      expect(all).toHaveLength(1);
    } finally {
      await db
        .from("appointments")
        .delete()
        .eq("business_id", biz!.id)
        .like("external_ref", `E2E-${n}-%`);
      await db
        .from("customers")
        .delete()
        .eq("business_id", biz!.id)
        .in("phone_e164", [`+57${phoneA}`, `+57${phoneB}`]);
    }
  });

  test("REQ-100.1 el barbero no puede entrar a importar", async ({ page }) => {
    await loginAsBarber(page, 1);
    await page.goto("/app/clientes/importar");
    await expect(page).toHaveURL(/\/app\/clientes$/);
    await expect(page.getByRole("link", { name: "Importar de Fresha" })).toHaveCount(0);
  });
});
