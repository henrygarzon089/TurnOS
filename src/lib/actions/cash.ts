"use server";

import { z } from "zod";
import { getStaffSession } from "@/lib/auth/session";
import { toLoyaltyStatus, type LoyaltyStatus } from "@/lib/domain/loyalty";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- tipos ----

export type PaymentMethod = "cash" | "nequi" | "transfer" | "card";

export type CatalogItem = { id: string; name: string; price: number };

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
  products: CatalogItem[];
  loyalty: LoyaltyStatus | null;
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
};

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

  const [ticketRes, servicesRes, productsRes, progRes, barbersRes] = await Promise.all([
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
      .select("id, name, price")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("sort_order"),
    supabase
      .from("products")
      .select("id, name, price")
      .eq("business_id", biz)
      .eq("is_active", true)
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
    services: (servicesRes.data ?? []) as CatalogItem[],
    products: (productsRes.data ?? []) as CatalogItem[],
    loyalty,
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
});
const saleSchema = z.object({
  ticketId: z.uuid().nullable(),
  barberId: z.uuid().nullable(),
  items: z.array(lineSchema).min(1, ERRORS.EMPTY_SALE),
  method: z.enum(["cash", "nequi", "transfer", "card"]),
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
    })),
    p_payments: d.total > 0 ? [{ method: d.method, amount: d.total }] : [],
  });
  if (error) return { ok: false, error: mapError(error) };
  return { ok: true, saleId: (data as { id: string }).id };
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
  barbers: {
    barberId: string;
    name: string;
    pct: number;
    services: number;
    sold: number;
    commission: number;
    business: number;
  }[];
  sales: {
    id: string;
    at: string;
    status: "active" | "voided";
    voidedReason: string | null;
    total: number;
    commission: number;
    barberName: string | null;
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
