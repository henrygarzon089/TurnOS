import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, SEED } from "./helpers";

/**
 * T-075 · REQ-047.1, REQ-047.5, REQ-048.1, REQ-048.2. Familia con la cuota pagada (vía la sesión
 * del dueño), turno agregado por el dueño y atendido por Juan: el cobro sale en $ 0 con el corte de
 * membresía y "Mi turno" muestra los cortes que quedan.
 */
const uid = () => Date.now().toString().slice(-7);

async function ownerClient() {
  const owner = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await owner.auth.signInWithPassword(SEED.owner);
  return owner;
}

/** Plan encendido (Corte gasta cortes) y una familia con su cuota pagada: 4 cortes. Id de la cuota. */
async function paidFamily(
  owner: Awaited<ReturnType<typeof ownerClient>>,
  biz: string,
  phone: string,
  name: string,
): Promise<string> {
  await adminDb()
    .from("services")
    .update({ counts_for_membership: true })
    .eq("business_id", biz)
    .eq("name", "Corte");
  const plan = await owner.rpc("save_membership_plan", {
    p_business_id: biz,
    p_enabled: true,
    p_price: 80000,
    p_cuts: 4,
    p_discount_pct: 20,
  });
  expect(plan.error).toBeNull();
  const fam = await owner.rpc("create_membership", {
    p_business_id: biz,
    p_holder_phone: `+57${phone}`,
    p_holder_name: name,
  });
  expect(fam.error).toBeNull();
  const fee = await owner.rpc("register_membership_fee", {
    p_membership_id: fam.data,
    p_payments: [{ method: "cash", amount: 80000 }],
  });
  expect(fee.error).toBeNull();
  return (fee.data as { id: string }).id;
}

/** Deja a Juan libre y presente hoy, sin turnos abiertos. */
async function freeJuan(biz: string) {
  const admin = adminDb();
  const { data: juan } = await admin
    .from("barbers")
    .select("id")
    .eq("business_id", biz)
    .eq("display_name", "Juan")
    .single();
  await admin
    .from("tickets")
    .update({ status: "cancelled", cancel_reason: "closing" })
    .eq("assigned_barber_id", juan!.id)
    .in("status", ["called", "in_service"]);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  await admin
    .from("barbers")
    .update({ status: "available", present_day: today })
    .eq("id", juan!.id);
}

test.describe("REQ-047 / REQ-048 membresía en el cobro, la fila y Mi turno", () => {
  test.setTimeout(150_000);

  test("REQ-047.1 el barbero cobra un corte de membresía y REQ-048.1 Mi turno muestra los cortes que quedan", async ({
    browser,
  }) => {
    const admin = adminDb();
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", SEED.slug)
      .single();
    await freeJuan(biz!.id);
    const id = uid();
    const name = `Familia ${id}`;
    const phone = `318${id}`;
    const owner = await ownerClient();
    const saleIds = [await paidFamily(owner, biz!.id, phone, name)];

    const o = await browser.newContext();
    const b = await browser.newContext();
    const c = await browser.newContext();
    try {
      const ownerPage = await o.newPage();
      const barber = await b.newPage();
      await loginAsOwner(ownerPage);
      await loginAsBarber(barber, 0);

      // El dueño agrega el turno del titular: REQ-048.2 etiqueta "Membresía" en su fila
      await ownerPage.goto("/admin/fila");
      await ownerPage.getByRole("button", { name: "Agregar cliente" }).click();
      const add = ownerPage.getByRole("dialog", { name: "Agregar cliente" });
      await add.getByLabel("Nombre").fill(name);
      await add.getByLabel("Celular (opcional)").fill(phone);
      await add.getByLabel("Servicio").selectOption({ label: "Corte · 20 min" });
      await add.getByLabel("Barbero").selectOption({ label: "Juan" });
      await add.getByRole("button", { name: "Agregar" }).click();
      const row = ownerPage
        .getByRole("region", { name: "Turnos activos" })
        .getByRole("listitem")
        .filter({ hasText: name });
      await expect(row).toBeVisible({ timeout: 15_000 });
      await expect(row.getByText("Membresía", { exact: true })).toBeVisible();

      await row.getByRole("button", { name: new RegExp(name) }).click();
      const select = row.getByLabel("Llamar con");
      await select.selectOption(
        (await select.locator("option", { hasText: "Juan" }).getAttribute("value"))!,
      );
      await row.getByRole("button", { name: "Llamar" }).click();

      // REQ-048.2 en la fila del barbero
      await barber.goto("/app/fila");
      const current = barber.getByRole("article", { name: new RegExp(`Turno actual ${name}`) });
      await expect(current).toBeVisible({ timeout: 15_000 });
      await expect(current.getByText("Membresía", { exact: true })).toBeVisible();
      await barber.getByRole("button", { name: "Ya está en la silla" }).click();
      await barber.getByRole("button", { name: "Terminado" }).click();

      // REQ-047.1 "Usar membresía" marcado, el corte queda en $ 0 (REQ-047.3: el barbero puede)
      const sheet = barber.getByRole("dialog", { name: "Registrar cobro" });
      await expect(sheet.getByLabel("Usar membresía")).toBeChecked();
      await expect(sheet.getByTestId("membership-line")).toHaveText(
        "Corte de membresía (quedan 3): −$ 25.000",
      );
      await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 0");
      await sheet.getByRole("button", { name: "Registrar $ 0" }).click();
      await expect(
        barber.getByRole("status").filter({ hasText: "Cobro registrado: $ 0" }),
      ).toBeVisible();

      const { data: ticket } = await admin
        .from("tickets")
        .select("id, public_token")
        .eq("business_id", biz!.id)
        .eq("customer_name", name)
        .single();
      const { data: sale } = await admin
        .from("sales")
        .select("id, total, sale_items(membership_benefit, discount)")
        .eq("ticket_id", ticket!.id)
        .single();
      saleIds.push(sale!.id);
      expect(sale).toMatchObject({
        total: 0,
        sale_items: [{ membership_benefit: "cut", discount: 25000 }],
      });

      // REQ-048.1 "Mi turno" del cliente: quedan 3 de 4, sin datos de otros miembros
      const customer = await c.newPage();
      await customer.goto(`/t/${ticket!.public_token}`);
      await expect(customer.getByTestId("my-membership")).toHaveText(
        /^Membresía familiar: quedan 3 de 4 cortes · vence el \d+ de [a-z]+$/,
      );
    } finally {
      await o.close();
      await b.close();
      await c.close();
      // La caja de las demás pruebas queda como estaba: primero el corte, luego la cuota
      for (const saleId of saleIds.reverse())
        await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E" });
      await admin.from("membership_plans").update({ enabled: false }).eq("business_id", biz!.id);
    }
  });

  test("REQ-047.1 en Nueva venta el celular del cliente trae la membresía y el corte queda en $ 0", async ({
    page,
  }) => {
    const admin = adminDb();
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", SEED.slug)
      .single();
    const id = uid();
    const phone = `319${id}`;
    const name = `Venta ${id}`;
    const owner = await ownerClient();
    const saleIds = [await paidFamily(owner, biz!.id, phone, name)];
    try {
      await loginAsOwner(page);
      await page.goto("/admin/caja");
      await page.getByRole("button", { name: "+ Nueva venta" }).click();
      const sheet = page.getByRole("dialog", { name: "Nueva venta" });
      await sheet.getByLabel("Celular del cliente (opcional)").fill("300 000 0000");
      await sheet.getByRole("button", { name: "Buscar" }).click();
      await expect(sheet.getByText("No hay un cliente con ese celular.")).toBeVisible();

      await sheet.getByLabel("Celular del cliente (opcional)").fill(phone);
      await sheet.getByRole("button", { name: "Buscar" }).click();
      await expect(sheet.getByTestId("checkout-customer")).toHaveText(
        `${name} · Membresía familiar`,
      );
      await sheet.getByRole("button", { name: "+ Agregar servicio" }).click();
      await sheet.getByLabel("Servicio").selectOption({ label: "Corte · $ 25.000" });
      await expect(sheet.getByLabel("Usar membresía")).toBeChecked();
      await expect(sheet.getByTestId("membership-line")).toHaveText(
        "Corte de membresía (quedan 3): −$ 25.000",
      );
      await sheet.getByLabel("Barbero").selectOption({ label: "Juan" });
      await sheet.getByRole("button", { name: "Registrar $ 0" }).click();
      await expect(
        page.getByRole("status").filter({ hasText: "Venta registrada: $ 0" }),
      ).toBeVisible();

      const { data: cust } = await admin
        .from("customers")
        .select("id")
        .eq("business_id", biz!.id)
        .eq("phone_e164", `+57${phone}`)
        .single();
      const { data: sale } = await admin
        .from("sales")
        .select("id, total, sale_items(membership_benefit)")
        .eq("customer_id", cust!.id)
        .eq("total", 0)
        .single();
      saleIds.push(sale!.id);
      expect(sale!.sale_items).toEqual([{ membership_benefit: "cut" }]);
    } finally {
      for (const saleId of saleIds.reverse())
        await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E" });
      await admin.from("membership_plans").update({ enabled: false }).eq("business_id", biz!.id);
    }
  });
});
