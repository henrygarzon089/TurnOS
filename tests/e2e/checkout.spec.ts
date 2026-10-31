import { existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { expect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { loginAsBarber, loginAsOwner, SEED } from "./helpers";

/**
 * T-043 · REQ-023.1–23.3, REQ-023.6, REQ-019.4. Turnos agregados por el dueño (sin depender del
 * horario) y llamados con "Llamar con Juan"; Juan se deja libre con service_role.
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

async function freeJuan() {
  const admin = db();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const { data: juan } = await admin
    .from("barbers")
    .select("id")
    .eq("business_id", biz!.id)
    .eq("display_name", "Juan")
    .single();
  const { data: open } = await admin
    .from("tickets")
    .select("id, status")
    .eq("assigned_barber_id", juan!.id)
    .in("status", ["called", "in_service"]);
  for (const t of open ?? []) {
    if (t.status === "called")
      await admin.rpc("transition_ticket", {
        p_ticket_id: t.id,
        p_to: "cancelled",
        p_actor: "system",
        p_reason: "closing",
      });
    else
      await admin
        .from("tickets")
        .update({ status: "cancelled", cancel_reason: "closing" })
        .eq("id", t.id);
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  await admin
    .from("barbers")
    .update({ status: "available", present_day: today })
    .eq("id", juan!.id);
  return { admin, biz: biz!.id };
}

const activeRow = (owner: Page, name: string) =>
  owner
    .getByRole("region", { name: "Turnos activos" })
    .getByRole("listitem")
    .filter({ hasText: name });

const pendingRow = (page: Page, name: string) =>
  page
    .getByRole("region", { name: "Cobros pendientes" })
    .getByRole("listitem")
    .filter({ hasText: name });

/** El nombre del cliente se lee junto a "Cobrar": el botón no se come la fila (NFR-008: >= 48 px). */
async function expectLegiblePendingRow(row: Locator, name: string) {
  const label = row.getByText(name);
  const button = row.getByRole("button", { name: "Cobrar" });
  await expect(label).toBeVisible();
  const labelBox = (await label.boundingBox())!;
  const buttonBox = (await button.boundingBox())!;
  const rowBox = (await row.boundingBox())!;
  expect(labelBox.width).toBeGreaterThan(100);
  expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
  expect(buttonBox.height).toBeGreaterThanOrEqual(48);
}

/** El dueño agrega el turno para Juan y lo llama; Juan lo pone en la silla y toca "Terminado". */
async function serveUntilFinished(owner: Page, barber: Page, name: string, phone: string) {
  await owner.goto("/admin/fila");
  await owner.getByRole("button", { name: "Agregar cliente" }).click();
  const add = owner.getByRole("dialog", { name: "Agregar cliente" });
  await add.getByLabel("Nombre").fill(name);
  await add.getByLabel("Celular (opcional)").fill(phone);
  await add.getByLabel("Servicio").selectOption({ label: "Corte · 20 min" });
  await add.getByLabel("Barbero").selectOption({ label: "Juan" });
  await add.getByRole("button", { name: "Agregar" }).click();
  const row = activeRow(owner, name);
  await expect(row).toBeVisible({ timeout: 15_000 });
  await row.getByRole("button", { name: new RegExp(name) }).click();
  const select = row.getByLabel("Llamar con");
  await select.selectOption(
    (await select.locator("option", { hasText: "Juan" }).getAttribute("value"))!,
  );
  await row.getByRole("button", { name: "Llamar" }).click();

  await barber.goto("/app/fila");
  await expect(
    barber.getByRole("article", { name: new RegExp(`Turno actual ${name}`) }),
  ).toBeVisible({
    timeout: 15_000,
  });
  await barber.getByRole("button", { name: "Ya está en la silla" }).click();
  await barber.getByRole("button", { name: "Terminado" }).click();
  return barber.getByRole("dialog", { name: "Registrar cobro" });
}

async function contexts(browser: Browser) {
  const o = await browser.newContext();
  const b = await browser.newContext();
  const owner = await o.newPage();
  const barber = await b.newPage();
  await loginAsOwner(owner);
  await loginAsBarber(barber, 0);
  return { owner, barber, close: async () => (await o.close(), await b.close()) };
}

const uid = () => Date.now().toString().slice(-7);

test.describe("REQ-023 panel de cobro", () => {
  test.setTimeout(120_000);
  test.beforeEach(async () => {
    await freeJuan();
  });

  test("REQ-023.1 terminar abre el cobro prellenado; con Nequi queda registrado (REQ-023.3)", async ({
    browser,
  }) => {
    const { owner, barber, close } = await contexts(browser);
    try {
      const name = `Cobro ${uid()}`;
      const sheet = await serveUntilFinished(owner, barber, name, `315${uid()}`);
      await expect(sheet).toBeVisible();
      await expect(sheet.getByLabel("Servicio", { exact: true })).toContainText("Corte · $ 25.000");
      await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 25.000");
      // REQ-023.2 agregar un producto al mismo cobro
      await sheet.getByRole("button", { name: "Agregar un Gaseosa" }).click();
      await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 29.000");
      await sheet.getByRole("button", { name: "Quitar un Gaseosa" }).click();
      await sheet.getByRole("radio", { name: "Nequi" }).click();
      await sheet.getByRole("button", { name: "Registrar $ 25.000" }).click();
      await expect(
        barber.getByRole("status").filter({ hasText: "Cobro registrado: $ 25.000" }),
      ).toBeVisible();
      await expect(sheet).toBeHidden();
      await expect(
        barber.getByRole("region", { name: "Cobros pendientes" }).getByText(name),
      ).toHaveCount(0);
    } finally {
      await close();
    }
  });

  test("REQ-023.6 cerrar sin cobrar deja 'Cobro pendiente' para el barbero y el dueño", async ({
    browser,
  }) => {
    const { owner, barber, close } = await contexts(browser);
    try {
      const name = `Pendiente ${uid()}`;
      const sheet = await serveUntilFinished(owner, barber, name, `316${uid()}`);
      await sheet.getByRole("button", { name: "Cobrar después" }).click();
      await expect(sheet).toBeHidden();
      await expect(barber.getByRole("region", { name: "Cobros pendientes" })).toContainText(name);
      await expectLegiblePendingRow(pendingRow(barber, name), name);

      await owner.goto("/admin/fila");
      const ownerRow = pendingRow(owner, name);
      await expect(ownerRow).toBeVisible({ timeout: 15_000 });
      await expectLegiblePendingRow(ownerRow, name);
      // REQ-023.7 el dueño cobra cualquier turno pendiente
      await ownerRow.getByRole("button", { name: "Cobrar" }).click();
      const ownerSheet = owner.getByRole("dialog", { name: "Registrar cobro" });
      await ownerSheet.getByRole("radio", { name: "Efectivo" }).click();
      await ownerSheet.getByRole("button", { name: "Registrar $ 25.000" }).click();
      await expect(ownerSheet).toBeHidden();
      await expect(ownerRow).toBeHidden({ timeout: 15_000 });
    } finally {
      await close();
    }
  });

  test("REQ-019.4 aplicar el premio deja el total en $ 0", async ({ browser }) => {
    const { admin, biz } = await freeJuan();
    const { owner, barber, close } = await contexts(browser);
    try {
      const id = uid();
      const name = `Premio ${id}`;
      const phone = `317${id}`;
      // Ficha con premio disponible (10 sellos) antes de terminar el turno
      await owner.goto("/admin/fila");
      const sheetPromise = serveUntilFinished(owner, barber, name, phone);
      // La ficha se crea al agregar el turno: se completa la tarjeta mientras el barbero atiende
      await expect
        .poll(
          async () => {
            const { data } = await admin
              .from("customers")
              .select("id")
              .eq("business_id", biz)
              .eq("phone_e164", `+57${phone}`)
              .maybeSingle();
            if (!data) return false;
            await admin.from("loyalty_cards").delete().eq("customer_id", data.id);
            await admin.from("loyalty_cards").insert({
              business_id: biz,
              customer_id: data.id,
              stamps: 10,
              status: "completed",
              completed_at: new Date().toISOString(),
            });
            return true;
          },
          { timeout: 20_000 },
        )
        .toBe(true);
      const sheet = await sheetPromise;
      await sheet.getByRole("button", { name: "🎁 Aplicar premio" }).click();
      await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 0");
      await expect(sheet.getByRole("radiogroup", { name: "Medio de pago" })).toHaveCount(0);
      await sheet.getByRole("button", { name: "Registrar $ 0" }).click();
      await expect(
        barber.getByRole("status").filter({ hasText: "Cobro registrado: $ 0" }),
      ).toBeVisible();
    } finally {
      await close();
    }
  });
});
