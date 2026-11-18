import { execFileSync, spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("NFR-009 pruebas trazables", () => {
  it("NFR-009 cada criterio de aceptación del MVP tiene al menos una prueba (matriz sin huecos)", () => {
    for (const hito of [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "11",
      "12",
      "13",
      "14",
      "15",
      "16", // T-168: REQ-078 completo, con T-169…T-183 (ADR-051, ADR-052, ADR-053)
      "17", // T-191: REQ-079 y REQ-080 completos, con T-184…T-190 (ADR-055)
      "18", // T-203: REQ-082 y REQ-083 completos, con T-200…T-202 (ADR-060, ADR-061)
      "22", // T-256: REQ-092…REQ-095 completos, con T-250…T-255 (ADR-066)
      "25", // T-283: REQ-099 completo, con T-280…T-282 (ADR-073)
      "26", // T-294: REQ-100 completo, con T-290…T-293 (ADR-076)
    ]) {
      const out = execFileSync(
        "node_modules/.bin/tsx",
        ["scripts/traceability.ts", "--check", `--hito=${hito}`],
        { encoding: "utf8" },
      );
      expect(out).toContain(`0 sin prueba en el hito ${hito}`);
    }
  }, 60_000);

  it("NFR-009 un hito que no está en HITOS falla en vez de pasar sin revisar nada", () => {
    const res = spawnSync(
      "node_modules/.bin/tsx",
      ["scripts/traceability.ts", "--check", "--hito=99"],
      { encoding: "utf8" },
    );
    expect(res.status).toBe(1);
    expect(res.stderr).toContain("hito 99 no existe");
  }, 30_000);
});
