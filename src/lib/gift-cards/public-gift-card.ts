import type { Gateway } from "@/lib/db/gateway";
import type { GiftCardStatus } from "@/lib/domain/giftCard";

/** Lo que ve cualquiera con el enlace (REQ-056.2): sin comprador ni ventas (REQ-056.3). */
export type PublicGiftCard = {
  businessName: string;
  slug: string;
  recipientName: string | null;
  code: string;
  amount: number;
  balance: number;
  expiresOn: string;
  status: GiftCardStatus;
};

/** REQ-056.2 la página /regalo/[token] lee la tarjeta con service_role (ADR-009). */
export async function getGiftCardByToken(
  gw: Gateway,
  token: string,
): Promise<PublicGiftCard | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const raw = await gw.rpc<Record<string, unknown> | null>("get_gift_card_by_token", {
    p_token: token,
  });
  if (!raw) return null;
  return {
    businessName: String(raw.businessName),
    slug: String(raw.slug),
    recipientName: (raw.recipientName as string | null) ?? null,
    code: String(raw.code),
    amount: Number(raw.amount),
    balance: Number(raw.balance),
    expiresOn: String(raw.expiresOn),
    status: raw.status as GiftCardStatus,
  };
}
