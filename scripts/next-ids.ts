/**
 * pnpm next-ids — siguiente REQ, ADR, tarea y migración libres (REQ-095.4, ADR-066).
 *
 * Mira `main`, todas las ramas remotas, la rama actual y el árbol de trabajo, para que dos ramas
 * en paralelo no tomen el mismo número. Con `--fetch` trae primero las ramas de origin.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

export type Snapshot = {
  ref: string;
  requirements: string;
  decisions: string;
  tasks: string;
  migrations: string[];
};

type Found = { n: number; ref: string };

function maxOf(snaps: Snapshot[], pick: (s: Snapshot) => number[]): Found {
  let best: Found = { n: 0, ref: "—" };
  for (const s of snaps) for (const n of pick(s)) if (n > best.n) best = { n, ref: s.ref };
  return best;
}

const nums = (text: string, re: RegExp) => [...text.matchAll(re)].map((m) => Number(m[1]));
const pad = (n: number, width: number) => String(n).padStart(width, "0");

export function nextIds(snaps: Snapshot[]) {
  const req = maxOf(snaps, (s) => nums(s.requirements, /^### REQ-(\d{3})\b/gm));
  const adr = maxOf(snaps, (s) => nums(s.decisions, /^## ADR-(\d{3})\b/gm));
  const task = maxOf(snaps, (s) => nums(s.tasks, /^### \[[ x]\] T-(\d{3})\b/gm));
  const mig = maxOf(snaps, (s) =>
    s.migrations.flatMap((f) => {
      const m = f.match(/^(\d{4})_.*\.sql$/);
      return m ? [Number(m[1])] : [];
    }),
  );
  return {
    req: { next: `REQ-${pad(req.n + 1, 3)}`, lastRef: req.ref },
    adr: { next: `ADR-${pad(adr.n + 1, 3)}`, lastRef: adr.ref },
    task: {
      next: `T-${pad(task.n + 1, 3)}`,
      block: `T-${pad(Math.ceil((task.n + 1) / 10) * 10, 3)}`,
      lastRef: task.ref,
    },
    migration: { next: pad(mig.n + 1, 4), lastRef: mig.ref },
  };
}

function git(args: string[]) {
  try {
    return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
  } catch {
    return "";
  }
}

function fromRef(ref: string): Snapshot {
  const show = (p: string) => git(["show", `${ref}:${p}`]);
  return {
    ref,
    requirements: show("specs/requirements.md"),
    decisions: show("specs/decisions.md"),
    tasks: show("specs/tasks.md"),
    migrations: git(["ls-tree", "--name-only", ref, "supabase/migrations/"])
      .split("\n")
      .map((p) => p.split("/").pop() ?? ""),
  };
}

function fromWorkingTree(): Snapshot {
  const read = (p: string) => (existsSync(p) ? readFileSync(p, "utf8") : "");
  return {
    ref: "árbol de trabajo",
    requirements: read("specs/requirements.md"),
    decisions: read("specs/decisions.md"),
    tasks: read("specs/tasks.md"),
    migrations: existsSync("supabase/migrations") ? readdirSync("supabase/migrations") : [],
  };
}

function main() {
  if (process.argv.includes("--fetch")) git(["fetch", "--quiet", "--prune", "origin"]);
  const refs = new Set(
    git(["for-each-ref", "--format=%(refname:short)", "refs/remotes/origin"])
      .split("\n")
      .filter((r) => r && r !== "origin" && r !== "origin/HEAD"),
  );
  refs.add("HEAD");
  const snaps = [...refs].map(fromRef).concat(fromWorkingTree());
  const ids = nextIds(snaps);
  console.log(`Números libres (${refs.size} ramas + árbol de trabajo):`);
  console.log(`  REQ        ${ids.req.next}   (el último está en ${ids.req.lastRef})`);
  console.log(`  ADR        ${ids.adr.next}   (${ids.adr.lastRef})`);
  console.log(
    `  Tarea      ${ids.task.next}     (${ids.task.lastRef}); para un hito nuevo, bloque ${ids.task.block}`,
  );
  console.log(`  Migración  ${ids.migration.next}      (${ids.migration.lastRef})`);
  if (!process.argv.includes("--fetch")) {
    console.log("Usa --fetch para traer antes las ramas nuevas de origin.");
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) main();
