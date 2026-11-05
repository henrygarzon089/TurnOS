import { afterAll, describe, expect, it } from "vitest";
import { checkoutPayments } from "@/lib/domain/giftCard";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS, type TwoBusinesses } from "./fixtures";

afterAll(() => pool.end());

/**
 * T-117 · registerSale de src/lib/actions/cash.ts con `staffBuyerId` (0061): la misma llamada a
 * register_sale con la sesión del dueño o del barbero. Una cera de $ 10.000 que da comisión.
 */

type Line = { kind: "service" | "product"; ref_id: string; qty: number };

async function addWax(q: Q, biz: string) {
  const r = await q<{ id: string }>(
    `insert into products (business_id, name, price, commissionable) values ($1, 'Cera', 10000, true)
     returning id`,
    [biz],
  );
  return r.rows[0].id;
}

async function register(
  q: Q,
  f: TwoBusinesses,
  a: { barberId: string | null; items: Line[]; total: number; staffBuyerId: string | null },
) {
  await q("savepoint sale");
  try {
    const r = await q<{ id: string }>(
      `select (register_sale($1, null, $2, $3::jsonb, $4::jsonb, null, $5)).id`,
      [
        f.businessA,
        a.barberId,
        JSON.stringify(a.items),
        JSON.stringify(checkoutPayments(a.total, "cash", null)),
        a.staffBuyerId,
      ],
    );
    await q("release savepoint sale");
    const sale = await q<{
      total: number;
      staff_buyer_id: string | null;
      staff_discount_total: number;
      product_commission_amount: number;
    }>(
      `select total, staff_buyer_id, staff_discount_total, product_commission_amount
       from sales where id = $1`,
      [r.rows[0].id],
    );
    return { sale: sale.rows[0] };
  } catch (e) {
    await q("rollback to savepoint sale");
    return { error: (e as Error).message };
  }
}

describe("REQ-068 compra de un barbero desde registerSale", () => {
  it("REQ-068.2 REQ-068.3 el dueño registra la compra del barbero: 20 % menos y sin comisión", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const wax = await addWax(q, f.businessA);
      await loginAs(q, USERS.ownerA);
      const r = await register(q, f, {
        barberId: null,
        items: [{ kind: "product", ref_id: wax, qty: 1 }],
        total: 8000,
        staffBuyerId: f.barberA,
      });
      expect(r.error).toBeUndefined();
      expect(r.sale).toEqual({
        total: 8000,
        staff_buyer_id: f.barberA,
        staff_discount_total: 2000,
        product_commission_amount: 0,
      });
    });
  });

  it("REQ-068.2 el barbero no puede registrar una compra de barbero", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const wax = await addWax(q, f.businessA);
      await loginAs(q, USERS.barberA);
      const r = await register(q, f, {
        barberId: null,
        items: [{ kind: "product", ref_id: wax, qty: 1 }],
        total: 8000,
        staffBuyerId: f.barberA,
      });
      expect(r.error).toContain("FORBIDDEN");
    });
  });

  it("REQ-068.3 la compra de un barbero no acepta servicios", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      const r = await register(q, f, {
        barberId: null,
        items: [{ kind: "service", ref_id: f.serviceA, qty: 1 }],
        total: 20000,
        staffBuyerId: f.barberA,
      });
      expect(r.error).toContain("INVALID_STAFF_PURCHASE");
    });
  });

  it("REQ-066.4 el barbero vende la cera a su nombre y gana el 10 %", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const wax = await addWax(q, f.businessA);
      await loginAs(q, USERS.barberA);
      const r = await register(q, f, {
        barberId: f.barberA,
        items: [{ kind: "product", ref_id: wax, qty: 1 }],
        total: 10000,
        staffBuyerId: null,
      });
      expect(r.error).toBeUndefined();
      expect(r.sale).toMatchObject({ total: 10000, product_commission_amount: 1000 });
    });
  });
});
