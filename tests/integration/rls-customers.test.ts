import { afterAll, describe, expect, it } from "vitest";
import { expectSqlError, loginAs, pool, withTx } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";

afterAll(() => pool.end());

async function addCustomer(
  q: Parameters<typeof seedTwoBusinesses>[0],
  biz: string,
  phone: string,
  name: string,
) {
  const r = await q<{ id: string }>("select upsert_customer($1, $2, $3, 1) as id", [
    biz,
    phone,
    name,
  ]);
  return r.rows[0].id;
}

describe("REQ-018.4 / REQ-031 RLS de clientes, fidelidad y recordatorios", () => {
  it("barbero lee fichas de su negocio, edita solo notas y preferido, nada cruzado", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const ca = await addCustomer(q, f.businessA, "+573007770001", "Cliente A");
      const cb = await addCustomer(q, f.businessB, "+573007770002", "Cliente B");

      await loginAs(q, USERS.barberA);
      const seen = await q<{ id: string }>("select id from customers");
      expect(seen.rows.map((r) => r.id)).toEqual([ca]);

      const okNotes = await q("update customers set notes = 'prefiere corte bajo' where id = $1", [
        ca,
      ]);
      expect(okNotes.rowCount).toBe(1);
      const okPref = await q("update customers set preferred_barber_id = $2 where id = $1", [
        ca,
        f.barberA,
      ]);
      expect(okPref.rowCount).toBe(1);

      await expectSqlError(q, "update customers set name = 'Hack' where id = $1", [ca], "42501");
      await expectSqlError(
        q,
        "update customers set do_not_contact = true where id = $1",
        [ca],
        "42501",
      );

      const cross = await q("update customers set notes = 'x' where id = $1", [cb]);
      expect(cross.rowCount).toBe(0);
      await expectSqlError(
        q,
        "insert into customers (business_id, phone_e164, name) values ($1, '+573007770009', 'Intruso')",
        [f.businessA],
        "42501",
      );
      await expectSqlError(
        q,
        "insert into reminders (business_id, customer_id) values ($1, $2)",
        [f.businessA, ca],
        "42501",
      );
    });
  });

  it("dueño administra clientes y recordatorios solo de su negocio", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const ca = await addCustomer(q, f.businessA, "+573007770001", "Cliente A");
      const cb = await addCustomer(q, f.businessB, "+573007770002", "Cliente B");

      await loginAs(q, USERS.ownerA);
      const okName = await q(
        "update customers set name = 'Cliente A Editado', do_not_contact = true where id = $1",
        [ca],
      );
      expect(okName.rowCount).toBe(1);
      const okRem = await q("insert into reminders (business_id, customer_id) values ($1, $2)", [
        f.businessA,
        ca,
      ]);
      expect(okRem.rowCount).toBe(1);

      const cross = await q("update customers set name = 'Hack' where id = $1", [cb]);
      expect(cross.rowCount).toBe(0);
      await expectSqlError(
        q,
        "insert into reminders (business_id, customer_id) values ($1, $2)",
        [f.businessB, cb],
        "42501",
      );
      await expectSqlError(q, "select anonymize_customer($1)", [cb], "42501");

      const inactive = await q("select * from inactive_customers($1)", [f.businessB]);
      expect(inactive.rows).toEqual([]);
    });
  });

  it("REQ-019 tarjetas y sellos: lectura para miembros, escritura solo por funciones", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const ca = await addCustomer(q, f.businessA, "+573007770001", "Cliente A");
      await q("insert into loyalty_cards (business_id, customer_id, stamps) values ($1, $2, 3)", [
        f.businessA,
        ca,
      ]);

      await loginAs(q, USERS.barberA);
      const cards = await q<{ stamps: number }>("select stamps from loyalty_cards");
      expect(cards.rows).toEqual([{ stamps: 3 }]);
      const upd = await q("update loyalty_cards set stamps = 99 where customer_id = $1", [ca]);
      expect(upd.rowCount).toBe(0); // sin política de update: filtrado
      await expectSqlError(
        q,
        "insert into loyalty_cards (business_id, customer_id) values ($1, $2)",
        [f.businessA, ca],
        "42501",
      );
    });
  });
});
