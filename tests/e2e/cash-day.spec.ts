import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { loginAsOwner, SEED } from "./helpers";

/** T-045 · REQ-027.1 caja de hoy en vivo · REQ-026.1 anular con motivo. */
function db() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const pesos = async (page: Page, testId: string) =>
  Number(((await page.getByTestId(testId).textContent()) ?? "0").replace(/[^\d]/g, ""));
const cop = (n: number) => `$ ${n.toLocaleString("es-CO").replace(/,/g, ".")}`;

/** Venta de un corte de Juan por Nequi registrada "desde otro celular" (service_role). */
async function saleFromOutside(): Promise<string> {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const one = async (table: string, name: string, col = "name") =>
    (await admin.from(table).select("id").eq("business_id", biz!.id).eq(col, name).single()).data!
      .id as string;
  const { data, error } = await admin.rpc("register_sale", {
    p_business_id: biz!.id,
    p_ticket_id: null,
    p_barber_id: await one("barbers", "Juan", "display_name"),
    p_items: [{ kind: "service", ref_id: await one("services", "Corte"), qty: 1 }],
    p_payments: [{ method: "nequi", amount: 25000 }],
  });
  if (error) throw new Error(error.message);
  return (data as { id: string }).id;
}

test.describe("REQ-027.1 / REQ-026.1 caja de hoy", () => {
  test("REQ-027.1 totales por medio y por barbero en vivo; REQ-026.1 anular excluye y queda tachada", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    await expect(page.getByRole("heading", { name: "Caja de hoy" })).toBeVisible();
    const nequi0 = await pesos(page, "method-nequi");
    const total0 = await pesos(page, "cash-total");

    const saleId = await saleFromOutside();
    // En vivo: sin recargar, la caja refleja la venta (ADR-008)
    await expect(page.getByTestId("method-nequi")).toHaveText(cop(nequi0 + 25000), {
      timeout: 15_000,
    });
    await expect(page.getByTestId("cash-total")).toHaveText(cop(total0 + 25000));
    await expect(page.getByRole("region", { name: "Por barbero" })).toContainText("Juan");
    const row = page.getByTestId(`sale-${saleId}`);
    await expect(row).toContainText("Corte");
    await expect(row).toContainText("Nequi");

    await row.getByRole("button", { name: "Anular" }).click();
    const dialog = page.getByRole("dialog", { name: "Anular venta" });
    await dialog.getByRole("button", { name: "Anular venta" }).click();
    await expect(dialog.getByText("Escribe el motivo de la anulación.")).toBeVisible();
    await dialog.getByLabel("Motivo").fill("Prueba E2E");
    await dialog.getByRole("button", { name: "Anular venta" }).click();
    await expect(dialog).toBeHidden();
    await expect(row).toContainText("Anulada: Prueba E2E");
    await expect(row.locator(".line-through").first()).toBeVisible();
    await expect(page.getByTestId("method-nequi")).toHaveText(cop(nequi0));
    await expect(page.getByTestId("cash-total")).toHaveText(cop(total0));
  });
});
