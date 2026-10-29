import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("NFR-009 pruebas trazables", () => {
  it("NFR-009 cada criterio de aceptación del MVP tiene al menos una prueba (matriz sin huecos)", () => {
    for (const hito of ["0", "1", "2", "3", "4"]) {
      const out = execFileSync(
        "node_modules/.bin/tsx",
        ["scripts/traceability.ts", "--check", `--hito=${hito}`],
        { encoding: "utf8" },
      );
      expect(out).toContain(`0 sin prueba en el hito ${hito}`);
    }
  }, 60_000);
});
