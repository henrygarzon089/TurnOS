import { describe, expect, it } from "vitest";
import { nextIds } from "../../scripts/next-ids";

const snap = (
  o: Partial<{
    ref: string;
    requirements: string;
    decisions: string;
    tasks: string;
    migrations: string[];
  }>,
) => ({
  ref: "origin/main",
  requirements: "",
  decisions: "",
  tasks: "",
  migrations: [],
  ...o,
});

describe("Hito 22 · números libres (T-255)", () => {
  it("REQ-095.4 toma el mayor número de main y de todas las ramas", () => {
    const ids = nextIds([
      snap({
        requirements: "### REQ-090 · Fotos\n- REQ-090.1 …",
        decisions: "## ADR-063 · Hito 20",
        tasks: "### [x] T-228 · Validación\n### [ ] T-229 · Otra",
        migrations: ["0074_brand_images.sql", "0075_x.sql", "README.md"],
      }),
      snap({
        ref: "origin/claude/marca-gamma",
        requirements: "### REQ-091 · Marca",
        decisions: "## ADR-065 · Marca",
        tasks: "### [ ] T-245 · Validación",
      }),
      snap({
        ref: "origin/claude/servicios",
        decisions: "## ADR-064 · Fresha",
        migrations: ["0076_y.sql"],
      }),
    ]);
    expect(ids.req).toEqual({ next: "REQ-092", lastRef: "origin/claude/marca-gamma" });
    expect(ids.adr).toEqual({ next: "ADR-066", lastRef: "origin/claude/marca-gamma" });
    expect(ids.task.next).toBe("T-246");
    expect(ids.task.block).toBe("T-250");
    expect(ids.migration).toEqual({ next: "0077", lastRef: "origin/claude/servicios" });
  });

  it("REQ-095.4 no se confunde con menciones sueltas dentro del texto", () => {
    const ids = nextIds([
      snap({
        requirements: "### REQ-010 · X\nVer REQ-999 (borrador)",
        decisions: "## ADR-005 · X\n(reemplaza ADR-900)",
        tasks: "### [x] T-010 · X\n- depende de T-900",
      }),
    ]);
    expect(ids.req.next).toBe("REQ-011");
    expect(ids.adr.next).toBe("ADR-006");
    expect(ids.task.next).toBe("T-011");
    expect(ids.migration.next).toBe("0001");
  });
});
