/**
 * REQ-096.2, REQ-096.3, REQ-097.2 (ADR-070, design §29.2): descripción opcional de un servicio o
 * del negocio. Se limpia (espacios de sobra y saltos de línea → un espacio), vacía es "sin
 * descripción" (null) y el largo se cuenta en caracteres, como `char_length` en Postgres.
 */
export const SERVICE_DESCRIPTION_MAX = 140;
export const BUSINESS_DESCRIPTION_MAX = 200;
/** REQ-098.2 (ADR-072): descripción del producto en el menú, mismo largo que el servicio. */
export const PRODUCT_DESCRIPTION_MAX = 140;

export type DescriptionResult = { ok: true; value: string | null } | { ok: false; error: string };

/** Largo en caracteres (puntos de código), igual que `char_length` de la base de datos. */
export function descriptionLength(text: string): number {
  return [...text].length;
}

export function normalizeDescription(raw: string, max: number): DescriptionResult {
  const value = raw.replace(/\s+/g, " ").trim();
  if (!value) return { ok: true, value: null };
  if (descriptionLength(value) > max) {
    return { ok: false, error: `La descripción puede tener hasta ${max} letras.` };
  }
  return { ok: true, value };
}
