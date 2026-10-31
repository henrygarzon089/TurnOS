"use server";

import { getStaffSession } from "@/lib/auth/session";
import { capableByService, positions } from "@/lib/domain/queue-estimate";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- tipos ----

export type QueueTicket = {
  id: string;
  displayNumber: number;
  customerName: string;
  customerPhone: string | null;
  serviceName: string;
  serviceDurationMin: number;
  serviceId: string;
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
  customerId: string | null;
  /** REQ-019.3: el cliente tiene el premio de fidelidad disponible. */
  rewardAvailable: boolean;
  /** REQ-020.5: el cliente pidió no ser contactado (sin botón "Avisar"). */
  doNotContact: boolean;
  /** REQ-038.5: bebida de cortesía del turno. */
  courtesyName: string | null;
  courtesyServed: boolean;
};

export type BarberQueueView = {
  barber: { id: string; name: string; status: "available" | "busy" | "paused" | "off" };
  business: { id: string; name: string; slug: string; graceMinutes: number };
  current: QueueTicket | null;
  waiting: QueueTicket[];
  /** Clientes en espera que lo eligieron a él (para la hoja de pausa, REQ-010.2). */
  mineWaiting: number;
  /** REQ-023.6 turnos que atendió y siguen con cobro pendiente. */
  pendingPayments: QueueTicket[];
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
  service_id: string;
  status: QueueTicket["status"];
  created_at: string;
  called_at: string | null;
  started_at: string | null;
  notified_at: string | null;
  payment_status: QueueTicket["paymentStatus"];
  public_token: string;
  queue_order: number;
  customer_id: string | null;
  courtesy_product_id: string | null;
  courtesy_served_at: string | null;
};

const TICKET_COLS =
  "id, display_number, customer_name, customer_phone_e164, service_name, service_duration_min, preferred_barber_id, assigned_barber_id, service_id, status, created_at, called_at, started_at, notified_at, payment_status, public_token, queue_order, customer_id, courtesy_product_id, courtesy_served_at";

function toTicket(
  r: TicketRow,
  ahead: number,
  courtesyNames = new Map<string, string>(),
): QueueTicket {
  return {
    id: r.id,
    displayNumber: r.display_number,
    customerName: r.customer_name,
    customerPhone: r.customer_phone_e164,
    serviceName: r.service_name,
    serviceDurationMin: r.service_duration_min,
    serviceId: r.service_id,
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
    customerId: r.customer_id ?? null,
    rewardAvailable: false,
    doNotContact: false,
    courtesyName: (r.courtesy_product_id && courtesyNames.get(r.courtesy_product_id)) || null,
    courtesyServed: r.courtesy_served_at !== null,
  };
}

/** REQ-038.5: nombre de las bebidas; incluye productos ya inactivos (REQ-038.7). */
async function fetchCourtesyNames(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  rows: TicketRow[],
): Promise<Map<string, string>> {
  const ids = [...new Set(rows.map((r) => r.courtesy_product_id).filter((id) => id !== null))];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from("products").select("id, name").in("id", ids);
  return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
}

const ERRORS: Record<string, string> = {
  P0005: "No se puede ahora: tienes un turno abierto o no estás disponible.",
  P0006: "No hay nadie en la fila.",
  P0004: "Ese turno ya cambió de estado. Se actualizó la fila.",
  "42501": "No tienes permiso para esta acción.",
  P0010: "Ese barbero no hace ese servicio.", // REQ-035.8 / REQ-035.11
  P0011: "Hoy no hay quién haga ese servicio.", // REQ-035.7
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

  const [barberRes, bizRes, listRes, currentRes, allWaitingRes, tplRes, pendingRes, capRes] =
    await Promise.all([
      supabase
        .from("barbers")
        .select("id, display_name, status")
        .eq("id", session.barberId)
        .single(),
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
        .select("id, queue_order, service_duration_min, preferred_barber_id, service_id")
        .eq("business_id", session.business.id)
        .eq("status", "waiting")
        .order("queue_order"),
      supabase
        .from("message_templates")
        .select("body")
        .eq("business_id", session.business.id)
        .eq("key", "notify_2_turns")
        .maybeSingle(),
      supabase
        .from("tickets")
        .select(TICKET_COLS)
        .eq("assigned_barber_id", session.barberId)
        .eq("status", "done")
        .eq("payment_status", "pending")
        .order("finished_at", { ascending: false })
        .limit(10),
      supabase
        .from("barber_services")
        .select("barber_id, service_id")
        .eq("business_id", session.business.id),
    ]);

  if (barberRes.error || !barberRes.data) return null;

  // Posición global para "cualquiera" y por lista para los preferidos (design.md §4)
  const capable = capableByService(capRes.data ?? []);
  const globalPos = positions(
    (allWaitingRes.data ?? []).map((t) => ({
      id: t.id as string,
      queueOrder: Number(t.queue_order),
      durationMin: t.service_duration_min as number,
      preferredBarberId: (t.preferred_barber_id as string | null) ?? null,
      capableBarberIds: capable.get(t.service_id as string) ?? [],
    })),
  );
  const list = (listRes.data ?? []) as TicketRow[];

  // REQ-019.3 "Premio disponible" y REQ-020.5 "No contactar" en la fila del barbero
  const customerIds = [
    ...new Set(
      [...list, ...(currentRes.data ? [currentRes.data as TicketRow] : [])]
        .map((r) => r.customer_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const [rewardRes, dncRes] = customerIds.length
    ? await Promise.all([
        supabase
          .from("loyalty_cards")
          .select("customer_id")
          .eq("status", "completed")
          .in("customer_id", customerIds),
        supabase.from("customers").select("id").eq("do_not_contact", true).in("id", customerIds),
      ])
    : [{ data: [] as { customer_id: string }[] }, { data: [] as { id: string }[] }];
  const withReward = new Set((rewardRes.data ?? []).map((c) => c.customer_id as string));
  const noContact = new Set((dncRes.data ?? []).map((c) => c.id as string));
  const mark = (t: QueueTicket): QueueTicket => ({
    ...t,
    rewardAvailable: !!t.customerId && withReward.has(t.customerId),
    doNotContact: !!t.customerId && noContact.has(t.customerId),
  });
  const currentRow = (currentRes.data as TicketRow | null) ?? null;
  const courtesyNames = await fetchCourtesyNames(supabase, [
    ...list,
    ...(currentRow ? [currentRow] : []),
  ]);
  const waiting = list.map((r, i) =>
    mark(
      toTicket(r, r.preferred_barber_id ? i : (globalPos.get(r.id) ?? i + 1) - 1, courtesyNames),
    ),
  );

  return {
    barber: {
      id: barberRes.data.id,
      name: barberRes.data.display_name,
      status: barberRes.data.status,
    },
    business: { ...session.business, graceMinutes: bizRes.data?.grace_minutes ?? 5 },
    current: currentRow ? mark(toTicket(currentRow, 0, courtesyNames)) : null,
    waiting,
    mineWaiting: list.filter((r) => r.preferred_barber_id === session.barberId).length,
    pendingPayments: ((pendingRes.data ?? []) as TicketRow[]).map((r) => toTicket(r, 0)),
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

/** REQ-038.5: "Servida ✓". La función es idempotente y no deja desmarcar. */
export async function markCourtesyServed(ticketId: string): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("mark_courtesy_served", { p_ticket_id: ticketId });
  return error ? mapError(error) : { ok: true };
}

// ================================================================ T-025: vista del dueño ====

export type OwnerBarber = {
  id: string;
  name: string;
  status: "available" | "busy" | "paused" | "off";
  isActive: boolean;
};

export type OwnerQueueView = {
  business: {
    id: string;
    name: string;
    slug: string;
    queueOverride: "auto" | "open" | "closed";
    isOpen: boolean;
  };
  barbers: OwnerBarber[];
  active: QueueTicket[]; // waiting + called + in_service, en orden
  /** barberIds: quienes hacen el servicio (REQ-035.11). */
  services: { id: string; name: string; durationMin: number; barberIds: string[] }[];
  pendingPayments: QueueTicket[];
  now: string;
};

/** REQ-012.1: toda la fila del negocio. */
export async function getBusinessQueue(): Promise<OwnerQueueView | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;

  const [bizRes, barbersRes, ticketsRes, servicesRes, openRes, pendingRes, capRes] =
    await Promise.all([
      supabase
        .from("businesses")
        .select("queue_override, queue_override_day")
        .eq("id", biz)
        .single(),
      supabase
        .from("barbers")
        .select("id, display_name, status, is_active")
        .eq("business_id", biz)
        .order("sort_order"),
      supabase
        .from("tickets")
        .select(TICKET_COLS)
        .eq("business_id", biz)
        .in("status", ["waiting", "called", "in_service"])
        .order("queue_order"),
      supabase
        .from("services")
        .select("id, name, duration_min")
        .eq("business_id", biz)
        .eq("is_active", true)
        .order("sort_order"),
      supabase.rpc("is_business_open", { p_business_id: biz }),
      supabase
        .from("tickets")
        .select(TICKET_COLS)
        .eq("business_id", biz)
        .eq("status", "done")
        .eq("payment_status", "pending")
        .order("finished_at", { ascending: false })
        .limit(20),
      supabase.from("barber_services").select("barber_id, service_id").eq("business_id", biz),
    ]);

  const rows = (ticketsRes.data ?? []) as TicketRow[];
  const capable = capableByService(capRes.data ?? []);
  const pos = positions(
    rows
      .filter((r) => r.status === "waiting")
      .map((r) => ({
        id: r.id,
        queueOrder: Number(r.queue_order),
        durationMin: r.service_duration_min,
        preferredBarberId: r.preferred_barber_id,
        capableBarberIds: capable.get(r.service_id) ?? [],
      })),
  );
  const courtesyNames = await fetchCourtesyNames(supabase, rows);
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const override =
    bizRes.data?.queue_override_day === today
      ? (bizRes.data?.queue_override as "auto" | "open" | "closed")
      : "auto";

  return {
    business: { ...session.business, queueOverride: override, isOpen: Boolean(openRes.data) },
    barbers: (barbersRes.data ?? []).map((b) => ({
      id: b.id,
      name: b.display_name,
      status: b.status,
      isActive: b.is_active,
    })),
    active: rows.map((r) => toTicket(r, (pos.get(r.id) ?? 1) - 1, courtesyNames)),
    services: (servicesRes.data ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      durationMin: s.duration_min,
      barberIds: capable.get(s.id) ?? [],
    })),
    pendingPayments: ((pendingRes.data ?? []) as TicketRow[]).map((r) => toTicket(r, 0)),
    now: new Date().toISOString(),
  };
}

async function ownerRpc(fn: string, args: Record<string, unknown>): Promise<ActionResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: "Solo el dueño puede hacer esto." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(fn, args);
  return error ? mapError(error) : { ok: true };
}

/** REQ-012.2: llamar un turno específico con un barbero. */
export async function callTicket(ticketId: string, barberId: string) {
  return ownerRpc("transition_ticket", {
    p_ticket_id: ticketId,
    p_to: "called",
    p_actor: "owner",
    p_reason: null,
    p_barber_id: barberId,
  });
}
/** REQ-012.2: devolver a la fila. */
export async function uncallTicket(ticketId: string) {
  return ownerRpc("transition_ticket", {
    p_ticket_id: ticketId,
    p_to: "waiting",
    p_actor: "owner",
  });
}
/** REQ-012.2: cancelar (motivo negocio). */
export async function cancelTicket(ticketId: string) {
  return ownerRpc("transition_ticket", {
    p_ticket_id: ticketId,
    p_to: "cancelled",
    p_actor: "owner",
    p_reason: "business",
  });
}
/** REQ-012.2: reasignar barbero preferido (null = el que esté libre). Solo en espera. */
export async function reassignTicket(
  ticketId: string,
  barberId: string | null,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: "Solo el dueño puede hacer esto." };
  const supabase = await createSupabaseServerClient();
  const { error, count } = await supabase
    .from("tickets")
    .update({ preferred_barber_id: barberId }, { count: "exact" })
    .eq("id", ticketId)
    .eq("status", "waiting");
  if (error) return mapError(error);
  if (!count) return { ok: false, error: "Solo se reasignan turnos en espera." };
  return { ok: true };
}
/** REQ-012.2 / ADR-012: mover después de otro turno (null = al principio). */
export async function moveTicket(ticketId: string, afterTicketId: string | null) {
  return ownerRpc("reorder_ticket", { p_ticket_id: ticketId, p_after_ticket_id: afterTicketId });
}
/** REQ-012.3 */
export async function addManualTicket(input: {
  name: string;
  phone?: string;
  serviceId: string;
  preferredBarberId?: string | null;
}): Promise<ActionResult> {
  const session = await getStaffSession();
  if (!session) return { ok: false, error: "Sesión vencida." };
  const name = input.name.trim();
  if (name.length < 1 || name.length > 60)
    return { ok: false, error: "Escribe el nombre del cliente." };
  let phone: string | null = null;
  if (input.phone && input.phone.trim()) {
    const { normalizePhoneCO } = await import("@/lib/domain/phone");
    phone = normalizePhoneCO(input.phone);
    if (!phone) return { ok: false, error: "Celular inválido (10 dígitos, empieza por 3)." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("add_manual_ticket", {
    p_business_id: session.business.id,
    p_name: name,
    p_phone: phone,
    p_service_id: input.serviceId,
    p_preferred_barber_id: input.preferredBarberId ?? null,
  });
  if (error)
    return error.code === "23505"
      ? { ok: false, error: "Ese celular ya tiene un turno activo." }
      : mapError(error);
  return { ok: true };
}
/** REQ-012.4: abrir/cerrar la fila hoy. */
export async function setQueueOverride(value: "auto" | "open" | "closed"): Promise<ActionResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: "Solo el dueño puede hacer esto." };
  const supabase = await createSupabaseServerClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const { error } = await supabase
    .from("businesses")
    .update({ queue_override: value, queue_override_day: value === "auto" ? null : today })
    .eq("id", session.business.id);
  if (error) return mapError(error);
  if (value === "closed") {
    // Cancela lo que quede en espera/llamado (REQ-014.1) — la función corre con service_role en cron;
    // aquí la invoca el dueño: transition por cada turno activo.
    const { data } = await supabase
      .from("tickets")
      .select("id")
      .eq("business_id", session.business.id)
      .in("status", ["waiting", "called"]);
    for (const t of data ?? []) {
      await supabase.rpc("transition_ticket", {
        p_ticket_id: t.id,
        p_to: "cancelled",
        p_actor: "owner",
        p_reason: "closing",
      });
    }
  }
  return { ok: true };
}
