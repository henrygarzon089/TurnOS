import { afterAll, describe, expect, it } from "vitest";
import { MY_NUMBERS_COLUMNS, summarizeMyNumbers } from "@/lib/domain/my-numbers";
import { loginAs, pool, withTx } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";

afterAll(() => pool.end());

const svc = (id: string) => JSON.stringify([{ kind: "service", ref_id: id, qty: 1 }]);
const pay = (amount: number) => JSON.stringify([{ method: "cash", amount }]);

describe("REQ-025.5 / REQ-029.1 Mis números", () => {
  it("REQ-029.1 la consulta de Mis números con el JWT del barbero no devuelve ventas ajenas", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      // Segundo barbero en A
      const otherUser = "0000000a-0000-0000-0000-0000000000c3";
      await q("insert into auth.users (id, email) values ($1, 'otro@test.local')", [otherUser]);
      const other = (
        await q<{ id: string }>(
          "insert into barbers (business_id, user_id, display_name, commission_pct) values ($1, $2, 'Otro', 40) returning id",
          [f.businessA, otherUser],
        )
      ).rows[0].id;
      await q(
        "insert into memberships (user_id, business_id, role, barber_id) values ($1, $2, 'barber', $3)",
        [otherUser, f.businessA, other],
      );
      const sale = (b: string, biz: string, s: string, amount: number) =>
        q("select register_sale($1, null, $2, $3::jsonb, $4::jsonb)", [
          biz,
          b,
          svc(s),
          pay(amount),
        ]);
      await sale(f.barberA, f.businessA, f.serviceA, 25000);
      await sale(f.barberA, f.businessA, f.serviceA, 25000);
      await sale(other, f.businessA, f.serviceA, 25000);
      await sale(f.barberB, f.businessB, f.serviceB, 30000);

      await loginAs(q, USERS.barberA);
      // Misma consulta que getMyNumbers (src/lib/actions/cash.ts), sin filtrar por barbero: el RLS filtra
      const rows = (
        await q(
          `select ${MY_NUMBERS_COLUMNS.replace("business_day", "business_day::text as business_day")}, exists (select 1 from sale_items i where i.sale_id = sales.id and i.kind = 'service') as has_service
           from sales where business_day >= current_date - 6 order by created_at desc`,
        )
      ).rows as never[];
      expect(rows).toHaveLength(2);
      expect(new Set((rows as { barber_id: string }[]).map((r) => r.barber_id))).toEqual(
        new Set([f.barberA]),
      );

      const today = (await q<{ d: string }>("select current_date::text as d")).rows[0].d;
      const n = summarizeMyNumbers(rows, today, today);
      // 25.000 al 60 % = 15.000 por venta
      expect(n.today).toEqual({ services: 2, sold: 50000, commission: 30000 });
      expect(n.week).toEqual({ services: 2, sold: 50000, commission: 30000 });
    });
  });
});
