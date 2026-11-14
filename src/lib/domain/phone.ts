/**
 * Celulares colombianos (constitution.md P5, REQ-003.2): 10 dígitos que inician en 3,
 * guardados en E.164 (`+57XXXXXXXXXX`). Solo el barbero puede tener uno de otro país (REQ-081).
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

/**
 * Mientras se escribe: solo dígitos, máximo 10, en grupos `300 100 0001` (design §22.3). Si se pega
 * con el indicativo ("+57 300…", 12 dígitos que empiezan por 57), se le quita: el "+57" ya va fijo.
 */
export function formatPhoneTyping(raw: string): string {
  let all = raw.replace(/\D/g, "");
  if (all.length === 12 && all.startsWith("57")) all = all.slice(2);
  const d = all.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean).join(" ");
}

/**
 * Listas y tablas: nunca el número completo (P6, REQ-078.6): `300 *** 0001`. Un celular de otro país
 * (REQ-081.5) deja ver el `+`, los dos primeros dígitos y los 4 últimos: `+54 *** 6789`.
 */
export function maskPhone(e164: string): string {
  if (!isColombianPhone(e164)) {
    const all = e164.replace(/\D/g, "");
    return `+${all.slice(0, 2)} *** ${all.slice(-4)}`;
  }
  const d = e164.replace(/\D/g, "").slice(-10);
  return `${d.slice(0, 3)} *** ${d.slice(-4)}`;
}

/** País del celular del barbero (REQ-081.1): Colombia por defecto u otro país con indicativo. */
export type PhoneCountry = "co" | "other";

/** ¿Es un celular colombiano guardado en E.164 (`+573…`)? */
export function isColombianPhone(e164: string): boolean {
  return /^\+57 ?3\d{9}$/.test(e164);
}

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * REQ-081.2 celular del barbero: con Colombia, igual que `normalizePhoneCO`; con otro país, `+`,
 * indicativo y número (8 a 15 dígitos, sin espacios). Un `+57` siempre cumple la regla colombiana.
 */
export function normalizeBarberPhone(input: string, country: PhoneCountry): string | null {
  if (country === "co") return normalizePhoneCO(input);
  const trimmed = input.trim();
  if (!/^\+[\d\s\-()]+$/.test(trimmed)) return null;
  const e164 = `+${trimmed.replace(/\D/g, "")}`;
  if (e164.startsWith("+57")) return normalizePhoneCO(e164);
  return E164.test(e164) ? e164 : null;
}

/** REQ-081.5 valor inicial del campo al editar: país y número como se escribe. */
export function phoneForEdit(e164: string | null): { country: PhoneCountry; value: string } {
  if (!e164) return { country: "co", value: "" };
  return isColombianPhone(e164)
    ? { country: "co", value: formatPhoneCO(e164.replace(" ", "")) }
    : { country: "other", value: e164 };
}

/** Lee `phone_country` de un formulario: sin el campo, Colombia (formularios viejos en caché). */
export function phoneCountryOf(formData: FormData): PhoneCountry {
  return formData.get("phone_country") === "other" ? "other" : "co";
}

/** Formato que exige wa.me: E.164 sin el signo +. */
export function waMeNumber(e164: string): string {
  return e164.replace(/^\+/, "");
}
