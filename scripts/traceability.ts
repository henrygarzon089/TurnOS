/**
 * Matriz de trazabilidad REQ → tareas → pruebas → estado (design.md §8, tasks.md "Validación").
 *
 * - Lee specs/requirements.md para listar los REQ-NNN.n (criterios de aceptación).
 * - Lee specs/tasks.md para saber qué tareas citan cada REQ y su estado ([ ], [~], [x]).
 * - Busca en tests/ y supabase/tests/ los nombres de prueba que citan cada CA.
 * - Escribe specs/traceability.md.
 * - Con --hito=N falla (exit 1) si algún CA de los REQ de ese hito no tiene prueba.
 *
 * Uso: pnpm tsx scripts/traceability.ts [--hito=1]
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const HITOS: Record<string, [number, number][]> = {
  "0": [
    [15, 17],
    [30, 34],
  ],
  "1": [
    [1, 14],
    [33, 33],
  ],
  "2": [[18, 22]],
  "3": [[23, 29]],
};

const req = readFileSync("specs/requirements.md", "utf8");
const tasks = readFileSync("specs/tasks.md", "utf8");

// Criterios: líneas "- REQ-003.5 ..." dentro de requirements.md
const criteria = [...req.matchAll(/^- (REQ-\d{3}\.\d+) /gm)].map((m) => m[1]);
const reqTitles = Object.fromEntries(
  [...req.matchAll(/^### (REQ-\d{3}) · (.+?) — [MD]$/gm)].map((m) => [m[1], m[2]]),
);

// Tareas: bloques "### [x] T-001 · ..." con sus líneas "- REQ: ..."
type Task = { id: string; status: string; reqs: Set<string> };
const taskBlocks = tasks.split(/^### /m).slice(1);
const taskList: Task[] = taskBlocks.map((b) => {
  const head = b.match(/^\[(.)\] (T-\d{3})/);
  const reqs = new Set<string>();
  const reqLine = b.match(/^- REQ: (.+)$/m)?.[1] ?? "";
  for (const m of reqLine.matchAll(/REQ-(\d{3})(?:\.(\d+))?(?:–(\d+)\.(\d+)|–(\d+))?/g)) {
    const base = m[1];
    reqs.add(`REQ-${base}`);
    if (m[2] && m[3] && m[4]) {
      for (let i = Number(m[2]); i <= Number(m[4]); i++) reqs.add(`REQ-${base}.${i}`);
    } else if (m[2] && m[5]) {
      for (let i = Number(m[2]); i <= Number(m[5]); i++) reqs.add(`REQ-${base}.${i}`);
    } else if (m[2]) {
      reqs.add(`REQ-${base}.${m[2]}`);
    }
  }
  return { id: head?.[2] ?? "?", status: head?.[1] ?? " ", reqs };
});

// Pruebas: cualquier archivo bajo tests/ o supabase/tests/ que mencione el CA
const testFiles: string[] = [];
function walk(dir: string) {
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) walk(f);
    else if (/\.(ts|sql)$/.test(e)) testFiles.push(f);
  }
}
walk("tests");
walk("supabase/tests");
const testIndex = new Map<string, Set<string>>();
for (const f of testFiles) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(/REQ-\d{3}(?:\.\d+)?/g)) {
    if (!testIndex.has(m[0])) testIndex.set(m[0], new Set());
    testIndex.get(m[0])!.add(f);
  }
}

const statusLabel: Record<string, string> = { " ": "pendiente", "~": "en curso", x: "hecha" };
const rows: string[] = [];
const missing: string[] = [];
const hitoArg = process.argv.find((a) => a.startsWith("--hito="))?.split("=")[1];
/** --check: solo verifica (no reescribe specs/traceability.md); lo usa la prueba de NFR-009. */
const checkOnly = process.argv.includes("--check");
const inHito = (reqNum: number) =>
  !hitoArg || (HITOS[hitoArg] ?? []).some(([a, b]) => reqNum >= a && reqNum <= b);

for (const ca of criteria) {
  const reqId = ca.split(".")[0];
  const reqNum = Number(reqId.slice(4));
  const tasksFor = taskList.filter((t) => t.reqs.has(reqId) || t.reqs.has(ca));
  const tests = [...(testIndex.get(ca) ?? [])];
  const done = tasksFor.length > 0 && tasksFor.every((t) => t.status === "x");
  const state = tests.length === 0 ? "sin prueba" : done ? "cubierto" : "prueba escrita";
  if (tests.length === 0 && inHito(reqNum)) missing.push(ca);
  rows.push(
    `| ${ca} | ${reqTitles[reqId] ?? ""} | ${tasksFor.map((t) => `${t.id} (${statusLabel[t.status]})`).join(", ") || "—"} | ${
      tests.map((t) => t.replace(/^.*\//, "")).join(", ") || "—"
    } | ${state} |`,
  );
}

const out = `# Matriz de trazabilidad

> Generada por \`scripts/traceability.ts\` el ${new Date().toISOString().slice(0, 10)}.
> Estado: **cubierto** = tareas hechas y prueba existente · **prueba escrita** = prueba existe, tarea sin cerrar · **sin prueba** = falta.

| CA | Requisito | Tareas | Pruebas | Estado |
|---|---|---|---|---|
${rows.join("\n")}
`;
if (!checkOnly) writeFileSync("specs/traceability.md", out);
console.log(
  `traceability: ${criteria.length} criterios, ${missing.length} sin prueba${hitoArg ? ` en el hito ${hitoArg}` : ""}.`,
);
if (hitoArg && missing.length) {
  console.error(missing.join("\n"));
  process.exit(1);
}
