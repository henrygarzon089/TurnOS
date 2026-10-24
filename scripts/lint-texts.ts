/**
 * NFR-006: ningún texto visible en inglés. Heurística: busca en JSX (src/app, src/components)
 * palabras inglesas comunes dentro de texto de elementos y atributos visibles (placeholder,
 * title, aria-label, alt). Falla con código 1 si encuentra alguna.
 *
 * Uso: pnpm tsx scripts/lint-texts.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = ["src/app", "src/components"];
const ENGLISH =
  /(?<!\p{L})(Submit|Cancel|Loading|Login|Logout|Sign in|Sign out|Password|Email|Name|Phone|Save|Delete|Edit|Next|Back|Welcome|Error|Success|Search|Close|Open|Settings|Dashboard|Customer|Customers|Barber|Queue|Ticket|Please|Required|Invalid|Unknown)(?!\p{L})/u;

const offenders: string[] = [];

function walk(dir: string) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full);
    else if (/\.(tsx|ts)$/.test(entry)) check(full);
  }
}

function check(file: string) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    // Texto entre etiquetas: >Texto<
    const jsxText = [...line.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
    // Atributos visibles
    const attrs = [...line.matchAll(/(?:placeholder|title|aria-label|alt)=["']([^"']+)["']/g)].map(
      (m) => m[1],
    );
    for (const t of [...jsxText, ...attrs]) {
      if (ENGLISH.test(t)) offenders.push(`${file}:${i + 1}: "${t.trim()}"`);
    }
  });
}

ROOTS.forEach(walk);

if (offenders.length) {
  console.error("Textos visibles en inglés (NFR-006):\n" + offenders.join("\n"));
  process.exit(1);
}
console.log("lint-texts: sin textos en inglés ✓");
