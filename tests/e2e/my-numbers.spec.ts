import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { loginAsBarber, SEED } from "./helpers";

/** T-047 · REQ-025.5 / REQ-029.1: el barbero ve hoy, semana y el detalle de SUS ventas. */
function db() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function sale(barber: "Juan" | "Pedro") {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const id = async (table: string, name: string, col = "name") =>
    (await admin.from(table).select("id").eq("business_id", biz!.id).eq(col, name).single()).data!
      .id as string;
  const { data, error } = await admin.rpc("register_sale", {
    p_business_id: biz!.id,
    p_ticket_id: null,
    p_barber_id: await id("barbers", barber, "display_name"),
    p_items: [{ kind: "service", ref_id: await id("services", "Corte"), qty: 1 }],
    p_payments: [{ method: "cash", amount: 25000 }],
  });
  if (error) throw new Error(error.message);
  return data as { id: string; commission_amount: number };
}

const pesos = (t: string | null) =>
  Number((t ?? "").match(/\$ ([\d.]+)/)?.[1].replace(/\./g, "") ?? 0);

test("REQ-025.5 el barbero ve hoy, semana y el detalle de sus ventas; REQ-029.1 nunca las de otros", async ({
  page,
}) => {
  await loginAsBarber(page, 0); // Juan
  await page.getByRole("link", { name: "Mis números" }).click();
  await expect(page.getByRole("heading", { name: "Mis números" })).toBeVisible();
  const today0 = pesos(await page.getByTestId("today").textContent());
  const week0 = pesos(await page.getByTestId("week").textContent());

  const mine = await sale("Juan");
  const other = await sale("Pedro");
  await page.reload();

  await expect(page.getByTestId("today")).toContainText(
    `$ ${(today0 + mine.commission_amount).toLocaleString("es-CO").replace(/,/g, ".")}`,
  );
  expect(pesos(await page.getByTestId("week").textContent())).toBe(week0 + mine.commission_amount);
  await expect(page.getByTestId(`my-sale-${mine.id}`)).toContainText("Corte");
  await expect(page.getByTestId(`my-sale-${other.id}`)).toHaveCount(0);
  // Nunca totales del negocio
  await expect(page.getByText("Total vendido")).toHaveCount(0);
});
