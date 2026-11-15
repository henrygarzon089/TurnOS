// PreToolUse "Bash" (REQ-092.1…REQ-092.6, REQ-092.8).
import { classifyBash } from "./lib.mjs";
import { git, readEvent, respondPreToolUse, safely } from "./io.mjs";

await safely("guard-bash", async () => {
  const event = await readEvent();
  const command = String(event.tool_input?.command ?? "");
  if (!command) return;
  const cwd = event.cwd || process.cwd();
  respondPreToolUse(
    classifyBash(command, { branch: git(cwd, ["rev-parse", "--abbrev-ref", "HEAD"]) }),
  );
});
