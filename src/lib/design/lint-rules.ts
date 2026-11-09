/**
 * Reglas de `pnpm lint:design` (REQ-078.1, REQ-078.3, REQ-078.14; design §22.2).
 * Puras para poder probarlas; `scripts/lint-design.ts` recorre `src/` y las aplica.
 */

/**
 * Archivos donde el rojo relleno (`bg-accent`) es "atención ahora" (REQ-078.3). Cada tarea que lo
 * use lo agrega aquí, y la revisión del PR confirma que el caso es de atención.
 */
export const ACCENT_FILL_ALLOWED: string[] = [
  // T-152: insignias de conteo de "Hoy" y del menú del dueño (REQ-076.6, REQ-077.6)
  "src/components/admin/today/CountBadge.tsx",
  // T-169: punto rojo de Limpieza en el menú del barbero cuando falta la apertura (design §22.6)
  "src/components/cleaning/CleaningDot.tsx",
];

const PALETTE =
  /(?<![\w-])(?:[a-z0-9-]+:)*(?:bg|text|border(?:-[trblxy])?|ring|outline|from|via|to|fill|stroke|divide|placeholder|decoration|shadow|caret)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}(?:\/\d+)?(?![\w-])/g;
const HEX = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3})(?![\w-])/g;
const GRADIENT = /gradient/g;
const BACKDROP = /backdrop-(?:blur|filter)|backdrop-filter/g;
const FONTS = /next\/font|fonts\.googleapis/g;
const ACCENT_FILL = /(?<![\w-])(?:[a-z0-9-]+:)*bg-accent(?![\w-])/g;

export function designViolations(
  path: string,
  text: string,
  accentAllowed: string[] = ACCENT_FILL_ALLOWED,
): string[] {
  const out: string[] = [];
  const isTsx = path.endsWith(".tsx");
  const accentOk = accentAllowed.includes(path);
  text.split("\n").forEach((line, i) => {
    const at = `${path}:${i + 1}`;
    for (const m of line.matchAll(PALETTE))
      out.push(`${at}: color de paleta "${m[0]}" (usa un token, REQ-078.1)`);
    if (isTsx)
      for (const m of line.matchAll(HEX)) {
        // Anclas de enlace (#cobro) no son colores
        if (/href=["'][^"']*$/.test(line.slice(0, m.index))) continue;
        out.push(`${at}: color hexadecimal "${m[0]}" (usa un token, REQ-078.1)`);
      }
    for (const re of [GRADIENT, BACKDROP, FONTS])
      for (const m of line.matchAll(re)) out.push(`${at}: "${m[0]}" no se usa (REQ-078.14)`);
    if (!accentOk)
      for (const m of line.matchAll(ACCENT_FILL))
        out.push(`${at}: "${m[0]}" solo para atención ahora (REQ-078.3, ACCENT_FILL_ALLOWED)`);
  });
  return out;
}
