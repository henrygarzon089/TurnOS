// Stop: puerta de calidad (REQ-093, design §28.3).
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { gateCommands, gateReport, gateScope } from "./lib.mjs";
import { git, readEvent, safely } from "./io.mjs";

const LIMIT_MS = 120_000;

/** @param {string} cwd @param {string[]} args @param {AbortSignal} signal */
function run(cwd, args, signal) {
  return new Promise((resolve) => {
    let output = "";
    const child = spawn("pnpm", args, {
      cwd,
      signal,
      env: { ...process.env, CI: "1", FORCE_COLOR: "0" },
    });
    child.stdout.on("data", (d) => (output += d));
    child.stderr.on("data", (d) => (output += d));
    child.on("error", (err) =>
      resolve({ ok: err.name === "AbortError" ? null : true, output: String(err) }),
    );
    child.on("close", (code) => resolve({ ok: code === 0, output }));
  });
}

await safely("gate", async () => {
  const event = await readEvent();
  const cwd = event.cwd || process.cwd();
  const root = git(cwd, ["rev-parse", "--show-toplevel"]) || cwd;
  const scope = gateScope(git(root, ["status", "--porcelain", "--untracked-files=all"]), {
    stopHookActive: Boolean(event.stop_hook_active),
    gate: process.env.TURNOS_GATE,
  });
  if (!scope.run) return;
  if (!existsSync(path.join(root, "node_modules"))) {
    process.stderr.write("puerta de calidad: sin node_modules, no corre (pnpm install)\n");
    return;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LIMIT_MS);
  const cmds = gateCommands(scope.files);
  const results = await Promise.all(
    cmds.map(async (c) => ({
      name: c.name,
      .../** @type {{ok: boolean|null, output: string}} */ (
        await run(root, c.args, controller.signal)
      ),
    })),
  );
  clearTimeout(timer);
  if (controller.signal.aborted) {
    process.stdout.write(
      JSON.stringify({
        systemMessage:
          "Puerta de calidad: pasó de 120 s y no terminó; corre pnpm typecheck y pnpm test a mano.",
      }),
    );
    return;
  }
  const report = gateReport(results.map((r) => ({ ...r, ok: r.ok !== false })));
  if (report) process.stdout.write(JSON.stringify({ decision: "block", reason: report }));
});
