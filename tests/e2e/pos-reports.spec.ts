import { expect, test } from "@playwright/test";
import { adminDb, loginAsBarber, loginAsOwner, SEED } from "./helpers";

/**
 * T-118 · REQ-069.2 / REQ-069.3 / REQ-069.5: la comisión de productos en la Caja de hoy y en
 * "Mis números". Las ventas se registran con service_role (como `my-numbers.spec.ts`): una Gaseosa
 * con comisión vendida por Juan y una compra de Pedro.
 */
async function ids() {
  const admin = adminDb();
  const { data: biz } = await admin.from("businesses").select("id").eq("slug", SEED.slug).single();
  const one = async (table: string, col: string, name: string) =>
    (await admin.from(table).select("id").eq("business_id", biz!.id).eq(col, name).single()).data!
      .id as string;
  return {
    biz: biz!.id as string,
    gaseosa: await one("products", "name", "Gaseosa"),
    juan: await one("barbers", "display_name", "Juan"),
    pedro: await one("barbers", "display_name", "Pedro"),
  };
}

async function setCommissionable(on: boolean) {
  const { biz } = await ids();
  await adminDb()
    .from("products")
    .update({ commissionable: on })
    .eq("business_id", biz)
    .eq("name", "Gaseosa");
}

async function sell(a: { barber: string | null; buyer: string | null; total: number }) {
  const { biz, gaseosa } = await ids();
  const { data, error } = await adminDb().rpc("register_sale", {
    p_business_id: biz,
    p_ticket_id: null,
    p_barber_id: a.barber,
    p_items: [{ kind: "product", ref_id: gaseosa, qty: 1 }],
    p_payments: [{ method: "cash", amount: a.total }],
    p_customer_id: null,
    p_staff_buyer_id: a.buyer,
  });
  if (error) throw new Error(error.message);
  return data as { id: string; product_commission_amount: number };
}

const pesos = (t: string | null) =>
  Number((t ?? "").match(/\$ ([\d.]+)/)?.[1].replace(/\./g, "") ?? 0);

test.describe("Hito 12 · comisión de productos en los reportes", () => {
  test.beforeEach(() => setCommissionable(true));
  test.afterEach(() => setCommissionable(false));

  test("REQ-069.2 REQ-069.3 la Caja de hoy muestra el renglón de productos y las compras de barberos", async ({
    page,
  }) => {
    const { juan, pedro } = await ids();
    const sale = await sell({ barber: juan, buyer: null, total: 4000 });
    expect(sale.product_commission_amount).toBe(400);
    await sell({ barber: null, buyer: pedro, total: 3200 });

    await loginAsOwner(page);
    await page.goto("/admin/caja");
    const row = page.getByTestId(`products-${juan}`);
    await expect(row).toContainText("comisión 10 % =");
    await expect(row).toContainText("total a pagar");
    await expect(page.getByTestId("staff-purchases")).toContainText("Compras de barberos: $");
    await expect(page.getByTestId(`sale-${sale.id}`)).toContainText("Juan");
  });

  test("REQ-069.5 Mis números muestra la comisión de productos aparte y el total", async ({
    page,
  }) => {
    await loginAsBarber(page, 0); // Juan
    await page.getByRole("link", { name: "Mis números" }).click();
    await expect(page.getByRole("heading", { name: "Mis números" })).toBeVisible();
    const before = pesos(await page.getByTestId("today-products").textContent());
    const total0 = pesos(await page.getByTestId("today").textContent());

    const { juan } = await ids();
    const sale = await sell({ barber: juan, buyer: null, total: 4000 });
    await page.reload();

    expect(pesos(await page.getByTestId("today-products").textContent())).toBe(before + 400);
    expect(pesos(await page.getByTestId("today").textContent())).toBe(total0 + 400);
    await expect(page.getByTestId("today")).toContainText("Comisión de servicios");
    await expect(page.getByTestId(`my-sale-${sale.id}`)).toContainText("productos $ 400");
  });
});
