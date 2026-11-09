import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminDb, loginAsBarber, SEED, tapNewSale } from "./helpers";

/** T-095 · REQ-057: el barbero cobra con la tarjeta de regalo en "Nueva venta". */
async function openNewSale(page: Page) {
  await tapNewSale(page);
  const sheet = page.getByRole("dialog", { name: "Nueva venta" });
  await expect(sheet).toBeVisible();
  return sheet;
}

test.describe("REQ-057 pagar con la tarjeta de regalo en el cobro", () => {
  test("REQ-057.1 REQ-057.3 REQ-057.4 el barbero cobra un corte con tarjeta y efectivo; REQ-057.2 sin saldo sale el error", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db.from("businesses").select("id").eq("slug", SEED.slug).single();
    const { data: sold, error } = await db.rpc("sell_gift_card", {
      p_business_id: biz!.id,
      p_amount: 20000,
      p_buyer_phone: `+57322${String(Date.now()).slice(-7)}`,
      p_buyer_name: "Compra Cobro",
      p_recipient_name: null,
      p_payments: [{ method: "cash", amount: 20000 }],
    });
    expect(error).toBeNull();
    const card = sold as { code: string; saleId: string; giftCardId: string };
    let saleId: string | null = null;

    try {
      await loginAsBarber(page, 0);
      const sheet = await openNewSale(page);
      await sheet.getByRole("button", { name: "+ Agregar servicio" }).click();
      await sheet
        .getByLabel("Servicio", { exact: true })
        .selectOption({ label: "Corte · $ 25.000" });
      await expect(sheet.getByTestId("checkout-total")).toHaveText("$ 25.000");
      await sheet.getByRole("radio", { name: "Tarjeta de regalo" }).click();
      // Se escribe como venga: minúsculas y con guion
      await sheet
        .getByLabel("Código")
        .fill(`${card.code.slice(0, 4)}-${card.code.slice(4)}`.toLowerCase());
      await sheet.getByRole("button", { name: "Buscar tarjeta de regalo" }).click();
      await expect(sheet.getByTestId("gift-card-balance")).toHaveText(
        /^Saldo \$\s20\.000 · vence el \d+ de [a-z]+ de \d{4}$/,
      );
      await expect(sheet.getByText("Con la tarjeta:")).toContainText("$ 20.000");
      await expect(sheet.getByText(/Faltan/)).toContainText("$ 5.000");
      await sheet
        .getByRole("radiogroup", { name: "Medio para lo que falta" })
        .getByRole("radio", { name: "Efectivo" })
        .click();
      await sheet.getByRole("button", { name: "Registrar $ 25.000" }).click();
      await expect(page.getByRole("status").filter({ hasText: "$ 25.000" })).toBeVisible();

      const { data: pays } = await db
        .from("sale_payments")
        .select("sale_id, method, amount")
        .eq("gift_card_id", card.giftCardId);
      expect(pays).toHaveLength(1);
      expect(pays![0]).toMatchObject({ method: "gift_card", amount: 20000 });
      saleId = pays![0].sale_id;
      const { data: rest } = await db
        .from("sale_payments")
        .select("method, amount")
        .eq("sale_id", saleId!)
        .eq("method", "cash");
      expect(rest).toEqual([{ method: "cash", amount: 5000 }]);

      // La misma tarjeta ya no tiene saldo
      const again = await openNewSale(page);
      await again.getByRole("button", { name: "Agregar un Gaseosa" }).click();
      await again.getByRole("radio", { name: "Tarjeta de regalo" }).click();
      await again.getByLabel("Código").fill(card.code);
      await again.getByRole("button", { name: "Buscar tarjeta de regalo" }).click();
      await expect(again.getByText("Esta tarjeta ya no tiene saldo.")).toBeVisible();
      await again.getByRole("button", { name: /Registrar/ }).click();
      await expect(
        again.getByText("Escribe el código de la tarjeta de regalo y búscalo."),
      ).toBeVisible();
    } finally {
      // Primero la venta que usó la tarjeta, luego la de la tarjeta (GIFT_CARD_IN_USE)
      const owner = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      );
      await owner.auth.signInWithPassword(SEED.owner);
      if (saleId) await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E" });
      await owner.rpc("void_sale", { p_sale_id: card.saleId, p_reason: "Prueba E2E" });
    }
  });

  test("REQ-057.1 si se escoge la tarjeta por error se quita y se cobra con otro medio", async ({
    page,
  }) => {
    await loginAsBarber(page, 0);
    const sheet = await openNewSale(page);
    await sheet.getByRole("button", { name: "Agregar un Gaseosa" }).click();
    await sheet.getByRole("radio", { name: "Tarjeta de regalo" }).click();
    await expect(sheet.getByRole("region", { name: "Tarjeta de regalo" })).toBeVisible();
    await sheet.getByRole("button", { name: "Usar otro medio de pago" }).click();
    await expect(sheet.getByRole("region", { name: "Tarjeta de regalo" })).toHaveCount(0);
    await expect(sheet.getByRole("radio", { name: "Tarjeta de regalo" })).not.toBeChecked();
    await sheet.getByRole("radio", { name: "Efectivo" }).click();
    await sheet.getByRole("button", { name: "Registrar $ 4.000" }).click();
    await expect(
      page.getByRole("status").filter({ hasText: "Venta registrada: $ 4.000" }),
    ).toBeVisible();
  });
});
