import { afterAll, describe, expect, it } from "vitest";
import { expectSqlError, loginAs, pool, withTx, type Q } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";

afterAll(() => pool.end());

/** 5.000 clientes con nombres y celulares distintos (seed de carga, NFR-011). */
async function seedLoad(q: Q, business: string) {
  await q(
    `insert into customers (business_id, phone_e164, name, last_visit_at, visits_count)
     select $1, '+57300' || lpad(g::text, 7, '0'),
            (array['Camilo','Sara','Andrés','Valentina','Mateo','Isabella','Samuel','Mariana'])[1 + g % 8]
              || ' ' || (array['Restrepo','Mejía','Pulgarín','Ríos','Londoño','Gómez','Zapata','Ortiz','Cardona','Vélez'])[1 + (g / 8) % 10]
              || ' ' || g,
            now() - make_interval(days => g % 90), 1 + g % 12
     from generate_series(1, 5000) g`,
    [business],
  );
  await q("analyze customers");
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const t0 = performance.now();
  const r = await fn();
  return [r, performance.now() - t0];
}

describe("REQ-018.3 búsqueda de clientes", () => {
  it("REQ-018.3 busca por nombre y por últimos dígitos en menos de 1 s con 5.000 clientes", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await seedLoad(q, f.businessA);
      await loginAs(q, USERS.ownerA);

      const [byName, msName] = await timed(() =>
        q<{ name: string }>("select name from search_customers($1, $2)", [
          f.businessA,
          "valentina rios",
        ]),
      );
      expect(byName.rows.length).toBeGreaterThan(0);
      expect(byName.rows[0].name).toMatch(/^Valentina Ríos/);
      expect(msName).toBeLessThan(1000);

      const [byPhone, msPhone] = await timed(() =>
        q<{ phone_e164: string }>("select phone_e164 from search_customers($1, $2)", [
          f.businessA,
          "4321",
        ]),
      );
      expect(byPhone.rows[0].phone_e164).toBe("+573000004321");
      expect(msPhone).toBeLessThan(1000);
    });
  });

  it("REQ-018.3 el dueño de otro negocio no encuentra nada", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await seedLoad(q, f.businessA);
      await loginAs(q, USERS.ownerB);
      const r = await q("select * from search_customers($1, $2)", [f.businessA, "camilo"]);
      expect(r.rows).toHaveLength(0);
    });
  });
});

describe("REQ-018.4 clientes del barbero", () => {
  it("REQ-018.4 barber_customers solo devuelve clientes de su negocio que atendió o tiene en la fila", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await seedLoad(q, f.businessA);
      // Un turno de B atendido por el barbero de B con el mismo celular que un cliente de A
      await q(
        `insert into customers (business_id, phone_e164, name) values ($1, '+573000000001', 'Cliente de B')`,
        [f.businessB],
      );
      await loginAs(q, USERS.barberA);
      const r = await q<{ id: string }>("select id from barber_customers(null)");
      expect(r.rows).toHaveLength(0); // nadie atendido ni en fila todavía

      await q("select auth.test_logout()");
      await loginAs(q, USERS.barberB);
      const rb = await q("select id from barber_customers('0001')");
      expect(rb.rows).toHaveLength(0);
    });
  });
});

describe("REQ-018.5 fusión de fichas", () => {
  it("REQ-018.5 un dueño no puede fusionar fichas de otro negocio", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      const ids = await q<{ id: string }>(
        `insert into customers (business_id, phone_e164, name)
         values ($1, '+573000000101', 'Uno'), ($1, '+573000000102', 'Dos') returning id`,
        [f.businessA],
      );
      await loginAs(q, USERS.ownerB);
      await expectSqlError(
        q,
        "select merge_customers($1, $2)",
        [ids.rows[0].id, ids.rows[1].id],
        "42501",
      );
      await q("select auth.test_logout()");
      await loginAs(q, USERS.ownerA);
      const merged = await q<{ visits_count: number }>(
        "select visits_count from merge_customers($1, $2)",
        [ids.rows[0].id, ids.rows[1].id],
      );
      expect(merged.rows[0].visits_count).toBe(0);
    });
  });
});
