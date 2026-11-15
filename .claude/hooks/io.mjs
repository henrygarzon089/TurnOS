// Entrada y salida de los hooks (ADR-066, design §28.2). No decide nada: eso vive en lib.mjs.
import { execFileSync } from "node:child_process";

/** Lee el evento JSON que Claude Code manda por stdin. */
export async function readEvent() {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

/** Corre git y devuelve la salida, o "" si falla. */
export function git(/** @type {string} */ cwd, /** @type {string[]} */ args) {
  try {
    return execFileSync("git", ["-C", cwd, ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trimEnd();
  } catch {
    return "";
  }
}

/** Responde a un PreToolUse: solo habla si hay que bloquear o preguntar. */
export function respondPreToolUse(/** @type {{decision: string, reason?: string}} */ verdict) {
  if (verdict.decision === "allow") return;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: verdict.decision,
        permissionDecisionReason: `TurnOS · ${verdict.reason}`,
      },
    }),
  );
}

/** Un bug del hook no debe dejar al agente sin trabajar (design §28.2): avisa y deja pasar. */
export async function safely(/** @type {string} */ name, /** @type {() => Promise<void>} */ fn) {
  try {
    await fn();
  } catch (err) {
    process.stderr.write(`hook ${name}: ${err instanceof Error ? err.message : String(err)}\n`);
  }
  process.exit(0);
}
