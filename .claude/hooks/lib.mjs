// Harness de los agentes (Hito 22, ADR-066, design §28).
// Funciones puras: deciden, no ejecutan. Los scripts `guard-*.mjs`, `session.mjs` y `gate.mjs`
// leen el evento de Claude Code, llaman aquí y responden. Sin dependencias: Node 22.

/** @typedef {{ decision: "allow" | "deny" | "ask", reason?: string }} Verdict */

/** Proyecto de Supabase de producción (público en CLAUDE.md). */
export const PROD_SUPABASE_PROJECT = "uucjmxdssnmvznibrafc";

const ALLOW = /** @type {Verdict} */ ({ decision: "allow" });
const deny = (/** @type {string} */ reason) =>
  /** @type {Verdict} */ ({ decision: "deny", reason });
const ask = (/** @type {string} */ reason) => /** @type {Verdict} */ ({ decision: "ask", reason });

/** Elige la decisión más fuerte: bloquear > preguntar > dejar pasar. */
function strongest(/** @type {Verdict[]} */ verdicts) {
  return (
    verdicts.find((v) => v.decision === "deny") ??
    verdicts.find((v) => v.decision === "ask") ??
    ALLOW
  );
}

// ---------------------------------------------------------------------------------------------
// Mensajes de commit (REQ-092.1, REQ-092.2)

const COMMIT_PREFIX = /^(T-\d{3}\b|Hitos? \d|Spec\b|Estado\b|Cambio\b|Mezcla\b|Guía\b|ADR-\d{3}\b)/;
const ATTRIBUTION =
  /co-authored-by:[^\n]*(claude|anthropic)|generated (with|by) \[?claude|noreply@anthropic\.com/i;

/** @param {string} message */
export function checkCommitMessage(message) {
  const first = message.trimStart().split("\n")[0] ?? "";
  if (ATTRIBUTION.test(message)) {
    return {
      ok: false,
      reason:
        "Commit con atribución de IA (CLAUDE.md, Git) · quita la línea Co-Authored-By o 'Generated with' y vuelve a intentarlo",
    };
  }
  if (!COMMIT_PREFIX.test(first)) {
    return {
      ok: false,
      reason:
        "El mensaje del commit no sigue el método · empieza por T-NNN:, Hito N:, Spec:, Estado:, Cambio:, Mezcla, Guía o ADR-NNN:",
    };
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------------------------
// Partir un comando de shell (lo suficiente para revisar, no un parser completo)

/** Saca los heredocs y deja `<<__HEREDOC_n__` en su lugar. */
function extractHeredocs(/** @type {string} */ cmd) {
  /** @type {string[]} */
  const bodies = [];
  const lines = cmd.split("\n");
  /** @type {string[]} */
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = line.match(/<<-?\s*(['"]?)([A-Za-z_][\w]*)\1/);
    if (!m) {
      out.push(line);
      continue;
    }
    const delim = m[2];
    /** @type {string[]} */
    const body = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== delim) body.push(lines[j++]);
    out.push(line.replace(m[0], `<<__HEREDOC_${bodies.length}__`));
    bodies.push(body.join("\n"));
    i = j; // salta el delimitador de cierre
  }
  return { text: out.join("\n"), bodies };
}

/** Parte por `&&`, `||`, `;`, `|`, `&` y saltos de línea fuera de comillas y de `$( )`. */
function splitSegments(/** @type {string} */ text) {
  /** @type {string[]} */
  const segs = [];
  let cur = "";
  let quote = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quote) {
      if (c === "\\" && quote === '"') {
        cur += c + (text[++i] ?? "");
        continue;
      }
      if (c === quote) quote = "";
      else if (quote === '"' && c === "$" && text[i + 1] === "(") depth++;
      cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      cur += c;
      continue;
    }
    if (c === "$" && text[i + 1] === "(") {
      depth++;
      cur += c;
      continue;
    }
    if (c === ")" && depth > 0) {
      depth--;
      cur += c;
      continue;
    }
    if (depth === 0 && (c === ";" || c === "\n" || c === "|" || c === "&")) {
      if ((c === "|" || c === "&") && text[i + 1] === c) i++;
      segs.push(cur);
      cur = "";
      continue;
    }
    cur += c;
  }
  segs.push(cur);
  return segs.map((s) => s.trim()).filter(Boolean);
}

/** Palabras de un segmento, sin comillas. */
function tokenize(/** @type {string} */ seg) {
  /** @type {string[]} */
  const toks = [];
  let cur = "";
  let quote = "";
  let has = false;
  for (let i = 0; i < seg.length; i++) {
    const c = seg[i];
    if (quote) {
      if (c === quote) quote = "";
      else cur += c;
      continue;
    }
    if (c === "'" || c === '"') {
      quote = c;
      has = true;
      continue;
    }
    if (/\s/.test(c)) {
      if (has || cur) toks.push(cur);
      cur = "";
      has = false;
      continue;
    }
    cur += c;
    has = true;
  }
  if (has || cur) toks.push(cur);
  return toks;
}

/** Quita asignaciones de entorno y envoltorios (`sudo`, `npx`, `pnpm dlx`…). */
function unwrap(/** @type {string[]} */ toks) {
  let t = toks;
  for (;;) {
    if (t[0] && /^[A-Za-z_]\w*=/.test(t[0])) t = t.slice(1);
    else if (["sudo", "npx", "bunx", "command", "exec", "time"].includes(t[0])) t = t.slice(1);
    else if ((t[0] === "pnpm" || t[0] === "yarn") && ["dlx", "exec"].includes(t[1])) t = t.slice(2);
    else return t;
  }
}

// ---------------------------------------------------------------------------------------------
// Reglas por segmento

/** Separa `git [opciones globales] <sub> <args>`. */
function gitParts(/** @type {string[]} */ t) {
  let i = 1;
  while (i < t.length && t[i].startsWith("-")) {
    if (["-C", "-c", "--git-dir", "--work-tree"].includes(t[i])) i += 2;
    else i += 1;
  }
  return { sub: t[i], args: t.slice(i + 1) };
}

/**
 * @param {string[]} args
 * @param {string[]} bodies
 * @param {string} branch
 */
function checkGitCommit(args, bodies, branch) {
  if (branch === "main") {
    return deny(
      "No se hace commit en main · crea una rama (git switch -c claude/<tarea>) y haz el commit ahí",
    );
  }
  /** @type {string[]} */
  const messages = [];
  let fromFile = false;
  let noEdit = false;
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--no-edit") noEdit = true;
    if (a === "--all" || (/^-[A-Za-z]+$/.test(a) && a.includes("a"))) {
      return deny(
        "git commit -a mete todo lo modificado · agrega por rutas explícitas (git add <archivo>…) y haz el commit sin -a",
      );
    }
    const takesMessage =
      a === "-m" || a === "--message" || (/^-[A-Za-z]+$/.test(a) && a.endsWith("m"));
    if (takesMessage) messages.push(args[++i] ?? "");
    else if (a.startsWith("--message=")) messages.push(a.slice("--message=".length));
    else if (/^-[A-Za-z]*m./.test(a) && !a.startsWith("--"))
      messages.push(a.slice(a.indexOf("m") + 1));
    else if (a === "-F" || a === "--file" || a.startsWith("--file=") || a === "-C" || a === "-c") {
      if (a === "-F" || a === "--file") i++;
      fromFile = true;
    }
  }
  const resolved = messages.map((m) =>
    m.replace(/\$\(cat\s*<<__HEREDOC_(\d+)__\s*\)/g, (_, n) => bodies[Number(n)] ?? ""),
  );
  if (resolved.length === 0) {
    if (noEdit) return ALLOW;
    return ask(
      fromFile
        ? "No puedo leer el mensaje del commit en un archivo · confirma que empieza por T-NNN: y no lleva atribución de IA"
        : 'Commit sin -m: no puedo revisar el mensaje · usa git commit -m "T-NNN: …"',
    );
  }
  const check = checkCommitMessage(resolved.join("\n\n"));
  return check.ok ? ALLOW : deny(/** @type {string} */ (check.reason));
}

/** @param {string[]} args @param {string} branch */
function checkGitPush(args, branch) {
  const targets = args.filter((a) => !a.startsWith("-"));
  const toMain = targets.slice(1).some((r) => r === "main" || /(^|:)(refs\/heads\/)?main$/.test(r));
  if (branch === "main" || toMain) {
    return deny("No se empuja a main · empuja tu rama (git push -u origin <rama>) y abre un PR");
  }
  return ALLOW;
}

/** @param {string[]} args */
function checkGitAdd(args) {
  const all = args.some(
    (a) => a === "." || a === ":/" || a === "--all" || (/^-[A-Za-z]+$/.test(a) && a.includes("A")),
  );
  return all
    ? deny("El staging es por rutas explícitas (CLAUDE.md, Git) · usa git add <archivo> <archivo>…")
    : ALLOW;
}

const READERS = new Set([
  "cat",
  "less",
  "more",
  "head",
  "tail",
  "grep",
  "egrep",
  "fgrep",
  "rg",
  "ag",
  "awk",
  "sed",
  "source",
  ".",
  "bat",
  "xxd",
  "od",
  "hexdump",
  "strings",
  "base64",
  "nl",
  "cut",
  "sort",
  "uniq",
  "diff",
  "cp",
  "scp",
  "curl",
  "tee",
  "jq",
  "dotenv",
]);

/** ¿La ruta es un secreto? `.env*` (menos los de ejemplo), llaves y dumps. */
export function isSecretPath(/** @type {string} */ token) {
  const p = token.replace(/^\$\(|^\(|\)+$/g, "").replace(/^[<@]/, "");
  const base = p.split("/").pop() ?? "";
  if (/^\.env(\.[\w.-]+)?$/.test(base)) return !/\.(example|sample|template)$/.test(base);
  if (/\.(pem|key|dump)$/.test(base) || /\.sql\.gz$/.test(base)) return true;
  return /(^|\/)secrets\/./.test(p);
}

/** @param {string} seg @param {string[]} toks */
function checkSecrets(seg, toks) {
  const readsSecret =
    toks.some((t) => READERS.has(t.replace(/^\$\(|^\(/, ""))) && toks.some(isSecretPath);
  const redirects = [...seg.matchAll(/<\s*([^\s<>|;&]+)/g)].some((m) => isSecretPath(m[1]));
  return readsSecret || redirects
    ? deny(
        "No se leen .env, llaves ni dumps (CLAUDE.md, Seguridad) · pide a Henry el dato que necesites, sin el valor secreto",
      )
    : ALLOW;
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]", "0.0.0.0", ""]);

/** @param {string[]} t */
function checkProduction(t) {
  const [cmd, ...args] = t;
  if (cmd === "supabase") {
    const isPush = args[0] === "db" && args[1] === "push";
    const deploysFn = args[0] === "functions" && args[1] === "deploy";
    const remote = args.some((a) => a === "--linked" || a.startsWith("--db-url"));
    if (isPush || deploysFn || remote) {
      return ask(
        "Esto toca la base de datos de producción · lo ejecuta Henry; confirma solo si él lo pidió",
      );
    }
  }
  if (cmd === "psql" || cmd === "pg_dump" || cmd === "pg_restore" || cmd === "pg_dumpall") {
    /** @type {string[]} */
    const hosts = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (a === "-h" || a === "--host") hosts.push(args[i + 1] ?? "");
      else if (a.startsWith("--host=")) hosts.push(a.slice(7));
      else if (/^-h./.test(a)) hosts.push(a.slice(2));
      else if (/^postgres(ql)?:\/\//.test(a)) {
        try {
          hosts.push(new URL(a).hostname);
        } catch {
          hosts.push("?");
        }
      }
    }
    if (hosts.some((h) => !LOCAL_HOSTS.has(h))) {
      return ask(
        "Conexión a una base de datos que no es local · el SQL en producción lo corre Henry; confirma solo si él lo pidió",
      );
    }
  }
  if (cmd === "vercel") {
    const prod =
      args.includes("--prod") ||
      args.includes("--production") ||
      args.includes("--target=production") ||
      args.some((a, i) => a === "--target" && args[i + 1] === "production") ||
      ["promote", "rollback"].includes(args[0]);
    if (prod)
      return ask(
        "Despliegue a producción · lo ejecuta Henry; usa un preview (vercel deploy) salvo que él lo haya pedido",
      );
  }
  return ALLOW;
}

/** @param {string} seg @param {string[]} bodies @param {string} branch */
function checkSegment(seg, bodies, branch) {
  const raw = tokenize(seg);
  const t = unwrap(raw);
  /** @type {Verdict[]} */
  const out = [checkSecrets(seg, raw), checkProduction(t)];
  if (t[0] === "git") {
    const { sub, args } = gitParts(t);
    if (sub === "add") out.push(checkGitAdd(args));
    if (sub === "commit") out.push(checkGitCommit(args, bodies, branch));
    if (sub === "push") out.push(checkGitPush(args, branch));
  }
  return strongest(out);
}

/**
 * Decide qué hacer con un comando de la terminal (REQ-092.1…REQ-092.6, REQ-092.8).
 * @param {string} command
 * @param {{ branch?: string }} ctx
 * @returns {Verdict}
 */
export function classifyBash(command, ctx = {}) {
  const branch = ctx.branch ?? "";
  const { text, bodies } = extractHeredocs(command);
  /** @type {Verdict[]} */
  const verdicts = splitSegments(text).map((s) => checkSegment(s, bodies, branch));
  const publishes =
    /\bgit\s+(-\S+\s+)*commit\b|\bgh\s+(pr|issue)\s+(create|edit|comment|review)\b/.test(text);
  if (publishes && ATTRIBUTION.test(command)) {
    verdicts.push(
      deny(
        "Atribución de IA en commit, PR o issue (CLAUDE.md, Git) · quita la línea Co-Authored-By o 'Generated with Claude Code'",
      ),
    );
  }
  return strongest(verdicts);
}

// ---------------------------------------------------------------------------------------------
// Edición (REQ-092.7)

/**
 * @param {string} relPath ruta relativa a la raíz del repo
 * @param {{ existsInMain: (p: string) => boolean }} ctx
 * @returns {Verdict}
 */
export function classifyEdit(relPath, ctx) {
  if (/^supabase\/migrations\/[^/]+\.sql$/.test(relPath) && ctx.existsInMain(relPath)) {
    return deny(
      `${relPath} ya está en main y las migraciones solo se agregan · crea una nueva (pnpm next-ids te da el número)`,
    );
  }
  return ALLOW;
}

// ---------------------------------------------------------------------------------------------
// Herramientas MCP (REQ-092.6)

const SUPABASE_PROD_WRITES = new Set([
  "execute_sql",
  "apply_migration",
  "deploy_edge_function",
  "pause_project",
  "restore_project",
]);
const ALWAYS_PROD = new Set([
  "merge_branch", // fusiona un branch de Supabase en producción
  "request_promote",
  "request_rollback",
  "start_rolling_release",
  "approve_rolling_release_stage",
  "complete_rolling_release",
]);

/**
 * @param {string} toolName p. ej. `mcp__<servidor>__execute_sql`
 * @param {Record<string, unknown>} input
 * @returns {Verdict}
 */
export function classifyMcp(toolName, input = {}) {
  const tool = toolName.split("__").pop() ?? "";
  const reason = "Esto escribe en producción · lo ejecuta Henry; confirma solo si él lo pidió";
  if (ALWAYS_PROD.has(tool)) return ask(reason);
  if (tool === "create_deployment" && input.target === "production") return ask(reason);
  if (SUPABASE_PROD_WRITES.has(tool)) {
    const project = input.project_id;
    if (!project || project === PROD_SUPABASE_PROJECT) return ask(reason);
  }
  return ALLOW;
}

// ---------------------------------------------------------------------------------------------
// Puerta de calidad (REQ-093, design §28.3)

const CODE_DIRS = /^(src|tests|scripts|supabase)\//;

/**
 * ¿Hay que correr la puerta? Recibe `git status --porcelain`.
 * @param {string} porcelain
 * @param {{ stopHookActive?: boolean, gate?: string }} ctx
 * @returns {{ run: boolean, why?: string, files: string[] }}
 */
export function gateScope(porcelain, ctx) {
  if (ctx.gate === "off") return { run: false, why: "TURNOS_GATE=off", files: [] };
  if (ctx.stopHookActive) {
    return { run: false, why: "segunda vez seguida en el mismo cierre: no se repite", files: [] };
  }
  let code = false;
  /** @type {string[]} */
  const files = [];
  for (const line of porcelain.split("\n")) {
    if (line.length < 4) continue;
    const status = line.slice(0, 2);
    const file = line.slice(3).split(" -> ").pop()?.replace(/^"|"$/g, "") ?? "";
    if (!CODE_DIRS.test(file) || file.endsWith(".md")) continue;
    code = true;
    if (!status.includes("D")) files.push(file);
  }
  return code ? { run: true, files } : { run: false, why: "sin cambios de código", files: [] };
}

/**
 * Comandos de la puerta. pgTAP, integración y E2E quedan para el CI (necesitan base de datos).
 * @param {string[]} files
 */
export function gateCommands(files) {
  const cmds = [
    { name: "typecheck", args: ["typecheck"] },
    { name: "lint:texts", args: ["lint:texts"] },
    { name: "lint:design", args: ["lint:design"] },
  ];
  const sources = files.filter((f) => /\.(ts|tsx|mts|mjs|js)$/.test(f));
  if (sources.length) {
    cmds.push({
      name: "pruebas",
      args: [
        "exec",
        "vitest",
        "related",
        "--run",
        "--project",
        "unit",
        "--passWithNoTests",
        ...sources,
      ],
    });
  }
  return cmds;
}

/**
 * Texto para el agente con lo que falló ("" si nada falló).
 * @param {{ name: string, ok: boolean, output: string }[]} results
 */
export function gateReport(results) {
  const failed = results.filter((r) => !r.ok);
  if (!failed.length) return "";
  const parts = failed.map((r) => {
    const tail = r.output.trimEnd().split("\n").slice(-40).join("\n");
    return `✗ pnpm ${r.name}\n${tail}`;
  });
  return `Puerta de calidad de TurnOS (REQ-093): arregla esto antes de terminar.\n\n${parts.join("\n\n")}`;
}

// ---------------------------------------------------------------------------------------------
// Contexto al iniciar (design §28.4)

/** Primera tarea `[ ]` del último hito de tasks.md. */
export function firstOpenTask(/** @type {string} */ tasksMd) {
  const body = tasksMd.split(/\n## Dependencias principales/)[0];
  const sections = body.split(/\n(?=## Hito )/).filter((s) => s.startsWith("## Hito "));
  const last = sections.at(-1);
  if (!last) return null;
  const open = last.match(/^### \[ \] (T-\d+ · .+)$/m);
  if (!open) return null;
  return { hito: last.split("\n")[0].replace(/^## /, "").trim(), task: open[1].trim() };
}

/**
 * @param {{ branch: string, behind: number, dirty: number, tasksMd: string }} s
 */
export function sessionSummary({ branch, behind, dirty, tasksMd }) {
  const lines = ["TurnOS · contexto de la sesión (harness, ADR-066)", `- Rama: ${branch || "?"}`];
  if (branch === "main")
    lines.push(
      "- Estás en main: crea una rama antes de cambiar nada (una sesión = una tarea = una rama).",
    );
  if (behind > 0) lines.push(`- La rama va ${behind} commits detrás de origin/main.`);
  if (dirty > 0)
    lines.push(
      `- Hay ${dirty} archivos sin commit (pueden ser de otra sesión: revisa antes de tocarlos).`,
    );
  const open = firstOpenTask(tasksMd);
  if (open) lines.push(`- Siguiente tarea abierta del ${open.hito}: ${open.task}`);
  lines.push(
    "- Antes de numerar un REQ, ADR, tarea o migración: pnpm next-ids.",
    "- Comandos: /tarea T-NNN, /cerrar-hito N, /nuevo-req. Subagentes: revisor-spec, escritor-pruebas, revisor-sql, revisor-textos.",
    "- La puerta de calidad corre al terminar un turno con cambios de código (TURNOS_GATE=off la apaga).",
  );
  return lines.join("\n");
}
