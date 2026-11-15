// PreToolUse "mcp__.*" (REQ-092.6): producción por MCP pide confirmación.
import { classifyMcp } from "./lib.mjs";
import { readEvent, respondPreToolUse, safely } from "./io.mjs";

await safely("guard-mcp", async () => {
  const event = await readEvent();
  respondPreToolUse(classifyMcp(String(event.tool_name ?? ""), event.tool_input ?? {}));
});
