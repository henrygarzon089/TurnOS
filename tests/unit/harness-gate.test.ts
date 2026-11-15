import { describe, expect, it } from "vitest";
import {
  firstOpenTask,
  gateCommands,
  gateReport,
  gateScope,
  sessionSummary,
} from "../../.claude/hooks/lib.mjs";

const porcelain = (...lines: string[]) => lines.join("\n");

describe("Hito 22 · puerta de calidad (T-253)", () => {
  it("REQ-093.1 corre con cambios de código sin commit y lista los archivos", () => {
    const r = gateScope(
      porcelain(
        " M src/app/page.tsx",
        "?? tests/unit/nuevo.test.ts",
        "R  scripts/a.ts -> scripts/b.ts",
        " D src/viejo.ts",
      ),
      {},
    );
    expect(r.run).toBe(true);
    expect(r.files).toEqual(["src/app/page.tsx", "tests/unit/nuevo.test.ts", "scripts/b.ts"]);
  });

  it("REQ-093.1 corre typecheck, lint:texts, lint:design y las pruebas relacionadas", () => {
    const cmds = gateCommands(["src/app/page.tsx", "supabase/migrations/0076_x.sql"]);
    expect(cmds.map((c) => c.name)).toEqual(["typecheck", "lint:texts", "lint:design", "pruebas"]);
    const tests = cmds.find((c) => c.name === "pruebas")!;
    expect(tests.args).toContain("related");
    expect(tests.args).toContain("src/app/page.tsx");
    expect(tests.args).not.toContain("supabase/migrations/0076_x.sql");
    expect(gateCommands(["supabase/migrations/0076_x.sql"]).map((c) => c.name)).toEqual([
      "typecheck",
      "lint:texts",
      "lint:design",
    ]);
  });

  it("REQ-093.1 devuelve el error al agente con el comando y el final de la salida", () => {
    const long = Array.from({ length: 100 }, (_, i) => `línea ${i}`).join("\n");
    const report = gateReport([
      { name: "typecheck", ok: false, output: long },
      { name: "lint:texts", ok: true, output: "bien" },
    ]);
    expect(report).toMatch(/typecheck/);
    expect(report).toMatch(/línea 99/);
    expect(report).not.toMatch(/línea 10\n/);
    expect(report).not.toMatch(/lint:texts/);
    expect(gateReport([{ name: "typecheck", ok: true, output: "" }])).toBe("");
  });

  it("REQ-093.2 no corre si solo cambiaron documentos", () => {
    const r = gateScope(
      porcelain(
        " M docs/estado-del-proyecto.md",
        " M specs/tasks.md",
        " M CLAUDE.md",
        "?? scripts/LEEME.md",
      ),
      {},
    );
    expect(r.run).toBe(false);
    expect(gateScope("", {}).run).toBe(false);
  });

  it("REQ-093.3 no bloquea dos veces seguidas el mismo cierre", () => {
    const r = gateScope(" M src/app/page.tsx", { stopHookActive: true });
    expect(r.run).toBe(false);
    expect(r.why).toMatch(/segunda/);
  });

  it("REQ-093.4 se apaga con TURNOS_GATE=off", () => {
    expect(gateScope(" M src/app/page.tsx", { gate: "off" }).run).toBe(false);
    expect(gateScope(" M src/app/page.tsx", { gate: "on" }).run).toBe(true);
  });
});

describe("Hito 22 · contexto al iniciar (T-252)", () => {
  const tasks = [
    "## Hito 19 — Citas",
    "### [ ] T-211 · Henry configura Citas",
    "## Hito 20 — Cliente con fotos",
    "### [x] T-220 · Datos",
    "### [ ] T-228 · Validación Hito 20",
    "### [ ] T-229 · Otra",
    "---",
    "## Dependencias principales",
    "### [ ] T-999 · no es de un hito",
  ].join("\n");

  it("encuentra la primera tarea abierta del último hito", () => {
    expect(firstOpenTask(tasks)).toEqual({
      hito: "Hito 20 — Cliente con fotos",
      task: "T-228 · Validación Hito 20",
    });
    expect(firstOpenTask("## Hito 1\n### [x] T-001 · listo")).toBeNull();
  });

  it("resume rama, atraso, cambios y tarea, y avisa si es main", () => {
    const s = sessionSummary({ branch: "main", behind: 3, dirty: 2, tasksMd: tasks });
    expect(s).toMatch(/main/);
    expect(s).toMatch(/crea una rama/);
    expect(s).toMatch(/3 commits detrás/);
    expect(s).toMatch(/2 archivos sin commit/);
    expect(s).toMatch(/T-228/);
    expect(s).toMatch(/pnpm next-ids/);
    expect(s.split("\n").length).toBeLessThanOrEqual(15);
    const clean = sessionSummary({ branch: "claude/x", behind: 0, dirty: 0, tasksMd: tasks });
    expect(clean).not.toMatch(/crea una rama|detrás|sin commit/);
  });
});
