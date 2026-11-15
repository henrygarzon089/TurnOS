// SessionStart: contexto de la sesión (design §28.4).
import { readFileSync } from "node:fs";
import path from "node:path";
import { sessionSummary } from "./lib.mjs";
import { git, readEvent, safely } from "./io.mjs";

await safely("session", async () => {
  const event = await readEvent();
  const cwd = event.cwd || process.cwd();
  const root = git(cwd, ["rev-parse", "--show-toplevel"]) || cwd;
  let tasksMd = "";
  try {
    tasksMd = readFileSync(path.join(root, "specs/tasks.md"), "utf8");
  } catch {}
  const porcelain = git(root, ["status", "--porcelain"]);
  const summary = sessionSummary({
    branch: git(root, ["rev-parse", "--abbrev-ref", "HEAD"]),
    behind: Number(git(root, ["rev-list", "--count", "HEAD..origin/main"]) || 0),
    dirty: porcelain ? porcelain.split("\n").length : 0,
    tasksMd,
  });
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: summary },
    }),
  );
});
