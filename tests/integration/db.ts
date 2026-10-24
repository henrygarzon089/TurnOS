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

/**
 * Ejecuta una consulta que DEBE fallar con el código SQLSTATE dado, sin abortar la transacción
 * de la prueba (usa un savepoint).
 */
export async function expectSqlError(q: Q, text: string, params: unknown[], code: string) {
  await q("savepoint expect_fail");
  try {
    await q(text, params);
  } catch (e) {
    await q("rollback to savepoint expect_fail");
    const err = e as { code?: string; message?: string };
    if (err.code !== code) {
      throw new Error(`Se esperaba SQLSTATE ${code}, llegó ${err.code}: ${err.message}`);
    }
    return;
  }
  await q("release savepoint expect_fail");
  throw new Error(`Se esperaba un error ${code} y la consulta tuvo éxito: ${text}`);
}
