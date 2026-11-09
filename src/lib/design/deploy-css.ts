/**
 * REQ-078.26 (ADR-052): el CSS que sirve producción debe ser el del build. El 2026-11-08 Vercel
 * reusó la caché de build y publicó el CSS de antes del Hito 16 con el HTML nuevo.
 *
 * Tailwind solo publica los tokens que se usan y acorta los hex (#ffffff → #fff), así que se
 * compara cada token publicado con su valor en `globals.css`, y se exige `--color-brand` y la regla
 * `.bg-brand` (las dos faltaban en el CSS viejo).
 */

const TOKEN = /(--(?:color|radius)-[a-z0-9-]+)\s*:\s*([^;}\s]+)/g;

/** Tokens de color y esquinas del bloque `@theme` de `globals.css`. */
export function themeTokens(globalsCss: string): Map<string, string> {
  const block = globalsCss.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  return new Map([...block.matchAll(TOKEN)].map((m) => [m[1], m[2].toLowerCase()]));
}

/** Expande el hex corto para comparar `#fff` con `#ffffff`. */
function normalize(value: string): string {
  const v = value.toLowerCase();
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  return short ? `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}` : v;
}

/** Lista de diferencias entre el CSS publicado y el `@theme`; vacía si coinciden. */
export function compareDeployedCss(globalsCss: string, servedCss: string): string[] {
  const expected = themeTokens(globalsCss);
  const served = new Map([...servedCss.matchAll(TOKEN)].map((m) => [m[1], m[2]]));
  const problems: string[] = [];
  for (const [name, value] of served) {
    const want = expected.get(name);
    if (want !== undefined && normalize(value) !== normalize(want))
      problems.push(`${name}: publicado ${value}, esperado ${want}`);
  }
  if (!served.has("--color-brand")) problems.push("falta --color-brand");
  if (!/\.bg-brand\s*\{/.test(servedCss)) problems.push("falta la regla .bg-brand");
  return problems;
}
