"use server";

import { z } from "zod";
import { getStaffSession } from "@/lib/auth/session";
import {
  checkoutPayments,
  giftCardLookupResult,
  normalizeGiftCardCode,
  type GiftCardLookup,
} from "@/lib/domain/giftCard";
import { toLoyaltyStatus, type LoyaltyStatus } from "@/lib/domain/loyalty";
import { toMembershipStatus, type MembershipStatus } from "@/lib/domain/membership";
import { normalizePhoneCO } from "@/lib/domain/phone";
import {
  MY_NUMBERS_COLUMNS,
  summarizeMyNumbers,
  type MyNumbersRow,
  type Totals,
} from "@/lib/domain/my-numbers";
import { bogotaWeekStart, businessDayBogota } from "@/lib/domain/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- tipos ----

export type PaymentMethod = "cash" | "nequi" | "daviplata" | "transfer" | "card";

export type CatalogItem = { id: string; name: string; price: number };

/** REQ-066.1 producto de la vitrina (foto, categoría y si da comisión). */
export type ShowcaseItem = CatalogItem & {
  photoPath: string | null;
  category: string | null;
  commissionable: boolean;
};

export type CheckoutView = {
  isOwner: boolean;
  ticket: {
    id: string;
    customerName: string;
    serviceId: string;
    serviceName: string;
    /** Precio congelado en el turno (REQ-023.1). */
    servicePrice: number;
    barberId: string;
    barberName: string;
  } | null;
  services: CatalogItem[];
  products: ShowcaseItem[];
  /** REQ-065.1 % de comisión por productos y REQ-068.1 % de descuento de empleado. */
  productCommissionPct: number;
  staffDiscountPct: number;
  loyalty: LoyaltyStatus | null;
  /** REQ-047.1: periodo vigente de la familia del cliente del turno (null si no es miembro). */
  membership: MembershipStatus | null;
  /** Servicios que gastan cortes de la membresía (`counts_for_membership`). */
  membershipServiceIds: string[];
  /** Servicio que se regala si el premio es "servicio gratis" (REQ-019.4). */
  rewardServiceId: string | null;
  barbers: { id: string; name: string }[];
};

export type SaleLineInput = {
  kind: "service" | "product";
  refId: string;
  qty: number;
  discount?: number;
  discountReason?: string;
  isReward?: boolean;
  /** REQ-047.1: usar la membresía en esta línea; el servidor decide corte o descuento. */
  membership?: boolean;
};

/** REQ-047.1 cliente de "Nueva venta" buscado por celular (decisión de Henry, 2026-11-02). */
export type CheckoutCustomer = { id: string; name: string; membership: MembershipStatus | null };

export type CashResult = { ok: true; saleId?: string } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  PAYMENTS_MISMATCH: "El total cambió (precios actualizados). Cierra y vuelve a abrir el cobro.",
  ALREADY_PAID: "Este turno ya está cobrado.",
  TICKET_NOT_DONE: "El turno todavía no está terminado.",
  DISCOUNT_NOT_ALLOWED: "Solo el dueño puede dar descuentos.",
  DISCOUNT_REQUIRES_REASON: "Escribe el motivo del descuento.",
  DISCOUNT_TOO_BIG: "El descuento no puede ser mayor que el precio.",
  NO_REWARD_AVAILABLE: "Este cliente no tiene un premio disponible.",
  REWARD_SERVICE_MISMATCH: "El premio es otro servicio.",
  ONE_REWARD_PER_SALE: "Solo se aplica un premio por cobro.",
  EMPTY_SALE: "Agrega al menos un servicio o producto.",
  BARBER_REQUIRED: "Elige el barbero que hizo el servicio.",
  CASH_DAY_CLOSED: "La caja de hoy ya está cerrada. El dueño debe reabrirla.",
  REASON_REQUIRED: "Escribe el motivo.",
  NOT_PENDING: "Este turno ya no tiene cobro pendiente.",
  ONLY_TODAY: "Solo se anulan ventas de hoy.",
  ALREADY_VOIDED: "Esta venta ya está anulada.",
  VOID_REQUIRES_REASON: "Escribe el motivo de la anulación.",
  NO_MEMBERSHIP: "Este cliente no tiene una membresía vigente.",
  NOT_MEMBERSHIP_SERVICE: "Ese servicio no gasta cortes de la membresía.",
  ONE_BENEFIT_PER_SALE: "Solo se aplica un beneficio por cobro: la membresía o el premio.",
  GIFT_CARD_NOT_FOUND: "No encontramos una tarjeta de regalo con ese código.",
  GIFT_CARD_VOIDED: "Esa tarjeta de regalo fue anulada.",
  GIFT_CARD_EXPIRED: "Esa tarjeta de regalo ya venció.",
  GIFT_CARD_INSUFFICIENT: "La tarjeta de regalo ya no tiene ese saldo. Vuelve a buscar el código.",
  GIFT_CARD_IN_USE: "Esta tarjeta ya se usó: primero anula las ventas que la usaron.",
  ONE_GIFT_CARD_PER_SALE: "Se puede usar una sola tarjeta de regalo por cobro.",
  PRODUCT_NOT_FOUND: "Ese producto ya no está a la venta. Cierra y vuelve a abrir.",
  STAFF_DISCOUNT_OFF: "El descuento de empleado está en 0 %: no hay compra de un barbero.",
  INVALID_STAFF_PURCHASE: "La compra de un barbero es solo de productos.",
  BARBER_NOT_FOUND: "Ese barbero ya no está activo.",
  FORBIDDEN: "No tienes permiso para esta acción.",
};

function mapError(e: { message?: string; code?: string } | null): string {
  const key = Object.keys(ERRORS).find((k) => e?.message?.includes(k));
  if (key) return ERRORS[key];
  if (e?.code === "42501") return ERRORS.FORBIDDEN;
  return "No se pudo registrar. Revisa tu conexión.";
}

// ---------------------------------------------------------------- lectura ----

/** REQ-023.1: datos para el panel de cobro (turno prellenado, catálogo, premio). */
export async function getCheckout(ticketId: string | null): Promise<CheckoutView | null> {
  const session = await getStaffSession();
  if (!session) return null;
  if (ticketId !== null && !z.uuid().safeParse(ticketId).success) return null;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;

  const [ticketRes, servicesRes, productsRes, progRes, barbersRes, bizRes] = await Promise.all([
    ticketId
      ? supabase
          .from("tickets")
          .select(
            "id, customer_id, customer_name, service_id, service_name, service_price, assigned_barber_id, status, payment_status",
          )
          .eq("id", ticketId)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("services")
      .select("id, name, price, counts_for_membership")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("products")
      .select("id, name, price, photo_path, category, commissionable")
      .eq("business_id", biz)
      .eq("is_active", true)
      .eq("for_sale", true) // REQ-038.7: lo que es solo de cortesía no se cobra
      .order("sort_order"),
    supabase
      .from("loyalty_programs")
      .select("enabled, reward_service_id")
      .eq("business_id", biz)
      .maybeSingle(),
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("businesses")
      .select("product_commission_pct, staff_discount_pct")
      .eq("id", biz)
      .maybeSingle(),
  ]);

  const t = ticketRes.data as {
    id: string;
    customer_id: string | null;
    customer_name: string;
    service_id: string;
    service_name: string;
    service_price: number;
    assigned_barber_id: string | null;
    status: string;
    payment_status: string;
  } | null;
  if (ticketId && (!t || t.status !== "done" || t.payment_status !== "pending")) return null;
  if (t && session.role !== "owner" && t.assigned_barber_id !== session.barberId) return null;

  const allBarbers = ((barbersRes.data ?? []) as { id: string; display_name: string }[]).map(
    (b) => ({ id: b.id, name: b.display_name }),
  );
  // REQ-023.7: el barbero solo registra a su nombre; el dueño elige cualquiera
  const barbers =
    session.role === "owner" ? allBarbers : allBarbers.filter((b) => b.id === session.barberId);
  const loyalty = t?.customer_id
    ? toLoyaltyStatus(
        (await supabase.rpc("customer_loyalty", { p_customer_id: t.customer_id })).data,
      )
    : null;
  const membership = t?.customer_id
    ? toMembershipStatus(
        (
          await supabase.rpc("membership_status", {
            p_business_id: biz,
            p_customer_id: t.customer_id,
          })
        ).data,
      )
    : null;
  const services = (servicesRes.data ?? []) as (CatalogItem & {
    counts_for_membership: boolean;
  })[];

  return {
    isOwner: session.role === "owner",
    ticket: t
      ? {
          id: t.id,
          customerName: t.customer_name,
          serviceId: t.service_id,
          serviceName: t.service_name,
          servicePrice: t.service_price,
          barberId: t.assigned_barber_id ?? "",
          barberName: allBarbers.find((b) => b.id === t.assigned_barber_id)?.name ?? "",
        }
      : null,
    services: services.map(({ id, name, price }) => ({ id, name, price })),
    products: (
      (productsRes.data ?? []) as (CatalogItem & {
        photo_path: string | null;
        category: string | null;
        commissionable: boolean;
      })[]
    ).map((p) => ({
      id: p.id,
      name: p.name,
      price: p.price,
      photoPath: p.photo_path,
      category: p.category,
      commissionable: p.commissionable,
    })),
    productCommissionPct: bizRes.data?.product_commission_pct ?? 0,
    staffDiscountPct: bizRes.data?.staff_discount_pct ?? 0,
    loyalty,
    membership,
    membershipServiceIds: services.filter((s) => s.counts_for_membership).map((s) => s.id),
    rewardServiceId: progRes.data?.enabled ? (progRes.data.reward_service_id ?? null) : null,
    barbers,
  };
}

// ---------------------------------------------------------------- escritura ----

const lineSchema = z.object({
  kind: z.enum(["service", "product"]),
  refId: z.uuid(),
  qty: z.number().int().min(1).max(50),
  discount: z.number().int().min(0).optional(),
  discountReason: z.string().trim().max(120).optional(),
  isReward: z.boolean().optional(),
  membership: z.boolean().optional(),
});
const saleSchema = z.object({
  ticketId: z.uuid().nullable(),
  /** "Nueva venta" con el celular del cliente (REQ-047.1); con turno, el cliente sale del turno. */
  customerId: z.uuid().nullable().optional(),
  barberId: z.uuid().nullable(),
  /** REQ-068.2 compra de un barbero: quién compra (entonces sin turno ni barbero que vende). */
  staffBuyerId: z.uuid().nullable().optional(),
  items: z.array(lineSchema).min(1, ERRORS.EMPTY_SALE),
  /** Medio de pago del total o, con tarjeta de regalo, de lo que falta (REQ-057.3). */
  method: z.enum(["cash", "nequi", "daviplata", "transfer", "card"]),
  /** REQ-057.3 parte pagada con la tarjeta de regalo (a lo sumo una por venta). */
  giftCard: z
    .object({ code: z.string().regex(/^[A-HJKMNP-Z2-9]{8}$/), amount: z.number().int().min(1) })
    .optional(),
  /** Total que vio quien cobra; la base lo vuelve a calcular y rechaza si no coincide. */
  total: z.number().int().min(0),
});

/** REQ-023.3 registra la venta (register_sale calcula montos y comisión). */
export async function registerSale(input: z.input<typeof saleSchema>): Promise<CashResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida. Vuelve a entrar." };
  const parsed = saleSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos no válidos." };
  const d = parsed.data;
  if (d.giftCard && d.giftCard.amount > d.total)
    return { ok: false, error: ERRORS.PAYMENTS_MISMATCH };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("register_sale", {
    p_business_id: session.business.id,
    p_ticket_id: d.ticketId,
    p_barber_id: d.barberId,
    p_items: d.items.map((i) => ({
      kind: i.kind,
      ref_id: i.refId,
      qty: i.qty,
      discount: i.discount ?? 0,
      discount_reason: i.discountReason ?? null,
      is_reward: i.isReward ?? false,
      membership: i.membership ?? false,
    })),
    p_payments: checkoutPayments(d.total, d.method, d.giftCard),
    p_customer_id: d.customerId ?? null,
    p_staff_buyer_id: d.staffBuyerId ?? null,
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, saleId: (data as { id: string }).id };
}

/** REQ-057.1 / REQ-057.2 busca la tarjeta de regalo por código (barbero o dueño). */
export async function lookupGiftCard(
  code: string,
): Promise<{ ok: true; card: GiftCardLookup; label: string } | { ok: false; error: string }> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida. Vuelve a entrar." };
  const normalized = normalizeGiftCardCode(code);
  if (!/^[A-HJKMNP-Z2-9]{8}$/.test(normalized)) return giftCardLookupResult(null);
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("gift_card_lookup", {
    p_business_id: session.business.id,
    p_code: normalized,
  });
  if (error) return { ok: false, error: mapError(error) };
  return giftCardLookupResult((data as GiftCardLookup | null) ?? null);
}

/**
 * REQ-047.1 "Nueva venta": busca la ficha por celular y su membresía. No crea fichas nuevas
 * (decisión de Henry, 2026-11-02, design.md §13.5).
 */
export async function findCheckoutCustomer(
  phone: string,
): Promise<{ ok: true; customer: CheckoutCustomer } | { ok: false; error: string }> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida. Vuelve a entrar." };
  const e164 = normalizePhoneCO(phone);
  if (!e164) return { ok: false, error: "Escribe un celular de 10 dígitos que empiece por 3." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("customers")
    .select("id, name")
    .eq("business_id", session.business.id)
    .eq("phone_e164", e164)
    .is("anonymized_at", null)
    .maybeSingle();
  if (!data) return { ok: false, error: "No hay un cliente con ese celular." };
  const ms = await supabase.rpc("membership_status", {
    p_business_id: session.business.id,
    p_customer_id: data.id,
  });
  return {
    ok: true,
    customer: { id: data.id, name: data.name, membership: toMembershipStatus(ms.data) },
  };
}

/** REQ-023.6 "No se cobró" con motivo. */
export async function markUnpaid(ticketId: string, reason: string): Promise<CashResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida. Vuelve a entrar." };
  if (!z.uuid().safeParse(ticketId).success) return { ok: false, error: "Turno no válido." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_ticket_unpaid", {
    p_ticket_id: ticketId,
    p_reason: reason,
  });
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}

// ================================================================ T-045: caja de hoy ====

export type CashDaySummary = {
  day: string;
  byMethod: Record<PaymentMethod, number>;
  total: number;
  services: number;
  products: number;
  rewards: number;
  commission: number;
  cashExpected: number;
  membershipFees: number;
  membershipCuts: { count: number; listValue: number };
  /** REQ-059.1 / REQ-059.2 (0053). */
  giftCardsSold: number;
  giftCardsRedeemed: number;
  moneyIn: number;
  /** REQ-069.2 / REQ-069.3 (0062). */
  productCommission: number;
  staffPurchases: { count: number; total: number; discount: number };
  barbers: {
    barberId: string;
    name: string;
    pct: number;
    services: number;
    sold: number;
    commission: number;
    business: number;
    productsSold: number;
    productCommission: number;
    productPct: number | null;
    toPay: number;
  }[];
  sales: {
    id: string;
    at: string;
    status: "active" | "voided";
    voidedReason: string | null;
    total: number;
    commission: number;
    productCommission: number;
    barberName: string | null;
    staffBuyerName: string | null;
    customerName: string | null;
    items: string;
    methods: string;
  }[];
  closure: {
    id: string;
    closedAt: string;
    cashCounted: number;
    cashExpected: number;
    difference: number;
    totals: unknown;
  } | null;
};

/** REQ-027.1 caja del día (hoy por defecto; REQ-027.4 días pasados en T-046). Solo dueño. */
export async function getCashDay(day?: string): Promise<CashDaySummary | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("cash_day_summary", {
    p_business_id: session.business.id,
    p_day: day ?? null,
  });
  return error ? null : (data as CashDaySummary);
}

/** REQ-026.1 anular una venta del día con motivo (solo dueño). */
export async function voidSale(saleId: string, reason: string): Promise<CashResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: ERRORS.FORBIDDEN };
  if (!z.uuid().safeParse(saleId).success) return { ok: false, error: "Venta no válida." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("void_sale", { p_sale_id: saleId, p_reason: reason });
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}

// ================================================================ T-046: cierre de caja ====

/** REQ-027.2 cerrar la caja del día con el efectivo contado (solo dueño). */
export async function closeCashDay(day: string, cashCounted: number): Promise<CashResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: ERRORS.FORBIDDEN };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Día no válido." };
  if (!Number.isInteger(cashCounted) || cashCounted < 0) {
    return { ok: false, error: "Escribe el efectivo contado en pesos." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("close_cash_day", {
    p_business_id: session.business.id,
    p_day: day,
    p_cash_counted: cashCounted,
  });
  if (error?.message?.includes("ALREADY_CLOSED"))
    return { ok: false, error: "La caja de ese día ya está cerrada." };
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}

/** REQ-027.3 reabrir con motivo: anula el cierre y permite uno nuevo. */
export async function reopenCashDay(day: string, reason: string): Promise<CashResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: ERRORS.FORBIDDEN };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return { ok: false, error: "Día no válido." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("reopen_cash_day", {
    p_business_id: session.business.id,
    p_day: day,
    p_reason: reason,
  });
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}

/** REQ-027.4 cierres pasados. */
export async function getClosures(): Promise<
  { day: string; total: number; difference: number; closedAt: string }[]
> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("cash_closures_list", {
    p_business_id: session.business.id,
    p_limit: 30,
  });
  return (
    (data ?? []) as { business_day: string; total: number; difference: number; closed_at: string }[]
  ).map((c) => ({
    day: c.business_day,
    total: c.total,
    difference: c.difference,
    closedAt: c.closed_at,
  }));
}

// ================================================================ T-047: mis números ====

export type MyNumbersView = {
  barberName: string;
  commissionPct: number;
  today: Totals;
  week: Totals;
  weekStart: string;
  detail: (MyNumbersRow & { items: string })[];
};

/**
 * REQ-025.5 / REQ-029.1 "Mis números": hoy y semana con el detalle de sus ventas. Sin filtro por
 * barbero a propósito: el RLS de sales solo devuelve las suyas (prueba en
 * tests/integration/my-numbers.test.ts con la misma consulta).
 */
export async function getMyNumbers(): Promise<MyNumbersView | null> {
  const session = await getStaffSession();
  if (!session?.barberId) return null;
  const supabase = await createSupabaseServerClient();
  const today = businessDayBogota();
  const weekStart = bogotaWeekStart();
  const [salesRes, barberRes] = await Promise.all([
    supabase
      .from("sales")
      .select(`${MY_NUMBERS_COLUMNS}, sale_items(kind, name, qty, is_reward)`)
      .eq("business_id", session.business.id)
      .gte("business_day", weekStart)
      .order("created_at", { ascending: false })
      .limit(500),
    supabase.from("barbers").select("commission_pct").eq("id", session.barberId).single(),
  ]);
  type Row = Omit<MyNumbersRow, "has_service"> & {
    sale_items: { kind: string; name: string; qty: number; is_reward: boolean }[];
  };
  const rows = ((salesRes.data ?? []) as unknown as Row[])
    // El dueño que también atiende ve todo el negocio por RLS: aquí solo lo de su silla
    .filter((r) => r.barber_id === session.barberId)
    .map((r) => ({
      ...r,
      has_service: r.sale_items.some((i) => i.kind === "service"),
      items: r.sale_items
        .map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}${i.is_reward ? " (premio)" : ""}`)
        .join(", "),
    }));
  const n = summarizeMyNumbers(rows, today, weekStart);
  return {
    barberName: session.barberName ?? "",
    commissionPct: barberRes.data?.commission_pct ?? 0,
    today: n.today,
    week: n.week,
    weekStart,
    detail: n.detail as MyNumbersView["detail"],
  };
}

// ================================================================ T-048: semana ====

export type WeekSummary = {
  weekStart: string;
  weekEnd: string;
  chairs: number;
  openMinutes: number;
  busyMinutes: number;
  occupancyPct: number | null;
  days: { day: string; openMinutes: number; busyMinutes: number; occupancyPct: number }[];
  barbers: {
    barberId: string;
    name: string;
    busyMinutes: number;
    occupancyPct: number;
    services: number;
    sold: number;
    commission: number;
    /** REQ-069.4 (0062). */
    productCommission: number;
    toPay: number;
  }[];
  newCustomers: number;
  repeatCustomers: number;
  lostTickets: number;
  services: number;
  sold: number;
  membershipFees: number;
  membershipCuts: { count: number; listValue: number };
  /** REQ-059.1 / REQ-059.2 (0053). */
  giftCardsSold: number;
  giftCardsRedeemed: number;
  moneyIn: number;
  /** REQ-069.4 (0062). */
  productCommission: number;
  staffPurchases: { count: number; total: number; discount: number };
};

/** REQ-028.1–28.4 resumen de la semana (lunes a domingo) y la anterior para comparar. */
export async function getWeekSummary(
  weekStart?: string,
): Promise<{ current: WeekSummary; previous: WeekSummary } | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  if (weekStart && !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null;
  const supabase = await createSupabaseServerClient();
  const cur = await supabase.rpc("weekly_summary", {
    p_business_id: session.business.id,
    p_week_start: weekStart ?? null,
  });
  if (cur.error || !cur.data) return null;
  const current = cur.data as WeekSummary;
  const prevDay = new Date(`${current.weekStart}T00:00:00Z`);
  prevDay.setUTCDate(prevDay.getUTCDate() - 7);
  const prev = await supabase.rpc("weekly_summary", {
    p_business_id: session.business.id,
    p_week_start: prevDay.toISOString().slice(0, 10),
  });
  return { current, previous: (prev.data as WeekSummary) ?? current };
}
