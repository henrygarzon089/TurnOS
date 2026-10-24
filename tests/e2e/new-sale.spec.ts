import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { loginAsBarber, loginAsOwner, SEED } from "./helpers";

/** T-044 · REQ-023.4, REQ-024.1–24.3. Los montos se verifican en la base con service_role. */
function db() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function lastSale() {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data } = await admin
    .from("sales")
    .select(
      "ticket_id, barber_id, services_total, products_total, total, commission_pct, commission_amount, barbers:barber_id(display_name, commission_pct)",
    )
    .eq("business_id", biz!.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data as unknown as {
    ticket_id: string | null;
    barber_id: string | null;
    services_total: number;
    products_total: number;
    total: number;
    commission_pct: number;
    commission_amount: number;
    barbers: { display_name: string; commission_pct: number } | null;
  };
}

async function openNewSale(page: Page) {
  await page.getByRole("button", { name: "+ Nueva venta" }).click();
  const sheet = page.getByRole("dialog", { name: "Nueva venta" });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 0");
  return sheet;
}

test.describe("REQ-023.4 / REQ-024 nueva venta sin turno", () => {
  test("REQ-024.2 el dueño vende 2 helados en efectivo, sin barbero y sin comisión (REQ-024.3)", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    const sheet = await openNewSale(page);
    await sheet.getByRole("button", { name: "Agregar un Helado" }).click();
    await sheet.getByRole("button", { name: "Agregar un Helado" }).click();
    await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 6.000");
    await sheet.getByRole("radio", { name: "Efectivo" }).click();
    await sheet.getByRole("button", { name: "Registrar $ 6.000" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Venta registrada: $ 6.000" }),
    ).toBeVisible();
    const s = await lastSale();
    expect(s).toMatchObject({
      ticket_id: null,
      barber_id: null,
      products_total: 6000,
      total: 6000,
      commission_amount: 0,
    });
  });

  test("REQ-023.4 servicio sin turno con barbero elegido genera comisión", async ({ page }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    const sheet = await openNewSale(page);
    await sheet.getByRole("button", { name: "+ Agregar servicio" }).click();
    await sheet.getByLabel("Servicio", { exact: true }).selectOption({ label: "Corte · $ 25.000" });
    // Sin barbero no se puede registrar un servicio
    await expect(sheet.getByRole("button", { name: "Registrar $ 25.000" })).toBeDisabled();
    await sheet.getByLabel("Barbero").selectOption({ label: "Juan" });
    await sheet.getByRole("radio", { name: "Nequi" }).click();
    await sheet.getByRole("button", { name: "Registrar $ 25.000" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Venta registrada: $ 25.000" }),
    ).toBeVisible();
    const s = await lastSale();
    expect(s.ticket_id).toBeNull();
    expect(s.barbers?.display_name).toBe("Juan");
    expect(s.commission_pct).toBe(s.barbers?.commission_pct);
    expect(s.commission_amount).toBe(Math.floor((25000 * s.commission_pct + 50) / 100));
    expect(s.commission_amount).toBeGreaterThan(0);
  });

  test("REQ-024.2 el barbero vende un producto: queda a su nombre, sin comisión", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    const sheet = await openNewSale(page);
    await expect(sheet.getByLabel("Barbero")).toHaveCount(0);
    await sheet.getByRole("button", { name: "Agregar un Gaseosa" }).click();
    await sheet.getByRole("radio", { name: "Efectivo" }).click();
    await sheet.getByRole("button", { name: "Registrar $ 4.000" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Venta registrada: $ 4.000" }),
    ).toBeVisible();
    const s = await lastSale();
    expect(s.barbers?.display_name).toBe("Juan");
    expect(s).toMatchObject({ products_total: 4000, commission_amount: 0 });
  });
});
