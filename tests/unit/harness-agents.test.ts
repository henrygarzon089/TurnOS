import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Frontmatter simple (`clave: valor`) de un archivo de agente o skill. */
function frontmatter(file: string) {
  const text = readFileSync(file, "utf8");
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  expect(m, `${file} sin frontmatter`).not.toBeNull();
  const fields = Object.fromEntries(
    m![1].split("\n").map((l) => {
      const i = l.indexOf(":");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
  );
  return { fields, body: m![2] };
}

const WRITERS = ["Edit", "Write", "MultiEdit", "NotebookEdit"];
const agent = (name: string) => frontmatter(`.claude/agents/${name}.md`);
const skill = (name: string) => frontmatter(`.claude/skills/${name}/SKILL.md`);

describe("Hito 22 · subagentes (T-254)", () => {
  it("REQ-094.1 revisor-spec compara el diff con REQ, CA, design y la tarea", () => {
    const { fields, body } = agent("revisor-spec");
    expect(fields.name).toBe("revisor-spec");
    expect(body).toMatch(/git diff/);
    expect(body).toMatch(/requirements\.md/);
    expect(body).toMatch(/design\.md/);
    expect(body).toMatch(/tasks\.md/);
  });

  it("REQ-094.2 escritor-pruebas nombra cada prueba con su CA y no toca la app", () => {
    const { fields, body } = agent("escritor-pruebas");
    expect(fields.tools).toMatch(/Write/);
    expect(body).toMatch(/it\('REQ-NNN\.n/);
    expect(body).toMatch(/pgTAP/);
    expect(body).toMatch(/no (toques|modifiques) .*src\//i);
  });

  it("REQ-094.3 revisor-sql revisa las reglas multi-tenant y pide pgTAP", () => {
    const { body } = agent("revisor-sql");
    for (const rule of [
      "business_id",
      "RLS",
      "anon",
      "security definer",
      "search_path",
      "integer",
      "business_day_bogota",
      "pgTAP",
    ]) {
      expect(body, rule).toContain(rule);
    }
  });

  it("REQ-094.4 revisor-textos revisa español colombiano sin inglés", () => {
    const { body } = agent("revisor-textos");
    expect(body).toMatch(/español colombiano/);
    expect(body).toMatch(/inglés/);
    expect(body).toMatch(/lint:texts/);
  });

  it("REQ-094.5 cada subagente declara nombre, descripción, herramientas y modelo; los revisores no escriben", () => {
    for (const name of ["revisor-spec", "escritor-pruebas", "revisor-sql", "revisor-textos"]) {
      const { fields } = agent(name);
      expect(fields.name, name).toBe(name);
      expect(fields.description?.length ?? 0, name).toBeGreaterThan(40);
      expect(fields.tools, name).toBeTruthy();
      expect(fields.model, name).toMatch(/^(opus|sonnet|haiku|inherit)$/);
      if (name.startsWith("revisor")) {
        const tools = fields.tools.split(",").map((t: string) => t.trim());
        for (const w of WRITERS) expect(tools, `${name} no debe tener ${w}`).not.toContain(w);
      }
    }
  });
});

describe("Hito 22 · comandos del método (T-255)", () => {
  it("REQ-095.1 /tarea guía la tarea completa en el orden del método", () => {
    const { fields, body } = skill("tarea");
    expect(fields.name).toBe("tarea");
    const steps = [
      /siguiente en orden/i,
      /pruebas primero|primero las pruebas/i,
      /puerta de calidad/i,
      /\[x\]/,
      /T-NNN: /,
      /celular/,
    ];
    let last = -1;
    for (const step of steps) {
      const at = body.search(step);
      expect(at, String(step)).toBeGreaterThan(last);
      last = at;
    }
  });

  it("REQ-095.2 /cerrar-hito corre la matriz, pone el estado al día y no aprueba", () => {
    const { fields, body } = skill("cerrar-hito");
    expect(fields.name).toBe("cerrar-hito");
    expect(body).toMatch(/pnpm trace --hito=/);
    expect(body).toMatch(/docs\/estado-del-proyecto\.md/);
    expect(body).toMatch(/guía de prueba/i);
    expect(body).toMatch(/no apruebas el hito|solo Henry aprueba/i);
  });

  it("REQ-095.3 /nuevo-req redacta una propuesta con números libres y se detiene", () => {
    const { fields, body } = skill("nuevo-req");
    expect(fields.name).toBe("nuevo-req");
    expect(body).toMatch(/pnpm next-ids/);
    expect(body).toMatch(/propuesta/i);
    expect(body).toMatch(/detente|espera la aprobación/i);
    expect(existsSync(".claude/skills/nuevo-req/SKILL.md")).toBe(true);
  });
});
