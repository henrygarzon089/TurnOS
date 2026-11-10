/**
 * Aviso de privacidad público como el tablero Cliente-Cita (REQ-078.24, design §22.7): el texto
 * del dueño tal cual, con títulos en negrita cuando una línea termina en ":" o es una de las
 * preguntas del tablero.
 */
import { renewalDayLabel } from "./membership";
import { businessDayBogota } from "./time";

export type PrivacyBlock = { kind: "heading" | "text"; text: string };

const BOARD_QUESTIONS = /^(quién trata tus datos|qué datos pedimos|para qué|tus derechos)/i;
const MAX_HEADING = 80;

export function privacyBlocks(body: string): PrivacyBlock[] {
  return body
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((text) => ({
      kind:
        text.length <= MAX_HEADING && (text.endsWith(":") || BOARD_QUESTIONS.test(text))
          ? "heading"
          : "text",
      text,
    }));
}

/** "Versión 3 · vigente desde 7 de noviembre de 2026" (`published_at`, día de Bogotá). */
export function privacyVersionLine(version: number, publishedAt: string): string {
  const day = businessDayBogota(new Date(publishedAt));
  return `Versión ${version} · vigente desde ${renewalDayLabel(day)} de ${day.slice(0, 4)}`;
}
