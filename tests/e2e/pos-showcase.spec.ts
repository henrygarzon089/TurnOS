import { expect, test, type Page } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, SEED, tapNewSale, addProduct } from "./helpers";

/**
 * T-116 · T-117 · REQ-066, REQ-067, REQ-068: la vitrina en "Nueva venta" y en el cobro del turno,
 * la comisión de productos y la compra de un barbero. La Gaseosa ($ 4.000) da comisión (10 %) y
 * va en "Bebidas"; el Helado va en "Helados". Los montos se verifican en la base con service_role.
 */
const uid = () => Date.now().toString().slice(-7);

async function bizId() {
  const { data } = await adminDb().from("businesses").select("id").eq("slug", SEED.slug).single();
  return data!.id as string;
}

async function setProduct(name: string, commissionable: boolean, category: string | null) {
  await adminDb()
    .from("products")
    .update({ commissionable, category })
    .eq("business_id", await bizId())
    .eq("name", name);
}

async function prepare() {
  await setProduct("Gaseosa", true, "Bebidas");
  await setProduct("Helado", false, "Helados");
  await adminDb()
    .from("businesses")
    .update({ product_commission_pct: 10, staff_discount_pct: 20 })
    .eq("id", await bizId());
}

async function restore() {
  await setProduct("Gaseosa", false, null);
  await setProduct("Helado", false, null);
  await adminDb()
    .from("businesses")
    .update({ product_commission_pct: 10, staff_discount_pct: 20 })
    .eq("id", await bizId());
}

async function lastSale() {
  const { data } = await adminDb()
    .from("sales")
    .select(
      "ticket_id, products_total, total, product_commission_pct, product_commission_base, product_commission_amount, staff_discount_total, barbers:barber_id(display_name), staff_buyer_id",
    )
    .eq("business_id", await bizId())
    .order("created_at", { ascending: false })
    .limit(1)
    .single();
  return data as unknown as {
    ticket_id: string | null;
    products_total: number;
    total: number;
    product_commission_pct: number;
    product_commission_base: number;
    product_commission_amount: number;
    staff_discount_total: number;
    barbers: { display_name: string } | null;
    staff_buyer_id: string | null;
  };
}

async function openNewSale(page: Page) {
  await tapNewSale(page);
  const sheet = page.getByRole("dialog", { name: "Nueva venta" });
  await expect(sheet).toBeVisible();
  return sheet;
}

/** Deja a Juan libre y presente hoy, sin turnos abiertos. */
async function freeJuan() {
  const admin = adminDb();
  const { data: juan } = await admin
    .from("barbers")
    .select("id")
    .eq("business_id", await bizId())
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

test.describe("Hito 12 · vitrina y comisión de productos", () => {
  test.beforeEach(prepare);
  test.afterEach(restore);

  test("REQ-066.1 REQ-066.2 la vitrina muestra pestañas por categoría y no los productos de cortesía", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    const sheet = await openNewSale(page);
    // T-170: la vitrina se abre con "+ Agregar producto"
    await sheet.getByRole("button", { name: "+ Agregar producto" }).click();
    const picker = page.getByRole("dialog", { name: "Agregar producto" });
    const tabs = picker.getByRole("tablist", { name: "Categorías" }).getByRole("tab");
    await expect(tabs).toHaveText(["Todos", "Bebidas", "Helados"]);
    await expect(picker.getByRole("button", { name: "Agregar un Agua" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "Agregar un Tinto" })).toHaveCount(0);
    await picker.getByRole("tab", { name: "Helados" }).click();
    await expect(picker.getByRole("button", { name: "Agregar un Helado" })).toBeVisible();
    await expect(picker.getByRole("button", { name: "Agregar un Gaseosa" })).toHaveCount(0);
  });

  test("REQ-066.3 REQ-067.1 el dueño vende 2 Gaseosas escogiendo a Juan: comisión de productos $ 800", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    const sheet = await openNewSale(page);
    await addProduct(sheet, "Gaseosa", 2);
    await sheet.getByRole("radio", { name: "Efectivo" }).click();
    // Sin escoger quién vendió no se puede confirmar
    await expect(sheet.getByRole("button", { name: "Cobrar $ 8.000" })).toBeDisabled();
    await sheet
      .getByRole("radiogroup", { name: "¿Quién vendió?" })
      .getByRole("radio", { name: "Juan" })
      .click();
    await expect(sheet.getByTestId("product-commission")).toHaveText(
      "Comisión de productos para Juan: $ 800",
    );
    await sheet.getByRole("button", { name: "Cobrar $ 8.000" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Venta registrada · $ 8.000" }),
    ).toBeVisible();
    const s = await lastSale();
    expect(s.barbers?.display_name).toBe("Juan");
    expect(s).toMatchObject({
      total: 8000,
      product_commission_pct: 10,
      product_commission_base: 8000,
      product_commission_amount: 800,
    });
  });

  test("REQ-066.4 el barbero vende una Gaseosa a su nombre, sin pregunta, con comisión de productos", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    const sheet = await openNewSale(page);
    await expect(sheet.getByRole("radiogroup", { name: "¿Quién vendió?" })).toHaveCount(0);
    await expect(sheet.getByText("Venta a tu nombre")).toBeVisible();
    await expect(sheet.getByText("Compra de un barbero", { exact: false })).toHaveCount(0);
    await addProduct(sheet, "Gaseosa");
    await sheet.getByRole("radio", { name: "Efectivo" }).click();
    await sheet.getByRole("button", { name: "Cobrar $ 4.000" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Venta registrada · $ 4.000" }),
    ).toBeVisible();
    const s = await lastSale();
    expect(s.barbers?.display_name).toBe("Juan");
    expect(s.product_commission_amount).toBe(400);
  });

  test("REQ-068.2 REQ-068.3 el dueño registra una compra de Pedro con el 20 % de descuento y sin comisión", async ({
    page,
  }) => {
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    const sheet = await openNewSale(page);
    await sheet.getByRole("checkbox", { name: "Compra de un barbero (−20 %)" }).check();
    await expect(sheet.getByRole("radio", { name: "Nadie (el negocio)" })).toHaveCount(0);
    await sheet
      .getByRole("radiogroup", { name: "¿Qué barbero compra?" })
      .getByRole("radio", { name: "Pedro" })
      .click();
    await addProduct(sheet, "Gaseosa");
    await expect(sheet.getByTestId("staff-discount")).toHaveText("Descuento de empleado: −$ 800");
    await expect(sheet.getByTestId("product-commission")).toHaveCount(0);
    await sheet.getByRole("radio", { name: "Efectivo" }).click();
    await sheet.getByRole("button", { name: "Cobrar $ 3.200" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Venta registrada · $ 3.200" }),
    ).toBeVisible();
    const s = await lastSale();
    const { data: pedro } = await adminDb()
      .from("barbers")
      .select("id")
      .eq("business_id", await bizId())
      .eq("display_name", "Pedro")
      .single();
    expect(s.staff_buyer_id).toBe(pedro!.id);
    expect(s.barbers).toBeNull();
    expect(s).toMatchObject({
      total: 3200,
      staff_discount_total: 800,
      product_commission_amount: 0,
    });
  });

  test("REQ-068.2 con descuento de empleado en 0 % el interruptor no sale", async ({ page }) => {
    await adminDb()
      .from("businesses")
      .update({ staff_discount_pct: 0 })
      .eq("id", await bizId());
    await loginAsOwner(page);
    await page.goto("/admin/caja");
    const sheet = await openNewSale(page);
    await expect(sheet.getByRole("radiogroup", { name: "¿Quién vendió?" })).toBeVisible();
    await expect(sheet.getByRole("checkbox", { name: /Compra de un barbero/ })).toHaveCount(0);
  });

  test("REQ-066.5 el barbero agrega una Gaseosa al cobro de su corte: queda en la misma venta a su nombre", async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    await freeJuan();
    const o = await browser.newContext();
    const b = await browser.newContext();
    try {
      const owner = await o.newPage();
      const barber = await b.newPage();
      await loginAsOwner(owner);
      await loginAsBarber(barber, 0);
      const name = `Vitrina ${uid()}`;

      await owner.goto("/admin/fila");
      await owner.getByRole("button", { name: "Agregar cliente" }).click();
      const add = owner.getByRole("dialog", { name: "Agregar cliente" });
      await add.getByLabel("Nombre").fill(name);
      await add.getByLabel("Celular (opcional)").fill(`319${uid()}`);
      await add.getByLabel("Servicio").selectOption({ label: "Corte · 20 min" });
      await add.getByLabel("Barbero").selectOption({ label: "Juan" });
      await add.getByRole("button", { name: "Agregar" }).click();
      const row = owner
        .getByRole("region", { name: "Turnos activos" })
        .getByRole("listitem")
        .filter({ hasText: name });
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
      ).toBeVisible({ timeout: 15_000 });
      await barber.getByRole("button", { name: "Empezar corte" }).click();
      await barber.getByRole("button", { name: "Terminar y cobrar" }).click();
      const sheet = barber.getByRole("dialog", { name: /^Cobrar a / });
      await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 25.000");
      await addProduct(sheet, "Gaseosa");
      await expect(sheet.getByTestId("product-commission")).toHaveText(
        "Comisión de productos para Juan: $ 400",
      );
      await sheet.getByRole("radio", { name: "Efectivo" }).click();
      await sheet.getByRole("button", { name: "Cobrar $ 29.000" }).click();
      await expect(
        barber.getByRole("status").filter({ hasText: "Cobrado · $ 29.000" }),
      ).toBeVisible();
      const s = await lastSale();
      expect(s.ticket_id).not.toBeNull();
      expect(s.barbers?.display_name).toBe("Juan");
      expect(s).toMatchObject({ products_total: 4000, product_commission_amount: 400 });
    } finally {
      await o.close();
      await b.close();
    }
  });
});
