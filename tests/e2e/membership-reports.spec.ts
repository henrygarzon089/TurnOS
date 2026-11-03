import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { formatCOP } from "../../src/lib/domain/money";
import { adminDb, loginAsOwner, SEED } from "./helpers";

/**
 * T-076 · REQ-048.3. La cuota (ejemplo G) y un corte de membresía (ejemplo E) salen aparte en la
 * Caja de hoy y en la Semana. Las ventas se hacen con la sesión del dueño; al terminar se anulan
 * (primero el corte, luego la cuota) y el plan se apaga.
 */
const uid = () => Date.now().toString().slice(-7);

type Totals = { membershipFees: number; membershipCuts: { count: number; listValue: number } };

async function ownerClient() {
  const owner = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  );
  await owner.auth.signInWithPassword(SEED.owner);
  return owner;
}

test.describe("REQ-048.3 membresía en la caja y la semana", () => {
  test.setTimeout(120_000);

  test("REQ-048.3 la Caja de hoy y la Semana muestran aparte las cuotas y los cortes de membresía", async ({
    page,
  }) => {
    const admin = adminDb();
    const { data: biz } = await admin
      .from("businesses")
      .select("id")
      .eq("slug", SEED.slug)
      .single();
    const { data: juan } = await admin
      .from("barbers")
      .select("id")
      .eq("business_id", biz!.id)
      .eq("display_name", "Juan")
      .single();
    const { data: corte } = await admin
      .from("services")
      .select("id")
      .eq("business_id", biz!.id)
      .eq("name", "Corte")
      .single();
    const owner = await ownerClient();
    const cash = async () =>
      (await owner.rpc("cash_day_summary", { p_business_id: biz!.id })).data as Totals;
    const week = async () =>
      (await owner.rpc("weekly_summary", { p_business_id: biz!.id })).data as Totals;
    const id = uid();
    const saleIds: string[] = [];
    try {
      await admin.from("services").update({ counts_for_membership: true }).eq("id", corte!.id);
      expect(
        (
          await owner.rpc("save_membership_plan", {
            p_business_id: biz!.id,
            p_enabled: true,
            p_price: 80000,
            p_cuts: 4,
            p_discount_pct: 20,
          })
        ).error,
      ).toBeNull();
      const before = await cash();
      const beforeWeek = await week();

      // Ejemplo G: la cuota
      const fam = await owner.rpc("create_membership", {
        p_business_id: biz!.id,
        p_holder_phone: `+57317${id}`,
        p_holder_name: `Reporte ${id}`,
      });
      expect(fam.error).toBeNull();
      const fee = await owner.rpc("register_membership_fee", {
        p_membership_id: fam.data,
        p_payments: [{ method: "cash", amount: 80000 }],
      });
      expect(fee.error).toBeNull();
      saleIds.push((fee.data as { id: string }).id);

      // Ejemplo E: un corte de membresía con Juan
      const { data: cust } = await admin
        .from("customers")
        .select("id")
        .eq("business_id", biz!.id)
        .eq("phone_e164", `+57317${id}`)
        .single();
      const cut = await owner.rpc("register_sale", {
        p_business_id: biz!.id,
        p_ticket_id: null,
        p_barber_id: juan!.id,
        p_items: [{ kind: "service", qty: 1, ref_id: corte!.id, membership: true }],
        p_payments: [],
        p_customer_id: cust!.id,
      });
      expect(cut.error).toBeNull();
      saleIds.push((cut.data as { id: string }).id);

      const after = await cash();
      expect(after.membershipFees - before.membershipFees).toBe(80000);
      expect(after.membershipCuts.count - before.membershipCuts.count).toBe(1);
      expect(after.membershipCuts.listValue - before.membershipCuts.listValue).toBe(25000);

      await loginAsOwner(page);
      await page.goto("/admin/caja");
      await expect(page.getByTestId("membership-fees")).toHaveText(
        `Cuotas de membresía${formatCOP(after.membershipFees)}`,
      );
      await expect(page.getByTestId("membership-cuts")).toHaveText(
        `Cortes de membresía${after.membershipCuts.count} · ${formatCOP(after.membershipCuts.listValue)}`,
      );
      const sale = page.getByTestId(`sale-${saleIds[1]}`);
      await expect(sale).toContainText("Corte (membresía)");
      await expect(sale).toContainText("Sin pago (membresía)");

      const afterWeek = await week();
      expect(afterWeek.membershipFees - beforeWeek.membershipFees).toBe(80000);
      expect(afterWeek.membershipCuts.count - beforeWeek.membershipCuts.count).toBe(1);
      await page.getByRole("link", { name: "Semana" }).click();
      await expect(page.getByRole("heading", { name: "Semana" })).toBeVisible();
      await expect(page.getByTestId("membership-fees")).toHaveText(
        `Cuotas de membresía${formatCOP(afterWeek.membershipFees)}`,
      );
      await expect(page.getByTestId("membership-cuts")).toHaveText(
        `Cortes de membresía${afterWeek.membershipCuts.count} · ${formatCOP(afterWeek.membershipCuts.listValue)}`,
      );
    } finally {
      for (const saleId of saleIds.reverse())
        await owner.rpc("void_sale", { p_sale_id: saleId, p_reason: "Prueba E2E" });
      await admin.from("membership_plans").update({ enabled: false }).eq("business_id", biz!.id);
    }
  });
});
