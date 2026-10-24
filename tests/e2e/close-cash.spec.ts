import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loginAsOwner, SEED } from "./helpers";

/**
 * T-046 · REQ-027.2–27.4, REQ-027.6. Cerrar la caja de HOY bloquea ventas de otras pruebas: al
 * final (pase o falle) se reabre con service_role.
 */
function db() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function biz() {
  const admin = db();
  const { data } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  return { admin, id: data!.id as string };
}

async function reopenIfClosed() {
  const { admin, id } = await biz();
  await admin.rpc("reopen_cash_day", { p_business_id: id, p_day: null, p_reason: "Limpieza E2E" });
}

async function cashSale() {
  const { admin, id } = await biz();
  const one = async (table: string, name: string, col = "name") =>
    (await admin.from(table).select("id").eq("business_id", id).eq(col, name).single()).data!
      .id as string;
  return admin.rpc("register_sale", {
    p_business_id: id,
    p_ticket_id: null,
    p_barber_id: await one("barbers", "Juan", "display_name"),
    p_items: [{ kind: "service", ref_id: await one("services", "Corte"), qty: 1 }],
    p_payments: [{ method: "cash", amount: 25000 }],
  });
}

const pesos = (t: string | null) => Number((t ?? "0").replace(/[^\d]/g, ""));
const cop = (n: number) =>
  `${n < 0 ? "-" : ""}$ ${Math.abs(n).toLocaleString("es-CO").replace(/,/g, ".")}`;

test.describe("REQ-027 cierre de caja", () => {
  test.beforeAll(reopenIfClosed);
  test.afterAll(reopenIfClosed);

  test("REQ-027.2 cierra con efectivo contado; REQ-027.3 bloquea ventas y se reabre con motivo; REQ-027.6 compartir", async ({
    page,
  }) => {
    test.setTimeout(90_000);
    try {
      expect((await cashSale()).error).toBeNull();
      await loginAsOwner(page);
      await page.goto("/admin/caja");
      const expected = pesos(await page.getByTestId("method-cash").textContent());
      expect(expected).toBeGreaterThan(0);

      await page.getByRole("button", { name: "Cerrar caja" }).click();
      const dialog = page.getByRole("dialog", { name: "Cerrar caja" });
      await expect(dialog).toContainText(`Esperado ${cop(expected)}`);
      await dialog.getByLabel("Efectivo contado").fill(String(expected - 2000));
      await expect(dialog.getByTestId("close-difference")).toHaveText(cop(-2000));
      await dialog.getByRole("button", { name: "Confirmar cierre" }).click();

      const closed = page.getByRole("region", { name: "Cierre de caja" });
      await expect(closed).toContainText("Caja cerrada a las");
      await expect(closed.getByTestId("closure-difference")).toHaveText(cop(-2000));
      // REQ-027.3 modo lectura: sin "Nueva venta" ni "Anular"; la base rechaza ventas del día
      await expect(page.getByRole("button", { name: "+ Nueva venta" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Anular" })).toHaveCount(0);
      const blocked = await cashSale();
      expect(blocked.error?.message).toContain("CASH_DAY_CLOSED");

      // REQ-027.4 / REQ-027.6 compartir por WhatsApp con la liquidación
      const href = await closed
        .getByRole("link", { name: /Compartir por WhatsApp/ })
        .getAttribute("href");
      const text = decodeURIComponent(href!.replace("https://wa.me/?text=", ""));
      expect(text).toContain("Cierre de caja · Barbería La 33");
      expect(text).toContain(`diferencia ${cop(-2000)}`);
      expect(text).toMatch(/Juan: \d+ servicios?, \$ [\d.]+ vendidos, comisión \d+ % = \$ [\d.]+/);

      // REQ-027.3 reabrir con motivo
      await closed.getByRole("button", { name: "Reabrir" }).click();
      await closed.getByRole("button", { name: "Reabrir caja" }).click();
      await expect(closed.getByText("Escribe el motivo.")).toBeVisible();
      await closed.getByLabel("¿Por qué reabres la caja?").fill("Faltó una venta");
      await closed.getByRole("button", { name: "Reabrir caja" }).click();
      await expect(page.getByRole("button", { name: "Cerrar caja" })).toBeVisible();
      await expect(page.getByRole("button", { name: "+ Nueva venta" })).toBeVisible();
      expect((await cashSale()).error).toBeNull();
    } finally {
      await reopenIfClosed();
    }
  });
});
