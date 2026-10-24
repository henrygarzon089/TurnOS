import { describe, expect, it } from "vitest";

describe("T-001 humo", () => {
  it("Vitest corre con alias @/ y entorno node", async () => {
    const mod = await import("@/lib/version");
    expect(mod.APP_NAME).toBe("TurnOS");
  });
});
