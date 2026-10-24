/**
 * Dinero en TurnOS: pesos colombianos, SIEMPRE enteros (constitution.md P5, P9).
 */

const copFormatter = new Intl.NumberFormat("es-CO", {
  style: "decimal",
  maximumFractionDigits: 0,
  useGrouping: true,
});

/** `25000` → `"$ 25.000"`. Lanza si el monto no es entero (nunca manejamos decimales). */
export function formatCOP(amount: number): string {
  if (!Number.isInteger(amount)) {
    throw new Error(`formatCOP recibió un monto no entero: ${amount}`);
  }
  const sign = amount < 0 ? "-" : "";
  // Intl para es-CO usa punto de miles; normalizamos cualquier separador raro por si acaso.
  const digits = copFormatter.format(Math.abs(amount)).replace(/[^\d]/g, "");
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}$ ${grouped}`;
}

/**
 * Convierte lo que escribe una persona ("25.000", "$ 25.000", "25000", "25,000") a entero.
 * Devuelve null si no es un monto entero válido.
 */
export function parseCOP(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const cleaned = trimmed.replace(/[$\s]/g, "");
  // Puntos o comas solo como separadores de miles (grupos de 3 dígitos).
  if (!/^\d{1,3}([.,]\d{3})*$|^\d+$/.test(cleaned)) return null;
  const n = Number(cleaned.replace(/[.,]/g, ""));
  return Number.isSafeInteger(n) ? n : null;
}

/** Redondeo al peso más cercano; .5 hacia arriba (REQ-025.2). */
export function roundToPeso(value: number): number {
  return Math.floor(value + 0.5);
}
