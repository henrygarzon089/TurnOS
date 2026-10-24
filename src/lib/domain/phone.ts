/**
 * Celulares colombianos (constitution.md P5, REQ-003.2): 10 dígitos que inician en 3,
 * guardados en E.164 (`+57XXXXXXXXXX`).
 */

const CO_MOBILE = /^3\d{9}$/;

/** Normaliza a E.164 o devuelve null si no es un celular colombiano válido. */
export function normalizePhoneCO(input: string): string | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  // Solo se permiten dígitos, espacios, guiones, paréntesis y un + inicial.
  if (!/^\+?[\d\s\-()]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (trimmed.startsWith("+")) {
    if (!digits.startsWith("57")) return null;
    digits = digits.slice(2);
  } else if (digits.length === 12 && digits.startsWith("57")) {
    digits = digits.slice(2);
  }
  return CO_MOBILE.test(digits) ? `+57${digits}` : null;
}

/** `+573001234567` → `300 123 4567` */
export function formatPhoneCO(e164: string): string {
  const d = e164.replace(/^\+57/, "");
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

/** Para pantallas públicas: nunca el número completo (P6). */
export function maskPhone(e164: string): string {
  return `••• ••• ${e164.slice(-4)}`;
}

/** Formato que exige wa.me: E.164 sin el signo +. */
export function waMeNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
