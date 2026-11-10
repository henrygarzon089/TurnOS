import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { formatCOP } from "../../src/lib/domain/money";
import { variation } from "../../src/lib/domain/week";
import { loginAsOwner, SEED, openOwnerModule } from "./helpers";

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
  await openOwnerModule(page, "Semana");
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
  await expect(page.getByRole("link", { name: "Semana siguiente" })).toHaveCount(0);

  const label0 = await page.getByTestId("week-label").textContent();
  await page.getByRole("link", { name: "Semana anterior" }).click();
  await expect(page).toHaveURL(new RegExp(`semana=${prev.weekStart}`));
  await expect(page.getByTestId("week-label")).not.toHaveText(label0!);
  await expect(page.getByTestId("services")).toContainText(String(prev.services));
  await page.getByRole("link", { name: "Semana siguiente" }).click();
  await expect(page.getByTestId("week-label")).toHaveText(label0!);
});

/** T-180 · REQ-078.32: Semana como el tablero Dueno-Operacion, con las cifras de weekly_summary. */
test("REQ-078.32 Ingresos, Servicios, Comisiones y Queda al negocio, y la tabla por barbero", async ({
  page,
}) => {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  // La semana anterior no cambia mientras corren las otras pruebas
  const cur = await week(null);
  const prevStart = new Date(`${cur.weekStart}T00:00:00Z`);
  prevStart.setUTCDate(prevStart.getUTCDate() - 7);
  const { data } = await admin.rpc("weekly_summary", {
    p_business_id: biz!.id,
    p_week_start: prevStart.toISOString().slice(0, 10),
  });
  const w = data as {
    weekStart: string;
    sold: number;
    services: number;
    productCommission: number;
    barbers: { barberId: string; name: string; commission: number; toPay: number }[];
  };
  const commissions = w.barbers.reduce((s, b) => s + b.commission, 0) + w.productCommission;

  await page.setViewportSize({ width: 1280, height: 900 });
  await loginAsOwner(page);
  await page.goto(`/admin/semana?semana=${w.weekStart}`);
  await expect(page.getByTestId("sold")).toContainText("Ingresos");
  await expect(page.getByTestId("sold")).toContainText(formatCOP(w.sold));
  await expect(page.getByTestId("services")).toContainText(String(w.services));
  await expect(page.getByTestId("commissions")).toContainText(formatCOP(commissions));
  await expect(page.getByTestId("business")).toContainText(formatCOP(w.sold - commissions));

  const table = page.getByRole("table", { name: "Por barbero" });
  for (const h of [
    "Barbero",
    "%",
    "Servicios",
    "Comisión serv.",
    "Productos",
    "Compras suyas",
    "A pagar",
  ])
    await expect(table.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
  for (const b of w.barbers)
    await expect(page.getByTestId(`week-row-${b.barberId}`).getByRole("cell").last()).toHaveText(
      formatCOP(b.toPay),
    );
  // La ocupación se conserva debajo (REQ-028.2)
  await expect(page.getByTestId("occupancy")).toContainText("Ocupación de sillas");

  // Celular: "A PAGAR" por barbero
  await page.setViewportSize({ width: 390, height: 844 });
  if (w.barbers[0])
    await expect(page.getByTestId(`week-pay-${w.barbers[0].barberId}`)).toContainText(
      formatCOP(w.barbers[0].toPay),
    );
});
