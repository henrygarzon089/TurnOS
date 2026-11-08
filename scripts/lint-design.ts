/**
 * REQ-078.1, REQ-078.3, REQ-078.14: colores solo de tokens, rojo relleno solo donde se permite,
 * sin degradados, desenfoque de fondo ni fuentes descargadas. Recorre src/ (.ts, .tsx, .css) y
 * falla con código 1 si encuentra algo. Reglas en `src/lib/design/lint-rules.ts`.
 *
 * Uso: pnpm lint:design
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { designViolations } from "../src/lib/design/lint-rules";

const offenders: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx|ts|css)$/.test(entry) && !full.startsWith("src/lib/design/"))
      offenders.push(...designViolations(full, readFileSync(full, "utf8")));
  }
}

walk("src");

if (offenders.length) {
  console.error("Diseño fuera del sistema visual (REQ-078):\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("lint-design: solo tokens del sistema visual ✓");
