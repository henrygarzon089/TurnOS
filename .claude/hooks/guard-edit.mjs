// PreToolUse "Edit|Write|MultiEdit|NotebookEdit" (REQ-092.7).
import path from "node:path";
import { classifyEdit } from "./lib.mjs";
import { git, readEvent, respondPreToolUse, safely } from "./io.mjs";

await safely("guard-edit", async () => {
  const event = await readEvent();
  const file = String(event.tool_input?.file_path ?? event.tool_input?.notebook_path ?? "");
  if (!file) return;
  const cwd = event.cwd || process.cwd();
  const root = git(cwd, ["rev-parse", "--show-toplevel"]) || cwd;
  const rel = path.relative(root, path.resolve(cwd, file)).split(path.sep).join("/");
  const existsInMain = (/** @type {string} */ p) =>
    ["origin/main", "main"].some((ref) => git(root, ["cat-file", "-t", `${ref}:${p}`]) === "blob");
  respondPreToolUse(classifyEdit(rel, { existsInMain }));
});
