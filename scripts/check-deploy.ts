/**
 * REQ-078.26 (ADR-052): verifica que una URL desplegada sirva el CSS del build (tokens de
 * `globals.css` y la regla `.bg-brand`). Se corre después de cada despliegue a producción.
 * Reglas en `src/lib/design/deploy-css.ts`.
 *
 * Uso: pnpm check:deploy https://www.gammaclub.co [/gamma-club]
 * La ruta por defecto es la fila de Gamma Club, el único negocio en producción (ADR-055); La 33
 * existe solo en local y en el CI. Si la ruta no responde 200 o dice "Negocio no encontrado" (que
 * responde 200), falla: una página de error también trae CSS y daría un ✓ engañoso.
 */
import { readFileSync } from "node:fs";
import { compareDeployedCss } from "../src/lib/design/deploy-css";

const [base, path = "/gamma-club"] = process.argv.slice(2);
if (!base) {
  console.error("Uso: pnpm check:deploy <url> [ruta]");
  process.exit(1);
}

const pageUrl = new URL(path, base);
const res = await fetch(pageUrl, { cache: "no-store" });
if (!res.ok) {
  console.error(`check-deploy: ${pageUrl} respondió ${res.status}; usa una ruta que exista.`);
  process.exit(1);
}
const html = await res.text();
// La página de "no encontrado" responde 200 y también trae CSS: no sirve para comparar. Se mira el
// título: el texto suelto va también en el código de cualquier página.
if (/<title>Negocio no encontrado/.test(html)) {
  console.error(`check-deploy: ${pageUrl} dice "Negocio no encontrado"; usa una ruta que exista.`);
  process.exit(1);
}
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
