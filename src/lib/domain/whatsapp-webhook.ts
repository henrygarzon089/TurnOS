/**
 * Lógica pura del webhook de Meta (design.md §12.5): firma, lectura del cuerpo y textos. El cuerpo
 * viene de afuera, así que todo lo que no tenga la forma esperada se ignora sin lanzar.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { formatPhoneCO, normalizePhoneCO } from "./phone";

export const OPT_OUT_KEYWORD = "PARAR";
export const OPT_OUT_CONFIRMATION = "Listo, ya no te enviaremos avisos por WhatsApp.";

export type WebhookEvent =
  | {
      type: "status";
      messageId: string;
      status: "sent" | "delivered" | "failed";
      errorCode: string | null;
    }
  | { type: "message"; phoneE164: string; text: string };

const SIGNATURE = /^sha256=([0-9a-f]{64})$/;
const TRACKED_STATUSES = ["sent", "delivered", "failed"] as const;

/** REQ-042.2 sin importar mayúsculas, tildes ni espacios. */
export function normalizeOptOut(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}|\s/gu, "")
    .toUpperCase();
}

/** REQ-043.5 HMAC-SHA256 del cuerpo crudo, comparado en tiempo constante. */
export function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  const received = header?.match(SIGNATURE)?.[1];
  if (!received || !secret) return false;
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest();
  return timingSafeEqual(Buffer.from(received, "hex"), expected);
}

const list = (value: unknown): Record<string, unknown>[] => (Array.isArray(value) ? value : []);

function parseStatus(s: Record<string, unknown>): WebhookEvent | null {
  const status = TRACKED_STATUSES.find((known) => known === s.status);
  if (!status || typeof s.id !== "string") return null;
  const code = list(s.errors)[0]?.code;
  return { type: "status", messageId: s.id, status, errorCode: code == null ? null : String(code) };
}

function parseMessage(m: Record<string, unknown>): WebhookEvent | null {
  const phoneE164 = typeof m.from === "string" ? normalizePhoneCO(`+${m.from}`) : null;
  if (!phoneE164) return null;
  const body = (m.text as { body?: unknown } | undefined)?.body;
  return { type: "message", phoneE164, text: typeof body === "string" ? body : "" };
}

export function parseWebhookEvents(payload: unknown): WebhookEvent[] {
  const entries = list((payload as { entry?: unknown } | null)?.entry);
  const values = entries.flatMap((entry) =>
    list(entry.changes).map((change) => change.value as Record<string, unknown> | undefined),
  );
  return values
    .flatMap((value) => [
      ...list(value?.statuses).map(parseStatus),
      ...list(value?.messages).map(parseMessage),
    ])
    .filter((event) => event !== null);
}

/** REQ-042.4 / REQ-042.5 */
export function autoReplyText(contactPhone: string | null): string {
  const base = "Este número solo envía avisos.";
  return contactPhone
    ? `${base} Para hablar con la barbería escribe al ${formatPhoneCO(contactPhone)}`
    : base;
}
