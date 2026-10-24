import { afterAll, describe, expect, it } from "vitest";
import { getPreferredBarber } from "@/lib/queue/public-queue";
import { pool, withTx, type Q } from "./db";
import { createPgGateway } from "./pg-gateway";

afterAll(() => pool.end());

/** Mateo Londoño (+573002000005) tiene a Juan como preferido en el seed. */
async function setup(q: Q, juanStatus: "available" | "paused" | "off") {
  const { rows } = await q<{ biz: string; juan: string }>(
    `select z.id as biz, (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan
     from businesses z where z.slug = 'la-33'`,
  );
  const c = rows[0];
  await q(
    `update customers set preferred_barber_id = $2 where business_id = $1 and phone_e164 = '+573002000005'`,
    [c.biz, c.juan],
  );
  await q(`update barbers set status = $2, present_day = current_date where id = $1`, [
    c.juan,
    juanStatus,
  ]);
  return c;
}

describe("REQ-022.1 barbero preferido preseleccionado", () => {
  it("REQ-022.1 devuelve el preferido del cliente que vuelve si está disponible hoy", async () => {
    await withTx(async (q) => {
      const c = await setup(q, "available");
      const gw = createPgGateway(q);
      expect(await getPreferredBarber(gw, "la-33", "300 200 0005")).toBe(c.juan);
      expect(await getPreferredBarber(gw, "la-33", "+573002000005")).toBe(c.juan);
    });
  });

  it("REQ-022.1 si el preferido está en pausa o no vino, no preselecciona ('El que esté libre')", async () => {
    await withTx(async (q) => {
      await setup(q, "paused");
      const gw = createPgGateway(q);
      expect(await getPreferredBarber(gw, "la-33", "300 200 0005")).toBeNull();
      await setup(q, "off");
      expect(await getPreferredBarber(gw, "la-33", "300 200 0005")).toBeNull();
    });
  });

  it("REQ-022.1 celular desconocido, inválido, eliminado u otro negocio → null (sin exponer datos)", async () => {
    await withTx(async (q) => {
      await setup(q, "available");
      const gw = createPgGateway(q);
      expect(await getPreferredBarber(gw, "la-33", "300 999 9999")).toBeNull();
      expect(await getPreferredBarber(gw, "la-33", "123")).toBeNull();
      expect(await getPreferredBarber(gw, "no-existe", "300 200 0005")).toBeNull();
      await q(`select anonymize_customer(id) from customers where phone_e164 = '+573002000005'`);
      expect(await getPreferredBarber(gw, "la-33", "300 200 0005")).toBeNull();
    });
  });
});
