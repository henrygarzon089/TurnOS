// PostToolUse "Edit|Write|MultiEdit": prettier sobre el archivo editado (T-252).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { git, readEvent, safely } from "./io.mjs";

const FORMATTED = /\.(ts|tsx|mts|mjs|js|json|css|md)$/;

await safely("format", async () => {
  const event = await readEvent();
  const file = String(event.tool_input?.file_path ?? "");
  if (!FORMATTED.test(file)) return;
  const cwd = event.cwd || process.cwd();
  const root = git(cwd, ["rev-parse", "--show-toplevel"]) || cwd;
  const abs = path.resolve(cwd, file);
  const prettier = path.join(root, "node_modules/.bin/prettier");
  if (!abs.startsWith(root + path.sep) || abs.includes(`${path.sep}node_modules${path.sep}`))
    return;
  if (!existsSync(prettier) || !existsSync(abs)) return;
  execFileSync(prettier, ["--write", "--ignore-unknown", "--log-level=warn", abs], {
    cwd: root,
    stdio: "ignore",
  });
});
