import { formatCOP, parseCOP } from "@/lib/domain/money";

/** Configuración de la tarjeta de fidelidad (REQ-019.1, design.md §2.2 `loyalty_programs`). */
export type LoyaltyConfig = {
  enabled: boolean;
  visitsRequired: number;
  rewardType: "free_service" | "discount";
  rewardServiceId: string | null;
  rewardAmount: number | null;
  /** Servicios que suman sello (`services.counts_for_loyalty`). */
  countingServiceIds: string[];
};

type Parsed = { ok: true; value: LoyaltyConfig } | { ok: false; error: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Valida el formulario de /admin/fidelidad. Montos en COP enteros (P9). */
export function parseLoyaltyForm(fd: FormData): Parsed {
  const enabled = fd.get("enabled") === "on";
  const visits = Number(fd.get("visits_required"));
  if (!Number.isInteger(visits) || visits < 2 || visits > 50) {
    return { ok: false, error: "Las visitas necesarias deben estar entre 2 y 50." };
  }
  const rewardType = fd.get("reward_type") === "discount" ? "discount" : "free_service";
  const serviceRaw = String(fd.get("reward_service_id") ?? "");
  const rewardServiceId =
    rewardType === "free_service" && UUID.test(serviceRaw) ? serviceRaw : null;
  const amount = rewardType === "discount" ? parseCOP(String(fd.get("reward_amount") ?? "")) : null;
  const countingServiceIds = fd
    .getAll("counts")
    .map(String)
    .filter((id) => UUID.test(id));

  if (enabled && rewardType === "free_service" && !rewardServiceId) {
    return { ok: false, error: "Elige qué servicio se regala." };
  }
  if (enabled && rewardType === "discount" && (amount === null || amount <= 0)) {
    return { ok: false, error: "Escribe el valor del descuento en pesos." };
  }
  return {
    ok: true,
    value: {
      enabled,
      visitsRequired: visits,
      rewardType,
      rewardServiceId,
      rewardAmount: rewardType === "discount" && amount && amount > 0 ? amount : null,
      countingServiceIds,
    },
  };
}

/** Estado de la tarjeta de un cliente, tal como lo devuelve `customer_loyalty()` (0017). */
export type LoyaltyStatus = {
  enabled: boolean;
  stamps: number;
  required: number;
  available: boolean;
  rewardType: "free_service" | "discount";
  rewardServiceName: string | null;
  rewardAmount: number | null;
  cardId: string | null;
};

/** Normaliza el JSON de `customer_loyalty()`; null si no hay ficha. */
export function toLoyaltyStatus(raw: unknown): LoyaltyStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (!r.enabled) {
    return {
      enabled: false,
      stamps: 0,
      required: 0,
      available: false,
      rewardType: "free_service",
      rewardServiceName: null,
      rewardAmount: null,
      cardId: null,
    };
  }
  return {
    enabled: true,
    stamps: Number(r.stamps ?? 0),
    required: Number(r.required ?? 0),
    available: Boolean(r.available),
    rewardType: r.rewardType === "discount" ? "discount" : "free_service",
    rewardServiceName: (r.rewardServiceName as string | null) ?? null,
    rewardAmount: r.rewardAmount == null ? null : Number(r.rewardAmount),
    cardId: (r.cardId as string | null) ?? null,
  };
}

/** REQ-019.7 "7 de 10 cortes" · REQ-019.3 "¡Tu próximo corte es gratis!". */
export function loyaltyText(
  l: LoyaltyStatus | null,
): { progress: string; reward: string | null } | null {
  if (!l || !l.enabled) return null;
  const progress = `${Math.min(l.stamps, l.required)} de ${l.required} cortes`;
  if (!l.available) return { progress, reward: null };
  const reward =
    l.rewardType === "discount" && l.rewardAmount
      ? `¡Tienes ${formatCOP(l.rewardAmount)} de descuento en tu próxima visita!`
      : `¡Tu próximo ${(l.rewardServiceName ?? "corte").toLowerCase()} es gratis!`;
  return { progress, reward };
}
