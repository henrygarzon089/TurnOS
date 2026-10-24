import { Pool } from "pg";

/**
 * Conexión a la base local de pruebas (scripts/db-local.sh). Cada prueba de integración abre una
 * transacción, simula un usuario con auth.test_login() y hace rollback al final.
 */
export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/turnos",
  max: 4,
});

export async function withTx<T>(fn: (q: Q) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const q = (async (text: string, params?: unknown[]) => {
      const r = await client.query(text, params as never[]);
      return { rows: r.rows, rowCount: r.rowCount };
    }) as Q;
    const result = await fn(q);
    await client.query("rollback");
    return result;
  } catch (e) {
    await client.query("rollback").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

export type Q = <R = Record<string, unknown>>(
  text: string,
  params?: unknown[],
) => Promise<{ rows: R[]; rowCount: number | null }>;

/** Actúa como un usuario autenticado (o anon / service_role) dentro de la transacción. */
export async function loginAs(q: Q, userId: string | null, role = "authenticated") {
  await q("select auth.test_login($1::uuid, $2)", [userId, role]);
}
