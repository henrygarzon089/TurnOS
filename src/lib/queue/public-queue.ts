/**
 * Lógica de las acciones públicas de la fila (REQ-001, REQ-003, REQ-004, REQ-005, ADR-009).
 * Sin dependencias de Next: recibe un Gateway y devuelve resultados tipados o errores conocidos.
 */
import { z } from "zod";
import { toLoyaltyStatus, type LoyaltyStatus } from "@/lib/domain/loyalty";
import { GatewayError, type Gateway } from "@/lib/db/gateway";
import { normalizePhoneCO } from "@/lib/domain/phone";
import {
  estimateNewTicket,
  estimateQueue,
  type BarberState,
  type Estimate,
  type WaitingTicket,
} from "@/lib/domain/queue-estimate";

// ----------------------------------------------------------------- tipos ----

export type QueueSnapshot = {
  barbers: (BarberState & { name: string })[];
  waiting: (WaitingTicket & { displayNumber: number })[];
};

export type PublicBusiness = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  pwaName: string;
  isOpen: boolean;
  nextOpening: string | null;
  closesAt: string | null;
  privacyVersion: number | null;
  /** barberIds: quienes hacen el servicio (REQ-035.6); falta en datos viejos = todos. */
  services: {
    id: string;
    name: string;
    durationMin: number;
    price: number;
    barberIds?: string[];
  }[];
  queue: QueueSnapshot;
  /** Derivados */
  waitingCount: number;
  /** Estimado para quien tome turno ahora con el servicio más común (el primero), o null. */
  estimatedWaitMin: number | null;
  barbersToday: { id: string; name: string; status: BarberState["status"] }[];
};

export type TicketStatus = "waiting" | "called" | "in_service" | "done" | "cancelled" | "no_show";

export type MyTicket = {
  id: string;
  business: { id: string; name: string; slug: string; graceMinutes: number };
  displayNumber: number;
  customerName: string;
  serviceName: string;
  serviceDurationMin: number;
  preferredBarberId: string | null;
  preferredBarberName: string | null;
  assignedBarberId: string | null;
  assignedBarberName: string | null;
  status: TicketStatus;
  createdAt: string;
  calledAt: string | null;
  cancelReason: "customer" | "business" | "closing" | "barber_removed" | null;
  /** Solo mientras está en espera */
  estimate: Estimate | null;
  /** REQ-019.7 progreso de la tarjeta del cliente (null si no hay ficha) */
  loyalty: LoyaltyStatus | null;
  /** REQ-036.2: solo con el turno terminado y enlace guardado */
  googleReviewUrl: string | null;
};

export type JoinResult =
  | { ok: true; token: string; existing: boolean }
  | {
      ok: false;
      error: string;
      field?: "name" | "phone" | "serviceId" | "preferredBarberId" | "privacyAccepted";
    };

export const joinSchema = z.object({
  slug: z.string().regex(/^[a-z0-9-]{3,40}$/),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(60, "El nombre es muy largo."),
  phone: z.string().trim().min(1, "Escribe tu celular."),
  serviceId: z.string().uuid("Elige un servicio."),
  preferredBarberId: z.string().uuid().nullable().optional(),
  privacyAccepted: z.boolean(),
  privacyVersion: z.number().int().nullable().optional(),
  source: z.enum(["qr", "link"]).default("qr"),
});
export type JoinInput = z.input<typeof joinSchema>;

// ----------------------------------------------------------------- límites ----

export const RATE_LIMITS = {
  phonePerHour: 5,
  ipPerHour: 30,
} as const;

// ----------------------------------------------------------------- lógica ----

function toSnapshot(raw: unknown): QueueSnapshot {
  const r = (raw ?? {}) as { barbers?: unknown[]; waiting?: unknown[] };
  return {
    barbers: ((r.barbers ?? []) as QueueSnapshot["barbers"]).map((b) => ({
      id: b.id,
      name: b.name,
      status: b.status,
      busyUntil: b.busyUntil ?? null,
    })),
    waiting: ((r.waiting ?? []) as QueueSnapshot["waiting"]).map((t) => ({
      id: t.id,
      queueOrder: Number(t.queueOrder),
      durationMin: Number(t.durationMin),
      preferredBarberId: t.preferredBarberId ?? null,
      capableBarberIds: t.capableBarberIds ?? null,
      displayNumber: Number(t.displayNumber),
    })),
  };
}

/** REQ-001.1 */
export async function getPublicBusiness(
  gw: Gateway,
  slug: string,
  now = new Date(),
): Promise<PublicBusiness | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const raw = await gw.rpc<Record<string, unknown> | null>("get_public_business", { p_slug: slug });
  if (!raw) return null;
  const queue = toSnapshot(raw.queue);
  const services = (raw.services ?? []) as PublicBusiness["services"];
  const first = services[0];
  const est = first
    ? estimateNewTicket(
        { now, barbers: queue.barbers, waiting: queue.waiting },
        first.durationMin,
        null,
        first.barberIds ?? null,
      )
    : null;
  return {
    id: String(raw.id),
    name: String(raw.name),
    slug: String(raw.slug),
    address: (raw.address as string | null) ?? null,
    pwaName: String(raw.pwaName ?? raw.name),
    isOpen: Boolean(raw.isOpen),
    nextOpening: (raw.nextOpening as string | null) ?? null,
    closesAt: (raw.closesAt as string | null) ?? null,
    privacyVersion: (raw.privacyVersion as number | null) ?? null,
    services,
    queue,
    waitingCount: queue.waiting.length,
    estimatedWaitMin: est?.waitMin ?? null,
    barbersToday: queue.barbers
      .filter((b) => b.status !== "off")
      .map((b) => ({ id: b.id, name: b.name, status: b.status })),
  };
}

/**
 * REQ-022.1: barbero preferido del cliente que vuelve (por el celular guardado en su navegador).
 * Solo el id, y solo si el barbero atiende hoy y no está en pausa; si no, null ("El que esté libre").
 */
export async function getPreferredBarber(
  gw: Gateway,
  slug: string,
  phone: string,
): Promise<string | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const e164 = normalizePhoneCO(phone);
  if (!e164) return null;
  const id = await gw.rpc<string | null>("get_preferred_barber", { p_slug: slug, p_phone: e164 });
  return id ?? null;
}

/** REQ-003.2–3.5, NFR-004 */
export async function joinQueue(
  gw: Gateway,
  input: JoinInput,
  ip: string | null,
): Promise<JoinResult> {
  const parsed = joinSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return {
      ok: false,
      error: issue?.message ?? "Revisa los datos.",
      field: issue?.path[0] as JoinResult extends { field?: infer F } ? F : never,
    };
  }
  const d = parsed.data;
  if (!d.privacyAccepted) {
    return {
      ok: false,
      error: "Debes aceptar el aviso de privacidad para tomar turno.",
      field: "privacyAccepted",
    };
  }
  const phone = normalizePhoneCO(d.phone);
  if (!phone) {
    return {
      ok: false,
      error: "Escribe un celular colombiano de 10 dígitos (empieza por 3).",
      field: "phone",
    };
  }

  // Rate limiting (NFR-004): por celular y por IP
  const okPhone = await gw.rpc<boolean>("check_rate_limit", {
    p_key: `phone:${phone}`,
    p_limit: RATE_LIMITS.phonePerHour,
  });
  const okIp = ip
    ? await gw.rpc<boolean>("check_rate_limit", {
        p_key: `ip:${ip}`,
        p_limit: RATE_LIMITS.ipPerHour,
      })
    : true;
  if (!okPhone || !okIp) {
    return { ok: false, error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." };
  }

  try {
    const r = await gw.rpc<{ token: string; existing: boolean }>("join_queue", {
      p_slug: d.slug,
      p_name: d.name,
      p_phone: phone,
      p_service_id: d.serviceId,
      p_preferred_barber_id: d.preferredBarberId ?? null,
      p_privacy_version: d.privacyVersion ?? null,
      p_source: d.source,
    });
    return { ok: true, token: r.token, existing: Boolean(r.existing) };
  } catch (e) {
    if (e instanceof GatewayError) {
      switch (e.code) {
        case "P0007":
          return { ok: false, error: "El negocio está cerrado en este momento." };
        case "P0005":
          return {
            ok: false,
            error: "Ese barbero no está disponible ahora. Elige otro o 'el que esté libre'.",
            field: "preferredBarberId",
          };
        case "P0002":
          return { ok: false, error: "No encontramos el negocio o el servicio." };
        case "P0010": // REQ-035.8
          return {
            ok: false,
            error: "Ese barbero no hace ese servicio. Elige otro o 'el que esté libre'.",
            field: "preferredBarberId",
          };
        case "P0011": // REQ-035.7
          return {
            ok: false,
            error: "Hoy no hay quién haga ese servicio. Elige otro.",
            field: "serviceId",
          };
      }
    }
    throw e;
  }
}

/** REQ-004.1, REQ-004.7 */
export async function getTicketByToken(
  gw: Gateway,
  token: string,
  now = new Date(),
): Promise<MyTicket | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  const raw = await gw.rpc<Record<string, unknown> | null>("get_ticket_by_token", {
    p_token: token,
  });
  if (!raw) return null;
  const queue = toSnapshot(raw.queue);
  const status = raw.status as TicketStatus;
  let estimate: Estimate | null = null;
  if (status === "waiting") {
    estimate =
      estimateQueue({ now, barbers: queue.barbers, waiting: queue.waiting }).find(
        (e) => e.id === raw.id,
      ) ?? null;
  }
  const biz = raw.business as MyTicket["business"];
  return {
    id: String(raw.id),
    business: biz,
    displayNumber: Number(raw.displayNumber),
    customerName: String(raw.customerName),
    serviceName: String(raw.serviceName),
    serviceDurationMin: Number(raw.serviceDurationMin),
    preferredBarberId: (raw.preferredBarberId as string | null) ?? null,
    preferredBarberName: (raw.preferredBarberName as string | null) ?? null,
    assignedBarberId: (raw.assignedBarberId as string | null) ?? null,
    assignedBarberName: (raw.assignedBarberName as string | null) ?? null,
    status,
    createdAt: String(raw.createdAt),
    calledAt: (raw.calledAt as string | null) ?? null,
    cancelReason: (raw.cancelReason as MyTicket["cancelReason"]) ?? null,
    estimate,
    loyalty: toLoyaltyStatus(raw.loyalty),
    googleReviewUrl: (raw.googleReviewUrl as string | null) ?? null,
  };
}

/** REQ-005.2 */
export async function cancelTicketByToken(
  gw: Gateway,
  token: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return { ok: false, error: "Turno no válido." };
  try {
    await gw.rpc("cancel_ticket_by_token", { p_token: token });
    return { ok: true };
  } catch (e) {
    if (e instanceof GatewayError) {
      if (e.code === "P0004") return { ok: false, error: "Este turno ya no se puede cancelar." };
      if (e.code === "P0002") return { ok: false, error: "Este turno no existe." };
    }
    throw e;
  }
}
