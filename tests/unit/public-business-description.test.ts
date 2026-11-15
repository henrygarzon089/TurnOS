import { describe, expect, it } from "vitest";
import type { Gateway } from "@/lib/db/gateway";
import { getPublicBusiness } from "@/lib/queue/public-queue";

/**
 * T-263 · la descripción llega de `get_public_business` hasta la portada y la tarjeta
 * (REQ-097.3, REQ-096.4). El mapeo arma el negocio campo por campo: sin esto se perdía.
 */
const gw = (raw: Record<string, unknown>) => ({ rpc: async () => raw }) as unknown as Gateway;

const RAW = {
  id: "biz-1",
  name: "Gamma Club",
  slug: "gamma-club",
  queue: { barbers: [], waiting: [] },
  services: [
    { id: "s1", name: "Corte", durationMin: 30, price: 25000, description: "Máquina y tijera" },
  ],
};

describe("getPublicBusiness · descripciones", () => {
  it("REQ-097.3 pasa la descripción del negocio a la portada", async () => {
    const biz = await getPublicBusiness(
      gw({ ...RAW, description: "Barbería de barrio" }),
      "gamma-club",
    );
    expect(biz?.description).toBe("Barbería de barrio");
  });

  it("REQ-097.4 sin descripción del negocio, llega null", async () => {
    const biz = await getPublicBusiness(gw({ ...RAW, description: null }), "gamma-club");
    expect(biz?.description).toBeNull();
    expect((await getPublicBusiness(gw(RAW), "gamma-club"))?.description).toBeNull();
  });

  it("REQ-096.4 pasa la descripción de cada servicio a la tarjeta", async () => {
    const biz = await getPublicBusiness(gw(RAW), "gamma-club");
    expect(biz?.services[0]?.description).toBe("Máquina y tijera");
  });
});
