import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/** Celular nuevo en cada corrida, para no chocar con tarjetas anteriores. */
function freshPhone(): string {
  return `321${String(Date.now()).slice(-7)}`;
}

/** La venta no se queda en la caja de las demás pruebas: la anula el dueño (sales_guard exige quién). */
async function voidAsOwner(saleId: string) {
  const owner = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await owner.auth.signInWithPassword(SEED.owner);
  const { error } = await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E" });
  expect(error).toBeNull();
}

test.describe("REQ-055 / REQ-056 / REQ-059 Tarjetas de regalo del dueño", () => {
  test("REQ-055.1 vende una tarjeta, REQ-056.1 la envía por WhatsApp y REQ-059.3 la ve en la lista", async ({
    page,
  }) => {
    const db = adminDb();
    const phone = freshPhone();
    const buyer = `Compra ${phone.slice(-4)}`;

    await loginAsOwner(page);
    await page.goto("/admin/regalos");
    await expect(page.getByRole("heading", { name: "Tarjetas de regalo" })).toBeVisible();

    await page.getByRole("button", { name: "Vender tarjeta" }).click();
    const form = page.getByRole("form", { name: "Vender tarjeta" });
    // REQ-055.1 en miles exactos
    await form.getByLabel("Valor").fill("25.500");
    await form.getByLabel("Nombre de quien compra").fill(buyer);
    await form.getByLabel("Celular de quien compra").fill(phone);
    await form.getByLabel("Para (opcional)").fill("Mateo");
    await form.getByText("Nequi", { exact: true }).click();
    await form.getByRole("button", { name: "Vender tarjeta" }).click();
    await expect(form.getByText(/El valor va en miles exactos/)).toBeVisible();

    await form.getByLabel("Valor").fill("50.000");
    await form.getByRole("button", { name: "Vender tarjeta" }).click();
    const sold = page.getByRole("status", { name: "Tarjeta vendida" });
    await expect(sold).toBeVisible({ timeout: 15_000 });
    await expect(sold).toContainText("$ 50.000 · Para Mateo · vence el");

    const { data: card } = await db
      .from("gift_cards")
      .select(
        "code, token, sale_id, sales!gift_cards_sale_id_fkey(total, gift_card_total, barber_id, sale_payments(method, amount))",
      )
      .eq("recipient_name", "Mateo")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    try {
      // REQ-055.4 código en dos grupos
      await expect(sold).toContainText(`${card!.code.slice(0, 4)}-${card!.code.slice(4)}`);
      // REQ-055.2 venta sin barbero, por Nequi
      expect(card!.sales).toMatchObject({
        total: 50000,
        gift_card_total: 50000,
        barber_id: null,
        sale_payments: [{ method: "nequi", amount: 50000 }],
      });

      // REQ-056.1 botón de WhatsApp al celular de quien compra, con el enlace de la tarjeta
      const link = sold.getByRole("link", { name: /Enviar por WhatsApp/ });
      await expect(link).toHaveAttribute("href", new RegExp(`^https://wa\\.me/57${phone}\\?text=`));
      const text = decodeURIComponent((await link.getAttribute("href"))!.split("text=")[1]);
      expect(text).toMatch(/^Hola Compra, aquí está tu tarjeta de regalo de .+ por \$ 50\.000: /);
      expect(text).toContain(`/regalo/${card!.token}`);

      // REQ-059.3 en la lista, con saldo, estado y "Saldo por usar"; REQ-056.4 se puede reenviar
      const row = page
        .getByRole("list", { name: "Tarjetas de regalo" })
        .getByRole("listitem")
        .filter({ hasText: buyer });
      await expect(row).toBeVisible();
      await expect(row).toContainText("Vigente");
      await expect(row).toContainText("Saldo $ 50.000 de $ 50.000");
      await expect(row.getByRole("link", { name: /Enviar por WhatsApp/ })).toBeVisible();
      await expect(page.getByLabel("Saldo por usar")).toContainText("$");
    } finally {
      await voidAsOwner(card!.sale_id);
    }
  });
});
