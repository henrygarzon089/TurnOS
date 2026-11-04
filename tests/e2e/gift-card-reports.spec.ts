import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { formatCOP } from "../../src/lib/domain/money";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/**
 * T-096 · REQ-059.1, REQ-059.2, REQ-058.1. Se vende una tarjeta y se paga una gaseosa con ella
 * (sesión del dueño); la Caja de hoy y la Semana las muestran aparte. Al terminar se anula primero
 * la gaseosa y luego la tarjeta.
 */
type Totals = { giftCardsSold: number; giftCardsRedeemed: number; moneyIn: number };

async function ownerClient() {
  const owner = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await owner.auth.signInWithPassword(SEED.owner);
  return owner;
}

test.describe("REQ-059 tarjetas de regalo en la caja y la semana", () => {
  test.setTimeout(120_000);

  test("REQ-059.1 REQ-059.2 la Caja de hoy y la Semana muestran vendidas, pagado con tarjeta y lo que entró en plata; REQ-058.1 no se anula una tarjeta usada", async ({
    page,
  }) => {
    const admin = adminDb();
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", SEED.slug)
      .single();
    const { data: soda } = await admin
      .from("products")
      .select("id, price")
      .eq("business_id", biz!.id)
      .eq("name", "Gaseosa")
      .single();
    const owner = await ownerClient();
    const cash = async () =>
      (await owner.rpc("cash_day_summary", { p_business_id: biz!.id })).data as Totals;
    const week = async () =>
      (await owner.rpc("weekly_summary", { p_business_id: biz!.id })).data as Totals;
    const saleIds: string[] = [];
    try {
      const sold = await owner.rpc("sell_gift_card", {
        p_business_id: biz!.id,
        p_amount: 30000,
        p_buyer_phone: `+57323${Date.now().toString().slice(-7)}`,
        p_buyer_name: "Compra Reporte",
        p_recipient_name: null,
        p_payments: [{ method: "nequi", amount: 30000 }],
      });
      expect(sold.error).toBeNull();
      const card = sold.data as { saleId: string; code: string };
      saleIds.push(card.saleId);
      const paid = await owner.rpc("register_sale", {
        p_business_id: biz!.id,
        p_ticket_id: null,
        p_barber_id: null,
        p_items: [{ kind: "product", qty: 1, ref_id: soda!.id }],
        p_payments: [{ method: "gift_card", amount: soda!.price, code: card.code }],
      });
      expect(paid.error).toBeNull();
      saleIds.push((paid.data as { id: string }).id);

      const day = await cash();
      expect(day.giftCardsSold).toBeGreaterThanOrEqual(30000);
      expect(day.giftCardsRedeemed).toBeGreaterThanOrEqual(soda!.price);

      await loginAsOwner(page);
      await page.goto("/admin/caja");
      const box = page.getByRole("region", { name: "Tarjetas de regalo" });
      await expect(box.getByTestId("gift-card-sold")).toHaveText(
        `Tarjetas de regalo vendidas${formatCOP(day.giftCardsSold)}`,
      );
      await expect(box.getByTestId("gift-card-redeemed")).toHaveText(
        `Pagado con tarjeta de regalo${formatCOP(day.giftCardsRedeemed)}`,
      );
      await expect(box.getByTestId("gift-card-moneyIn")).toHaveText(
        `Entró en plata${formatCOP(day.moneyIn)}`,
      );

      // REQ-058.1 la venta de la tarjeta no se anula mientras la otra venta la use
      await page.getByTestId(`sale-${card.saleId}`).getByRole("button", { name: "Anular" }).click();
      const dialog = page.getByRole("dialog", { name: "Anular venta" });
      await dialog.getByLabel("Motivo").fill("Prueba E2E");
      await dialog.getByRole("button", { name: "Anular venta" }).click();
      await expect(
        dialog.getByText("Esta tarjeta ya se usó: primero anula las ventas que la usaron."),
      ).toBeVisible();

      const w = await week();
      await page.goto("/admin/semana");
      await expect(page.getByRole("heading", { name: "Semana" })).toBeVisible();
      await expect(page.getByTestId("gift-card-sold")).toHaveText(
        `Tarjetas de regalo vendidas${formatCOP(w.giftCardsSold)}`,
      );
      await expect(page.getByTestId("gift-card-moneyIn")).toHaveText(
        `Entró en plata${formatCOP(w.moneyIn)}`,
      );
    } finally {
      for (const saleId of saleIds.reverse())
        await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E" });
    }
  });
});
