import { renewalDayLabel } from "@/lib/domain/membership";
import { parseCOP } from "@/lib/domain/money";
import { normalizePhoneCO } from "@/lib/domain/phone";

/** Tarjetas de regalo (REQ-055…REQ-059, design.md §15). Montos en COP enteros (P9). */

export const GIFT_CARD_MIN = 10_000;
export const GIFT_CARD_MAX = 500_000;

/** Medios con que se vende una tarjeta: los de la caja, nunca otra tarjeta (REQ-057.7). */
export const GIFT_CARD_SALE_METHODS = ["cash", "nequi", "transfer", "card"] as const;
export type GiftCardSaleMethod = (typeof GIFT_CARD_SALE_METHODS)[number];

/** Estado que se muestra (`gift_card_state`, design.md §15.1). */
export type GiftCardStatus = "active" | "exhausted" | "expired" | "voided";

export type GiftCardInput = {
  amount: number;
  name: string;
  phone: string;
  recipient: string | null;
  method: GiftCardSaleMethod;
};

type Parsed = { ok: true; value: GiftCardInput } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  INVALID_AMOUNT: `El valor va en miles exactos, entre $ 10.000 y $ 500.000.`,
  INVALID_PHONE: "Escribe un celular de 10 dígitos que empiece por 3.",
  INVALID_NAME: '"Para" es solo el nombre de pila (máximo 40 letras).',
  INVALID_PAYMENT: "Una tarjeta de regalo no se paga con otra tarjeta.",
  PAYMENTS_MISMATCH: "El pago no coincide con el valor de la tarjeta.",
  CASH_DAY_CLOSED: "La caja de hoy ya está cerrada. Reábrela para vender la tarjeta.",
  GIFT_CARD_NOT_FOUND: "No encontramos una tarjeta con ese código.",
  GIFT_CARD_VOIDED: "Esa tarjeta fue anulada.",
  GIFT_CARD_EXPIRED: "Esa tarjeta ya venció.",
  GIFT_CARD_INSUFFICIENT: "La tarjeta no tiene saldo suficiente.",
  ONE_GIFT_CARD_PER_SALE: "Se puede usar una sola tarjeta por cobro.",
  GIFT_CARD_IN_USE: "Esta tarjeta ya se usó: primero anula las ventas que la usaron.",
  FORBIDDEN: "No tienes permiso para esta acción.",
};

/** Mensaje en español para los errores de las funciones de tarjetas (0051, 0052). */
export function giftCardErrorMessage(e: { message?: string; code?: string } | null): string {
  const key = Object.keys(ERRORS).find((k) => e?.message?.includes(k));
  if (key) return ERRORS[key];
  if (e?.code === "42501") return ERRORS.FORBIDDEN;
  return "No se pudo guardar. Revisa tu conexión.";
}

/** Valida "Vender tarjeta" en /admin/regalos (REQ-055.1, REQ-055.3). */
export function parseGiftCardForm(fd: FormData): Parsed {
  const amount = parseCOP(String(fd.get("amount") ?? ""));
  if (amount === null || amount < GIFT_CARD_MIN || amount > GIFT_CARD_MAX || amount % 1000 !== 0) {
    return { ok: false, error: ERRORS.INVALID_AMOUNT };
  }
  const name = String(fd.get("name") ?? "").trim();
  if (name.length < 2 || name.length > 60) {
    return { ok: false, error: "Escribe el nombre de quien compra (mínimo 2 letras)." };
  }
  const phone = normalizePhoneCO(String(fd.get("phone") ?? ""));
  if (!phone) return { ok: false, error: ERRORS.INVALID_PHONE };
  const recipient = String(fd.get("recipient") ?? "").trim() || null;
  if (recipient && recipient.length > 40) return { ok: false, error: ERRORS.INVALID_NAME };
  const method = String(fd.get("method") ?? "");
  if (!(GIFT_CARD_SALE_METHODS as readonly string[]).includes(method)) {
    return { ok: false, error: "Escoge el medio de pago." };
  }
  return {
    ok: true,
    value: { amount, name, phone, recipient, method: method as GiftCardSaleMethod },
  };
}

/** REQ-055.4 lo que se escribe en el cobro: mayúsculas, sin espacios ni guiones. */
export function normalizeGiftCardCode(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase();
}

/** "K7QM4XPA" → "K7QM-4XPA". */
export function formatGiftCardCode(code: string): string {
  return code.length === 8 ? `${code.slice(0, 4)}-${code.slice(4)}` : code;
}

/** Enlace de la página pública de la tarjeta (REQ-056.2). */
export function giftCardUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/$/, "")}/regalo/${token}`;
}

/** "2027-11-03" → "3 de noviembre de 2027": la tarjeta vence en un año, así que lleva el año. */
export function giftCardDayLabel(day: string): string {
  return `${renewalDayLabel(day)} de ${day.slice(0, 4)}`;
}

const STATUS_LABEL: Record<GiftCardStatus, string> = {
  active: "Vigente",
  exhausted: "Agotada",
  expired: "Vencida",
  voided: "Anulada",
};

export function giftCardStatusLabel(status: GiftCardStatus): string {
  return STATUS_LABEL[status];
}

/** REQ-059.3 "Saldo por usar": lo que el negocio todavía debe en tarjetas vigentes. */
export function balanceToUse(rows: { balance: number; status: GiftCardStatus }[]): number {
  return rows.filter((r) => r.status === "active").reduce((sum, r) => sum + r.balance, 0);
}
