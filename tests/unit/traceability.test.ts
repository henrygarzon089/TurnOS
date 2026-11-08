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
      "15",
      "16",
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
