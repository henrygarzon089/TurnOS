"use server";

import { getStaffSession } from "@/lib/auth/session";
import { positions } from "@/lib/domain/queue-estimate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- tipos ----

export type QueueTicket = {
  id: string;
  displayNumber: number;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  serviceDurationMin: number;
  preferredBarberId: string | null;
  assignedBarberId: string | null;
  status: "waiting" | "called" | "in_service" | "done" | "cancelled" | "no_show";
  createdAt: string;
  calledAt: string | null;
  startedAt: string | null;
  notifiedAt: string | null;
  paymentStatus: "n/a" | "pending" | "paid" | "unpaid";
  publicToken: string;
  /** Personas delante en la lista relevante (REQ-009.1). */
  ahead: number;
};

export type BarberQueueView = {
  barber: { id: string; name: string; status: "available" | "busy" | "paused" | "off" };
  business: { id: string; name: string; slug: string; graceMinutes: number };
  current: QueueTicket | null;
  waiting: QueueTicket[];
  /** Clientes en espera que lo eligieron a él (para la hoja de pausa, REQ-010.2). */
  mineWaiting: number;
  template: string;
  now: string;
};

export type ActionResult = { ok: true } | { ok: false; error: string; code?: string };

type TicketRow = {
  id: string;
  display_number: number;
  customer_name: string;
  customer_phone_e164: string | null;
  service_name: string;
  service_duration_min: number;
  preferred_barber_id: string | null;
  assigned_barber_id: string | null;
  status: QueueTicket["status"];
  created_at: string;
  called_at: string | null;
  started_at: string | null;
  notified_at: string | null;
  payment_status: QueueTicket["paymentStatus"];
  public_token: string;
  queue_order: number;
};

const TICKET_COLS =
  "id, display_number, customer_name, customer_phone_e164, service_name, service_duration_min, preferred_barber_id, assigned_barber_id, status, created_at, called_at, started_at, notified_at, payment_status, public_token, queue_order";

function toTicket(r: TicketRow, ahead: number): QueueTicket {
  return {
    id: r.id,
    displayNumber: r.display_number,
    customerName: r.customer_name,
    customerPhone: r.customer_phone_e164,
    serviceName: r.service_name,
    serviceDurationMin: r.service_duration_min,
    preferredBarberId: r.preferred_barber_id,
    assignedBarberId: r.assigned_barber_id,
    status: r.status,
    createdAt: r.created_at,
    calledAt: r.called_at,
    startedAt: r.started_at,
    notifiedAt: r.notified_at,
    paymentStatus: r.payment_status,
    publicToken: r.public_token,
    ahead,
  };
}

const ERRORS: Record<string, string> = {
  P0005: "No se puede ahora: tienes un turno abierto o no estás disponible.",
  P0006: "No hay nadie en la fila.",
  P0004: "Ese turno ya cambió de estado. Se actualizó la fila.",
  "42501": "No tienes permiso para esta acción.",
  P0002: "El turno ya no existe.",
};

function mapError(e: { code?: string | null; message?: string } | null): ActionResult {
  const code = e?.code ?? undefined;
  return {
    ok: false,
    error: (code && ERRORS[code]) || "No se pudo guardar. Revisa tu conexión.",
    code,
  };
}

// ---------------------------------------------------------------- lectura ----

/** REQ-006.1–6.2: la fila del barbero con su turno actual. */
export async function getMyQueue(): Promise<BarberQueueView | null> {
  const session = await getStaffSession();
  if (!session?.barberId) return null;
  const supabase = await createSupabaseServerClient();

  const [barberRes, bizRes, listRes, currentRes, allWaitingRes, tplRes] = await Promise.all([
    supabase.from("barbers").select("id, display_name, status").eq("id", session.barberId).single(),
    supabase.from("businesses").select("grace_minutes").eq("id", session.business.id).single(),
    supabase.rpc("barber_queue_tickets", { p_barber_id: session.barberId }),
    supabase
      .from("tickets")
      .select(TICKET_COLS)
      .eq("assigned_barber_id", session.barberId)
      .in("status", ["called", "in_service"])
      .order("called_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("tickets")
      .select("id, queue_order, service_duration_min, preferred_barber_id")
      .eq("business_id", session.business.id)
      .eq("status", "waiting")
      .order("queue_order"),
    supabase
      .from("message_templates")
      .select("body")
      .eq("business_id", session.business.id)
      .eq("key", "notify_2_turns")
      .maybeSingle(),
  ]);

  if (barberRes.error || !barberRes.data) return null;

  // Posición global para "cualquiera" y por lista para los preferidos (design.md §4)
  const globalPos = positions(
    (allWaitingRes.data ?? []).map((t) => ({
      id: t.id as string,
      queueOrder: Number(t.queue_order),
      durationMin: t.service_duration_min as number,
      preferredBarberId: (t.preferred_barber_id as string | null) ?? null,
    })),
  );
  const list = (listRes.data ?? []) as TicketRow[];
  const waiting = list.map((r, i) =>
    toTicket(r, r.preferred_barber_id ? i : (globalPos.get(r.id) ?? i + 1) - 1),
  );

  return {
    barber: {
      id: barberRes.data.id,
      name: barberRes.data.display_name,
      status: barberRes.data.status,
    },
    business: { ...session.business, graceMinutes: bizRes.data?.grace_minutes ?? 5 },
    current: currentRes.data ? toTicket(currentRes.data as TicketRow, 0) : null,
    waiting,
    mineWaiting: list.filter((r) => r.preferred_barber_id === session.barberId).length,
    template: tplRes.data?.body ?? "",
    now: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------- acciones ----

/** REQ-007.1 */
export async function callNext(): Promise<ActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("call_next");
  return error ? mapError(error) : { ok: true };
}

async function transition(ticketId: string, to: string, reason?: string): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida. Vuelve a entrar." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("transition_ticket", {
    p_ticket_id: ticketId,
    p_to: to,
    p_actor: session.role === "owner" ? "owner" : "barber",
    p_reason: reason ?? null,
  });
  return error ? mapError(error) : { ok: true };
}

/** REQ-007.3 */
export async function startService(ticketId: string) {
  return transition(ticketId, "in_service");
}
/** REQ-007.4 */
export async function finishService(ticketId: string) {
  return transition(ticketId, "done");
}
/** REQ-008.2 */
export async function markNoShow(ticketId: string) {
  return transition(ticketId, "no_show");
}

/** REQ-010 */
export async function setMyStatus(
  status: "available" | "paused" | "off",
  reassign = false,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session?.barberId) return { ok: false, error: "No tienes silla asignada." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("set_barber_status", {
    p_barber_id: session.barberId,
    p_status: status,
    p_reassign: reassign,
  });
  return error ? mapError(error) : { ok: true };
}

/** REQ-009.3: registrar que se envió el aviso por WhatsApp. */
export async function markNotified(ticketId: string): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_ticket_notified", { p_ticket_id: ticketId });
  return error ? mapError(error) : { ok: true };
}
