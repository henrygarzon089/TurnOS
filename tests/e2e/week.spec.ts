import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { variation } from "../../src/lib/domain/week";
import { loginAsOwner, SEED } from "./helpers";

/** T-048 · REQ-028.1–28.4: selector de semana y comparación con la anterior. */
function db() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && existsSync(".env.local"))
    process.loadEnvFile(".env.local");
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

async function week(start: string | null) {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data } = await admin.rpc("weekly_summary", {
    p_business_id: biz!.id,
    p_week_start: start,
  });
  return data as { weekStart: string; services: number; newCustomers: number; lostTickets: number };
}

test("REQ-028.1 selector de semana y REQ-028.3 comparación con la semana anterior", async ({
  page,
}) => {
  await loginAsOwner(page);
  await page.getByRole("link", { name: "Semana" }).click();
  await expect(page.getByRole("heading", { name: "Semana" })).toBeVisible();
  const cur = await week(null);
  const prevStart = new Date(`${cur.weekStart}T00:00:00Z`);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const prev = await week(prevStart.toISOString().slice(0, 10));

  await expect(page.getByTestId("occupancy")).toContainText("Ocupación de sillas");
  await expect(page.getByTestId("occupancy")).toContainText("%");
  await expect(page.getByTestId("services")).toContainText(String(cur.services));
  await expect(page.getByTestId("services")).toContainText(
    `vs. semana anterior: ${variation(cur.services, prev.services)}`,
  );
  await expect(page.getByTestId("new")).toContainText(
    `vs. semana anterior: ${variation(cur.newCustomers, prev.newCustomers)}`,
  );
  await expect(page.getByTestId("lost")).toContainText(`${cur.lostTickets} turno`);
  // Semana actual: no se puede ir al futuro
  await expect(page.getByRole("link", { name: "Siguiente →" })).toHaveCount(0);

  const label0 = await page.getByTestId("week-label").textContent();
  await page.getByRole("link", { name: "← Anterior" }).click();
  await expect(page).toHaveURL(new RegExp(`semana=${prev.weekStart}`));
  await expect(page.getByTestId("week-label")).not.toHaveText(label0!);
  await expect(page.getByTestId("services")).toContainText(String(prev.services));
  await page.getByRole("link", { name: "Siguiente →" }).click();
  await expect(page.getByTestId("week-label")).toHaveText(label0!);
});
