import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { pool } from "./db";

/**
 * REQ-007.2: dos barberos tocan "Llamar al siguiente" sobre el mismo turno de "el que esté
 * libre" al mismo tiempo. Solo uno lo obtiene; el otro recibe el siguiente. Necesita dos
 * conexiones reales (no cabe en pgTAP), por eso escribe datos y los limpia al final.
 */
const BIZ_SLUG = "la-33";
const PHONES = ["+573009990101", "+573009990102"];

async function ctx() {
  const { rows } = await pool.query<{
    biz: string;
    corte: string;
    juan: string;
    juan_u: string;
    pedro: string;
    pedro_u: string;
  }>(
    `select z.id as biz,
            (select id from services s where s.business_id = z.id and s.name = 'Corte') as corte,
            (select id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan,
            (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Juan') as juan_u,
            (select id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro,
            (select user_id from barbers b where b.business_id = z.id and b.display_name = 'Pedro') as pedro_u
     from businesses z where z.slug = $1`,
    [BIZ_SLUG],
  );
  return rows[0];
}

async function cleanup() {
  await pool.query(
    `delete from tickets where business_id = (select id from businesses where slug = $1)
       and customer_phone_e164 = any($2)`,
    [BIZ_SLUG, PHONES],
  );
}

describe("REQ-007.2 carrera entre barberos", () => {
  beforeEach(cleanup);
  afterEach(cleanup);
  afterAll(() => pool.end());

  it("dos call_next simultáneos obtienen turnos distintos", async () => {
    const c = await ctx();
    await pool.query(
      `update barbers set status = 'available', present_day = current_date where id in ($1, $2)`,
      [c.juan, c.pedro],
    );
    for (const [i, phone] of PHONES.entries()) {
      await pool.query(
        `insert into tickets (business_id, customer_name, customer_phone_e164, service_id)
         values ($1, $2, $3, $4)`,
        [c.biz, `Carrera ${i + 1}`, phone, c.corte],
      );
    }

    const callAs = async (userId: string) => {
      const client = await pool.connect();
      try {
        await client.query("begin");
        await client.query("select auth.test_login($1::uuid)", [userId]);
        const r = await client.query<{ customer_name: string }>(
          "select customer_name from call_next()",
        );
        await client.query("commit");
        return r.rows[0].customer_name;
      } catch (e) {
        await client.query("rollback").catch(() => {});
        throw e;
      } finally {
        client.release();
      }
    };

    const [a, b] = await Promise.all([callAs(c.juan_u), callAs(c.pedro_u)]);
    expect(new Set([a, b])).toEqual(new Set(["Carrera 1", "Carrera 2"]));

    // Deshacer: devolver barberos y cerrar los turnos
    await pool.query(
      `update tickets set status = 'cancelled', cancel_reason = 'business', finished_at = now()
       where customer_phone_e164 = any($1)`,
      [PHONES],
    );
    await pool.query(`update barbers set status = 'off', present_day = null where id in ($1, $2)`, [
      c.juan,
      c.pedro,
    ]);
  });
});
