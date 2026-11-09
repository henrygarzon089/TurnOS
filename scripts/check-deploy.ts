/**
 * REQ-078.26 (ADR-052): verifica que una URL desplegada sirva el CSS del build (tokens de
 * `globals.css` y la regla `.bg-brand`). Se corre después de cada despliegue a producción.
 * Reglas en `src/lib/design/deploy-css.ts`.
 *
 * Uso: pnpm check:deploy https://turnos-smoky-nine.vercel.app [/la-33]
 */
import { readFileSync } from "node:fs";
import { compareDeployedCss } from "../src/lib/design/deploy-css";

const [base, path = "/la-33"] = process.argv.slice(2);
if (!base) {
  console.error("Uso: pnpm check:deploy <url> [ruta]");
  process.exit(1);
}

const pageUrl = new URL(path, base);
const html = await fetch(pageUrl, { cache: "no-store" }).then((r) => r.text());
const hrefs = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g)].map((m) => m[1]);
const css = (
  await Promise.all(hrefs.map((h) => fetch(new URL(h, pageUrl)).then((r) => r.text())))
).join("\n");

const problems = compareDeployedCss(readFileSync("src/app/globals.css", "utf8"), css);
if (problems.length) {
  console.error(
    `El CSS publicado en ${pageUrl} no es el del build (REQ-078.26):\n` +
      problems.map((p) => `  - ${p}`).join("\n") +
      "\nVuelve a desplegar sin caché: vercel --prod --force",
  );
  process.exit(1);
}
console.log(`check-deploy: ${pageUrl} sirve el CSS del build (${hrefs.length} hoja(s)) ✓`);
