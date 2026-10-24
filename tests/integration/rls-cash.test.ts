import { afterAll, describe, expect, it } from "vitest";
import { expectSqlError, loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS, type TwoBusinesses } from "./fixtures";

afterAll(() => pool.end());

const BARBER_A2 = "0000000a-0000-0000-0000-0000000000b2";

const svc = (id: string) => JSON.stringify([{ kind: "service", ref_id: id, qty: 1 }]);
const pay = (amount: number) => JSON.stringify([{ method: "cash", amount }]);

/** Negocio A con dos barberos, ventas de cada uno, una de productos del dueño, un cierre; y B. */
async function seedCash(q: Q) {
  const f = await seedTwoBusinesses(q);
  await q("insert into auth.users (id, email) values ($1, 'barberA2@test.local')", [BARBER_A2]);
  const a2 = (
    await q<{ id: string }>(
      `insert into barbers (business_id, user_id, display_name, commission_pct) values ($1, $2, 'Barbero A2', 40) returning id`,
      [f.businessA, BARBER_A2],
    )
  ).rows[0].id;
  await q(
    `insert into memberships (user_id, business_id, role, barber_id) values ($1, $2, 'barber', $3)`,
    [BARBER_A2, f.businessA, a2],
  );
  const product = (
    await q<{ id: string }>(
      `insert into products (business_id, name, price) values ($1, 'Gaseosa A', 4000) returning id`,
      [f.businessA],
    )
  ).rows[0].id;
  const sale = async (business: string, barber: string | null, items: string, amount: number) =>
    (
      await q<{ id: string }>(
        "select (register_sale($1, null, $2, $3::jsonb, $4::jsonb)).id as id",
        [business, barber, items, pay(amount)],
      )
    ).rows[0].id;
  const ids = {
    mine: await sale(f.businessA, f.barberA, svc(f.serviceA), 25000),
    other: await sale(f.businessA, a2, svc(f.serviceA), 25000),
    products: await sale(
      f.businessA,
      null,
      JSON.stringify([{ kind: "product", ref_id: product, qty: 1 }]),
      4000,
    ),
    inB: await sale(f.businessB, f.barberB, svc(f.serviceB), 30000),
  };
  await q(
    `insert into cash_closures (business_id, business_day, totals, cash_expected, cash_counted, difference, closed_by)
     values ($1, current_date - 1, '{}', 0, 0, 0, $2)`,
    [f.businessA, USERS.ownerA],
  );
  await q("update barbers set commission_pct = 65 where id = $1", [f.barberA]);
  await q("update barbers set commission_pct = 45 where id = $1", [a2]);
  return { f, a2, ids };
}

async function ids(q: Q, table: string, col = "id") {
  return (await q<{ v: string }>(`select ${col}::text as v from ${table} order by 1`)).rows.map(
    (r) => r.v,
  );
}

describe("REQ-029.1 / REQ-023.7 / REQ-031.1 RLS de caja", () => {
  it("REQ-029.1 el barbero solo ve sus ventas, sus líneas y sus pagos", async () => {
    await withTx(async (q) => {
      const { ids: s } = await seedCash(q);
      await loginAs(q, USERS.barberA);
      expect(await ids(q, "sales")).toEqual([s.mine]);
      expect(await ids(q, "sale_items", "sale_id")).toEqual([s.mine]);
      expect(await ids(q, "sale_payments", "sale_id")).toEqual([s.mine]);
    });
  });

  it("REQ-029.1 el barbero no ve los cierres de caja ni el historial de otros barberos", async () => {
    await withTx(async (q) => {
      const { f } = await seedCash(q);
      await loginAs(q, USERS.barberA);
      expect(await ids(q, "cash_closures")).toEqual([]);
      expect(await ids(q, "commission_changes", "barber_id")).toEqual([f.barberA]);
    });
  });

  it("REQ-023.7 el barbero registra solo sus cobros y nunca escribe directo en las tablas", async () => {
    await withTx(async (q) => {
      const { f, a2, ids: s } = await seedCash(q);
      await loginAs(q, USERS.barberA);
      const ok = await q<{ barber_id: string }>(
        "select (register_sale($1, null, $2, $3::jsonb, $4::jsonb)).barber_id",
        [f.businessA, f.barberA, svc(f.serviceA), pay(25000)],
      );
      expect(ok.rows[0].barber_id).toBe(f.barberA);
      await expectSqlError(
        q,
        "select register_sale($1, null, $2, $3::jsonb, $4::jsonb)",
        [f.businessA, a2, svc(f.serviceA), pay(25000)],
        "42501",
      );
      await expectSqlError(
        q,
        `insert into sales (business_id, business_day, services_total, products_total, total)
         values ($1, current_date, 0, 0, 0)`,
        [f.businessA],
        "42501",
      );
      const upd = await q("update sales set created_by = null where id = $1", [s.mine]);
      expect(upd.rowCount).toBe(0);
      await expectSqlError(q, "select void_sale($1, 'x')", [s.mine], "42501");
    });
  });

  it("REQ-027 el dueño ve todas las ventas y cierres de su negocio y ninguno de otro", async () => {
    await withTx(async (q) => {
      const { ids: s } = await seedCash(q);
      await loginAs(q, USERS.ownerA);
      expect(await ids(q, "sales")).toEqual([s.mine, s.other, s.products].sort());
      expect((await ids(q, "cash_closures")).length).toBe(1);
      expect((await ids(q, "commission_changes")).length).toBe(2);
      const voided = await q<{ status: string }>("select (void_sale($1, 'Prueba')).status", [
        s.other,
      ]);
      expect(voided.rows[0].status).toBe("voided");
    });
  });

  it("REQ-031.1 nada cruzado entre negocios", async () => {
    await withTx(async (q) => {
      const { f, ids: s } = await seedCash(q);
      await loginAs(q, USERS.ownerB);
      expect(await ids(q, "sales")).toEqual([s.inB]);
      expect(await ids(q, "cash_closures")).toEqual([]);
      await expectSqlError(
        q,
        "select register_sale($1, null, $2, $3::jsonb, $4::jsonb)",
        [f.businessA, f.barberA, svc(f.serviceA), pay(25000)],
        "42501",
      );
      await expectSqlError(q, "select void_sale($1, 'x')", [s.mine], "42501");
      await q("select auth.test_logout()");
      await loginAs(q, USERS.barberB);
      expect(await ids(q, "sales")).toEqual([s.inB]);
      expect(await ids(q, "sale_items", "sale_id")).toEqual([s.inB]);
    });
  });
});

export type { TwoBusinesses };
