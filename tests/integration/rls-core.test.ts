import { afterAll, describe, expect, it } from "vitest";
import { expectSqlError, loginAs, pool, withTx } from "./db";
import { seedTwoBusinesses, USERS } from "./fixtures";

afterAll(() => pool.end());

describe("REQ-031 aislamiento multi-negocio (núcleo)", () => {
  it("REQ-031.4 barbero del negocio A no lee ni escribe servicios ni barberos de B", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.barberA);

      const services = await q<{ name: string }>("select name from services order by name");
      expect(services.rows.map((r) => r.name)).toEqual(["Corte A"]);

      const barbers = await q<{ display_name: string }>("select display_name from barbers");
      expect(barbers.rows.map((r) => r.display_name)).toEqual(["Barbero A"]);

      const businesses = await q<{ slug: string }>("select slug from businesses");
      expect(businesses.rows.map((r) => r.slug)).toEqual(["barberia-a"]);

      // Escritura cruzada: sin efecto (la fila es invisible)
      const upd = await q("update services set price = 1 where id = $1", [f.serviceB]);
      expect(upd.rowCount).toBe(0);
      const updBarber = await q("update barbers set status = 'paused' where id = $1", [f.barberB]);
      expect(updBarber.rowCount).toBe(0);

      // Insert cruzado: error de política
      await expectSqlError(
        q,
        "insert into services (business_id, name, duration_min, price) values ($1, 'Intruso', 20, 1)",
        [f.businessB],
        "42501",
      );

      await q("select auth.test_logout()");
      const check = await q<{ price: number; status: string }>(
        "select s.price, b.status::text from services s, barbers b where s.id = $1 and b.id = $2",
        [f.serviceB, f.barberB],
      );
      expect(check.rows[0]).toEqual({ price: 30000, status: "off" });
    });
  });

  it("REQ-031.4 dueño del negocio A no puede tocar el negocio B", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.ownerA);

      const seen = await q<{ id: string }>("select id from businesses");
      expect(seen.rows.map((r) => r.id)).toEqual([f.businessA]);

      const upd = await q("update businesses set name = 'Hackeada' where id = $1", [f.businessB]);
      expect(upd.rowCount).toBe(0);

      await expectSqlError(
        q,
        "insert into products (business_id, name, price) values ($1, 'Helado', 3000)",
        [f.businessB],
        "42501",
      );

      await expectSqlError(
        q,
        "insert into invitations (business_id, barber_id) values ($1, $2)",
        [f.businessB, f.barberB],
        "42501",
      );
    });
  });

  it("REQ-010.1 / REQ-025.1 barbero solo puede cambiar su estado, no su comisión", async () => {
    await withTx(async (q) => {
      const f = await seedTwoBusinesses(q);
      await loginAs(q, USERS.barberA);

      const ok = await q("update barbers set status = 'available' where id = $1", [f.barberA]);
      expect(ok.rowCount).toBe(1);

      await expectSqlError(
        q,
        "update barbers set commission_pct = 99 where id = $1",
        [f.barberA],
        "42501",
      );
    });
  });

  it("NFR-004 anon no tiene acceso a ninguna tabla", async () => {
    await withTx(async (q) => {
      await loginAs(q, null, "anon");
      await expectSqlError(q, "select count(*) from businesses", [], "42501");
      await expectSqlError(q, "select count(*) from barbers", [], "42501");
    });
  });
});
