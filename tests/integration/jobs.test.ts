import { afterAll, describe, expect, it } from "vitest";
import { submitJobApplication } from "@/lib/jobs/submit";
import type { JobApplication } from "@/lib/domain/jobs";
import { loginAs, pool, withTx } from "./db";
import { seedTwoBusinesses } from "./fixtures";
import { createPgGateway } from "./pg-gateway";

afterAll(() => pool.end());

const app: JobApplication = {
  name: "Camilo Ruiz",
  phoneE164: "+573001110101",
  role: "estilista",
  years: 4,
  portfolioUrl: "https://instagram.com/camilo",
  availability: "medio_tiempo",
  message: null,
};

describe("REQ-102 envío desde la web", () => {
  it("REQ-102.4 guarda la postulación y REQ-102.5 el mismo celular no se duplica", async () => {
    await withTx(async (q) => {
      await seedTwoBusinesses(q);
      await loginAs(q, null, "service_role");
      const gw = createPgGateway(q);
      expect(await submitJobApplication(gw, "barberia-a", app, "1", "10.1.1.1")).toEqual({ ok: true });
      expect(await submitJobApplication(gw, "barberia-a", { ...app, years: 5 }, "1", "10.1.1.2")).toEqual({
        ok: true,
      });
      const r = await q<{ n: number; years: number }>(
        "select count(*)::int as n, max(years_experience)::int as years from job_applications where phone_e164 = $1",
        [app.phoneE164],
      );
      expect(r.rows[0]).toEqual({ n: 1, years: 5 });
    });
  });

  it("REQ-102.5 al pasar el límite responde con un mensaje claro", async () => {
    await withTx(async (q) => {
      await seedTwoBusinesses(q);
      await loginAs(q, null, "service_role");
      const gw = createPgGateway(q);
      for (let i = 0; i < 3; i++) await submitJobApplication(gw, "barberia-a", app, "1", `10.2.0.${i}`);
      const r = await submitJobApplication(gw, "barberia-a", app, "1", "10.2.0.9");
      expect(r).toEqual({ ok: false, error: expect.stringMatching(/Intenta mañana/) });
    });
  });

  it("REQ-102.4 un dato que la base rechaza no se guarda", async () => {
    await withTx(async (q) => {
      await seedTwoBusinesses(q);
      await loginAs(q, null, "service_role");
      const r = await submitJobApplication(createPgGateway(q), "barberia-a", { ...app, portfolioUrl: "http://x" }, "1", null);
      expect(r).toEqual({ ok: false, error: "Revisa los datos e intenta otra vez." });
    });
  });
});
