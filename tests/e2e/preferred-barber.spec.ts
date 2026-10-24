import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { SEED } from "./helpers";

/**
 * REQ-022.1. Mateo Londoño (+573002000005) tiene a Juan como preferido en el seed. El estado de
 * Juan se prepara con service_role (como el seed) para no depender del reloj ni de otras pruebas.
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

async function setup(status: "available" | "paused") {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: juan } = await admin
    .from("barbers")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("display_name", "Juan")
    .single();
  await admin
    .from("customers")
    .update({ preferred_barber_id: juan!.id })
    .eq("business_id", biz!.id)
    .eq("phone_e164", "+573002000005");
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  await admin.from("barbers").update({ status, present_day: today }).eq("id", juan!.id);
}

async function asReturningCustomer(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "turnos:cliente",
      JSON.stringify({ name: "Mateo Londoño", phone: "+573002000005" }),
    );
  });
  await page.goto(`/${SEED.slug}/turno`);
  await expect(page.getByLabel("Tu celular (WhatsApp)")).toHaveValue(/300 200 0005/);
}

test.describe("REQ-022.1 barbero preferido preseleccionado", () => {
  test.afterAll(async () => {
    await setup("available");
  });

  test("REQ-022.1 el cliente que vuelve ve a su barbero preseleccionado", async ({ page }) => {
    await setup("available");
    await asReturningCustomer(page);
    await expect(page.getByRole("radio", { name: /^Juan/ })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: "El que esté libre" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("REQ-022.1 si su barbero está en pausa, queda 'El que esté libre'", async ({ page }) => {
    await setup("paused");
    await asReturningCustomer(page);
    // Esperar a que la consulta del preferido termine sin cambiar la selección
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("radio", { name: "El que esté libre" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await expect(page.getByRole("radio", { name: /^Juan/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  test("REQ-022.1 un cliente nuevo no tiene preseleccionado a nadie", async ({ page }) => {
    await setup("available");
    await page.goto(`/${SEED.slug}/turno`);
    await expect(page.getByRole("radio", { name: "El que esté libre" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });
});
