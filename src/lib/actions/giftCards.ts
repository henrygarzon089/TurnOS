"use server";

import { getStaffSession } from "@/lib/auth/session";
import {
  giftCardErrorMessage,
  parseGiftCardForm,
  type GiftCardStatus,
} from "@/lib/domain/giftCard";
import { businessDayBogota } from "@/lib/domain/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- tipos ----

export type GiftCardRow = {
  id: string;
  code: string;
  recipientName: string | null;
  buyerName: string;
  buyerPhone: string;
  amount: number;
  balance: number;
  soldOn: string;
  expiresOn: string;
  status: GiftCardStatus;
  token: string;
};

export type GiftCardsView = {
  today: string;
  businessName: string;
  appUrl: string;
  cards: GiftCardRow[];
  /** Plantilla "Tarjeta de regalo" (REQ-033, REQ-056.1) */
  template: string;
};

/** Lo que devuelve la venta: la tarjeta recién hecha, para enviarla enseguida (REQ-056.1). */
export type SellGiftCardState =
  { ok: true; card: GiftCardRow } | { ok?: false; error?: string } | undefined;

const FORBIDDEN = "Solo el dueño puede vender tarjetas de regalo.";

type ListRow = {
  id: string;
  code: string;
  recipient_name: string | null;
  buyer_name: string;
  buyer_phone: string;
  amount: number;
  balance: number;
  sold_on: string;
  expires_on: string;
  status: GiftCardStatus;
  token: string;
};

function toRow(r: ListRow): GiftCardRow {
  return {
    id: r.id,
    code: r.code,
    recipientName: r.recipient_name,
    buyerName: r.buyer_name,
    buyerPhone: r.buyer_phone,
    amount: r.amount,
    balance: r.balance,
    soldOn: r.sold_on,
    expiresOn: r.expires_on,
    status: r.status,
    token: r.token,
  };
}

// ---------------------------------------------------------------- lectura ----

/** /admin/regalos: tarjetas con saldo y estado, y la plantilla para enviarlas (§15.5). */
export async function getGiftCardsView(): Promise<GiftCardsView | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const [listRes, tplRes] = await Promise.all([
    supabase.rpc("gift_cards_list", { p_business_id: biz }),
    supabase
      .from("message_templates")
      .select("body")
      .eq("business_id", biz)
      .eq("key", "gift_card")
      .maybeSingle(),
  ]);
  return {
    today: businessDayBogota(),
    businessName: session.business.name,
    appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
    cards: ((listRes.data ?? []) as ListRow[]).map(toRow),
    template: tplRes.data?.body ?? "",
  };
}

// ---------------------------------------------------------------- escritura ----

/** REQ-055.1–055.3: el dueño vende una tarjeta con un medio de pago de la caja. */
export async function sellGiftCard(
  _prev: SellGiftCardState,
  formData: FormData,
): Promise<SellGiftCardState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: FORBIDDEN };
  const parsed = parseGiftCardForm(formData);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.value;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const { data, error } = await supabase.rpc("sell_gift_card", {
    p_business_id: biz,
    p_amount: v.amount,
    p_buyer_phone: v.phone,
    p_buyer_name: v.name,
    p_recipient_name: v.recipient,
    p_payments: [{ method: v.method, amount: v.amount }],
  });
  if (error) return { error: giftCardErrorMessage(error) };
  const sold = data as { giftCardId: string };
  const { data: rows } = await supabase.rpc("gift_cards_list", { p_business_id: biz });
  const row = ((rows ?? []) as ListRow[]).find((r) => r.id === sold.giftCardId);
  return row ? { ok: true, card: toRow(row) } : { error: giftCardErrorMessage(null) };
}
