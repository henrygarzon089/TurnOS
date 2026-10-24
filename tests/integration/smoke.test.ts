import { afterAll, describe, expect, it } from "vitest";
import { pool, withTx } from "./db";

afterAll(() => pool.end());

describe("T-002 base local", () => {
  it("responde y tiene el shim de Supabase", async () => {
    await withTx(async (q) => {
      const { rows } = await q<{ ok: boolean }>("select auth.uid() is null as ok");
      expect(rows[0].ok).toBe(true);
    });
  });

  it("auth.test_login simula al usuario para RLS", async () => {
    await withTx(async (q) => {
      const id = "11111111-1111-1111-1111-111111111111";
      await q("select auth.test_login($1::uuid)", [id]);
      const { rows } = await q<{ uid: string; role: string }>(
        "select auth.uid()::text as uid, current_user as role",
      );
      expect(rows[0]).toEqual({ uid: id, role: "authenticated" });
    });
  });
});
