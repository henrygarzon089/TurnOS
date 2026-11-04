import { afterAll, describe, expect, it } from "vitest";
import { giftCardConditions, giftCardDayLabel, giftCardHeadline } from "@/lib/domain/giftCard";
import { getGiftCardByToken } from "@/lib/gift-cards/public-gift-card";
import { loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";
import { createPgGateway } from "./pg-gateway";

afterAll(() => pool.end());

/** La página pública /regalo/[token] lee con service_role (ADR-009), como "Mi turno". */
async function soldCard(q: Q) {
  const f = await seedTwoBusinesses(q);
  await loginAs(q, USERS.ownerA);
  const r = await q<{ c: { token: string; code: string; saleId: string; giftCardId: string } }>(
    `select sell_gift_card($1, 50000, '+573209994001', 'Ana Compra', 'Mateo',
                           '[{"method":"cash","amount":50000}]'::jsonb) as c`,
    [f.businessA],
  );
  await q("select auth.test_logout()");
  await loginAs(q, null, "service_role");
  return { f, card: r.rows[0].c };
}

describe("REQ-056 página pública de la tarjeta", () => {
  it("REQ-056.2 muestra negocio, Para, código, saldo y vencimiento por el token", async () => {
    await withTx(async (q) => {
      const { card } = await soldCard(q);
      const g = await getGiftCardByToken(createPgGateway(q), card.token);
      expect(g).toMatchObject({
        businessName: "Barbería A",
        slug: "barberia-a",
        recipientName: "Mateo",
        code: card.code,
        amount: 50000,
        balance: 50000,
        status: "active",
      });
      expect(g!.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(giftCardHeadline(g!)).toBe("Saldo $ 50.000");
      expect(giftCardConditions(g!.expiresOn)).toEqual([
        "La puede usar quien tenga el código.",
        "Se usa como pago en una o varias visitas, hasta gastar el saldo.",
        "El saldo no se devuelve en efectivo.",
        `Vence el ${giftCardDayLabel(g!.expiresOn)}.`,
      ]);
    });
  });

  it("REQ-056.3 no trae quién la compró ni en qué se gastó", async () => {
    await withTx(async (q) => {
      const { card } = await soldCard(q);
      const g = await getGiftCardByToken(createPgGateway(q), card.token);
      expect(Object.keys(g!).sort()).toEqual(
        [
          "amount",
          "balance",
          "businessName",
          "code",
          "expiresOn",
          "recipientName",
          "slug",
          "status",
        ].sort(),
      );
      expect(JSON.stringify(g)).not.toMatch(/Ana Compra|3209994001/);
    });
  });

  it("REQ-056.3 un token desconocido o mal formado no trae nada", async () => {
    await withTx(async (q) => {
      await soldCard(q);
      const gw = createPgGateway(q);
      expect(await getGiftCardByToken(gw, "no-existe-pero-largo-123")).toBeNull();
      expect(await getGiftCardByToken(gw, "x'; drop table gift_cards;--")).toBeNull();
    });
  });

  it("REQ-058.4 vencida, la página lo dice y no muestra saldo para usar", async () => {
    await withTx(async (q) => {
      const { card } = await soldCard(q);
      await q("select auth.test_logout()");
      await q(
        `update gift_cards set sold_on = sold_on - 400, expires_on = ((sold_on - 400) + interval '1 year')::date
          where token = $1`,
        [card.token],
      );
      await loginAs(q, null, "service_role");
      const g = await getGiftCardByToken(createPgGateway(q), card.token);
      expect(g!.status).toBe("expired");
      expect(giftCardHeadline(g!)).toBe("Vencida");
    });
  });
});
