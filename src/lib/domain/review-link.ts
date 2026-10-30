/** Tope de la columna `businesses.google_review_url` (0033). */
const MAX_LENGTH = 500;

/**
 * REQ-036.1: enlace de reseñas de Google. Vacío = quitarlo. Devuelve la forma normalizada de
 * `URL`, porque el `check` de la base exige `https://` en minúsculas.
 */
export function parseGoogleReviewUrl(
  raw: string,
): { ok: true; url: string | null } | { ok: false } {
  const text = raw.trim();
  if (!text) return { ok: true, url: null };
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    return { ok: false };
  }
  if (url.protocol !== "https:" || !url.hostname.includes(".")) return { ok: false };
  if (url.href.length > MAX_LENGTH) return { ok: false };
  return { ok: true, url: url.href };
}
