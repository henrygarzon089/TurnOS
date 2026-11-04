import { afterAll, describe, expect, it } from "vitest";
import {
  balanceToUse,
  giftCardErrorMessage,
  parseGiftCardForm,
  type GiftCardStatus,
} from "@/lib/domain/giftCard";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";

afterAll(() => pool.end());

/**
 * Las acciones de src/lib/actions/giftCards.ts, paso a paso con la sesión del dueño: las mismas
 * funciones SQL (0051) y los mismos mapeos de src/lib/domain/giftCard.ts.
 */

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return fd;
}

const SALE = {
  amount: "50.000",
  name: "Ana Compra",
  phone: "320 999 1001",
  recipient: "Mateo",
  method: "nequi",
};

/** sellGiftCard: valida el formulario y llama sell_gift_card; los errores salen en español. */
async function sell(q: Q, biz: string, fd: FormData) {
  const parsed = parseGiftCardForm(fd);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;
  await q("savepoint act");
  try {
    const r = await q<{ c: { giftCardId: string; code: string; token: string } }>(
      "select sell_gift_card($1, $2, $3, $4, $5, $6::jsonb) as c",
      [
        biz,
        v.amount,
        v.phone,
        v.name,
        v.recipient,
        JSON.stringify([{ method: v.method, amount: v.amount }]),
      ],
    );
    await q("release savepoint act");
    return { card: r.rows[0].c };
  } catch (e) {
    await q("rollback to savepoint act");
    return { error: giftCardErrorMessage(e as { message?: string; code?: string }) };
  }
}

type ListRow = {
  id: string;
  code: string;
  buyer_name: string;
  balance: number;
  status: GiftCardStatus;
  token: string;
};
const list = async (q: Q, biz: string) =>
  (await q<ListRow>("select * from gift_cards_list($1)", [biz])).rows;

describe("REQ-055 vender una tarjeta desde /admin/regalos", () => {
  it("REQ-055.1 el dueño vende y la tarjeta queda en la lista con todo su saldo", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      const r = await sell(q, f.businessA, form(SALE));
      expect(r.error).toBeUndefined();
      const rows = await list(q, f.businessA);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        code: r.card!.code,
        buyer_name: "Ana Compra",
        balance: 50000,
        status: "active",
      });
      expect(balanceToUse(rows)).toBe(50000);
    });
  });

  it("REQ-055.1 el barbero no vende ni ve la lista", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.barberA);
      expect((await sell(q, f.businessA, form(SALE))).error).toBe(
        "No tienes permiso para esta acción.",
      );
    });
  });

  it("REQ-055.2 con la caja cerrada sale el mensaje en español", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await q(
        `insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
         values ($1, business_day_bogota(now()), '{}', 0, 0, 0, $2)`,
        [f.businessA, USERS.ownerA],
      );
      await loginAs(q, USERS.ownerA);
      expect((await sell(q, f.businessA, form(SALE))).error).toBe(
        "La caja de hoy ya está cerrada. Reábrela para vender la tarjeta.",
      );
    });
  });

  it("REQ-056.4 la lista trae el token para volver a enviar la tarjeta, solo del propio negocio", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);
      const r = await sell(q, f.businessA, form(SALE));
      expect((await list(q, f.businessA))[0].token).toBe(r.card!.token);
      await q("select auth.test_logout()");
      await loginAs(q, USERS.ownerB);
      await expect(list(q, f.businessA)).rejects.toThrow(/FORBIDDEN/);
    });
  });
});
