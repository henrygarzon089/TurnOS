import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminDb, SEED } from "./helpers";

test.describe("REQ-056 / REQ-058 página pública de la tarjeta de regalo", () => {
  test("REQ-056.2 el enlace muestra la tarjeta sin cuenta y REQ-056.3 sin datos de quien compró", async ({
    page,
  }) => {
    const db = adminDb();
    const { data: biz } = await db
      .from("businesses")
      .select("id, name")
      .eq("slug", SEED.slug)
      .single();
    const buyer = `Compra Página ${String(Date.now()).slice(-4)}`;
    const { data: sold, error } = await db.rpc("sell_gift_card", {
      p_business_id: biz!.id,
      p_amount: 30000,
      p_buyer_phone: `+57321${String(Date.now()).slice(-7)}`,
      p_buyer_name: buyer,
      p_recipient_name: "Lucía",
      p_payments: [{ method: "cash", amount: 30000 }],
    });
    expect(error).toBeNull();
    const card = sold as { token: string; code: string; saleId: string };

    try {
      await page.goto(`/regalo/${card.token}`);
      const box = page.getByRole("region", { name: "Tarjeta de regalo" });
      await expect(box).toContainText("Para Lucía");
      await expect(box).toContainText("Saldo $ 30.000");
      await expect(box).toContainText(`${card.code.slice(0, 4)}-${card.code.slice(4)}`);
      await expect(page.getByText(biz!.name).first()).toBeVisible();
      await expect(page.getByText("El saldo no se devuelve en efectivo.")).toBeVisible();
      await expect(page.getByText(/^Vence el \d+ de [a-z]+ de \d{4}\.$/)).toBeVisible();
      await expect(page.getByText(buyer)).toHaveCount(0);

      // Token desconocido: no existe
      const res = await page.goto("/regalo/no-existe-este-token-123");
      expect(res?.status()).toBe(404);
    } finally {
      // La venta no se queda en la caja de las demás pruebas (sales_guard exige quién anula)
      const owner = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false } },
      );
      await owner.auth.signInWithPassword(SEED.owner);
      await owner.rpc("void_sale", { p_sale_id: card.saleId, p_reason: "Prueba E2E" });
    }
  });
});
