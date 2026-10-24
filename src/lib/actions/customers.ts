"use server";

import { z } from "zod";
import { getStaffSession } from "@/lib/auth/session";
import {
  toHistoryRows,
  type HistoryRow,
  type HistoryTicket,
  type TicketStatus,
} from "@/lib/domain/customer-history";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- tipos ----

export type CustomerListItem = {
  id: string;
  name: string;
  phoneLast4: string;
  visitsCount: number;
  lastVisitAt: string | null;
  inQueueToday: boolean;
};

export type CustomerView = {
  viewer: { role: "owner" | "barber"; barberId: string | null };
  customer: {
    id: string;
    name: string;
    phone: string;
    visitsCount: number;
    firstVisitAt: string | null;
    lastVisitAt: string | null;
    createdAt: string;
    notes: string;
    preferredBarberId: string | null;
    privacyAcceptedAt: string | null;
    privacyVersion: number | null;
    doNotContact: boolean;
  };
  barbers: { id: string; name: string }[];
  history: HistoryRow[];
};

export type CustomerFormState = { ok?: boolean; error?: string } | undefined;
export type MergeResult = { ok: true } | { ok: false; error: string };

const ERRORS: Record<string, string> = {
  BOTH_REWARDS_PENDING:
    "Las dos fichas tienen un premio sin canjear. Marca uno como canjeado y vuelve a intentar.",
  SAME_CUSTOMER: "Elige una ficha distinta.",
  CUSTOMER_ANONYMIZED: "Una de las fichas fue eliminada y no se puede fusionar.",
  CUSTOMER_NOT_FOUND: "No encontramos esa ficha.",
  CUSTOMER_HAS_ACTIVE_TICKET:
    "Tiene un turno activo. Termina o cancela el turno y vuelve a intentar.",
  FORBIDDEN: "No tienes permiso para esta acción.",
};

function mapError(e: { message?: string } | null): string {
  const key = Object.keys(ERRORS).find((k) => e?.message?.includes(k));
  return key ? ERRORS[key] : "No se pudo guardar. Revisa tu conexión.";
}

type CustomerRow = {
  id: string;
  name: string;
  phone_e164: string;
  visits_count: number;
  last_visit_at: string | null;
};

// ---------------------------------------------------------------- lectura ----

/**
 * REQ-018.3 (dueño: todos los clientes, por nombre o últimos dígitos) y REQ-018.4 (barbero: los
 * de su fila de hoy y los que ha atendido, ADR-016).
 */
export async function searchCustomers(q: string): Promise<CustomerListItem[]> {
  const session = await getStaffSession();
  if (!session) return [];
  const supabase = await createSupabaseServerClient();
  const query = q.trim().slice(0, 60);

  if (session.role === "owner") {
    const { data } = await supabase.rpc("search_customers", {
      p_business_id: session.business.id,
      p_q: query,
      p_limit: 30,
    });
    return ((data ?? []) as CustomerRow[]).map((c) => ({
      id: c.id,
      name: c.name,
      phoneLast4: c.phone_e164.slice(-4),
      visitsCount: c.visits_count,
      lastVisitAt: c.last_visit_at,
      inQueueToday: false,
    }));
  }

  const { data } = await supabase.rpc("barber_customers", { p_q: query, p_limit: 50 });
  return (
    (data ?? []) as {
      id: string;
      name: string;
      phone_last4: string;
      visits_count: number;
      last_visit_at: string | null;
      in_queue_today: boolean;
    }[]
  ).map((c) => ({
    id: c.id,
    name: c.name,
    phoneLast4: c.phone_last4,
    visitsCount: c.visits_count,
    lastVisitAt: c.last_visit_at,
    inQueueToday: c.in_queue_today,
  }));
}

/** REQ-018.2 ficha + historial; REQ-018.4 el barbero solo abre fichas de sus clientes. */
export async function getCustomer(id: string): Promise<CustomerView | null> {
  const session = await getStaffSession();
  if (!session || !z.uuid().safeParse(id).success) return null;
  const supabase = await createSupabaseServerClient();

  if (session.role !== "owner") {
    const { data: allowed } = await supabase.rpc("barber_can_see_customer", {
      p_customer_id: id,
    });
    if (!allowed) return null;
  }

  const [custRes, ticketsRes, barbersRes] = await Promise.all([
    supabase
      .from("customers")
      .select(
        "id, name, phone_e164, visits_count, first_visit_at, last_visit_at, created_at, notes, preferred_barber_id, privacy_accepted_at, privacy_version, do_not_contact, anonymized_at",
      )
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("tickets")
      .select("id, business_day, service_name, assigned_barber_id, status, service_price")
      .eq("customer_id", id)
      .order("business_day", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("barbers")
      .select("id, display_name, is_active")
      .eq("business_id", session.business.id)
      .order("sort_order"),
  ]);

  const c = custRes.data;
  if (!c || c.anonymized_at) return null;
  const barbers = (barbersRes.data ?? []) as {
    id: string;
    display_name: string;
    is_active: boolean;
  }[];
  const names = new Map(barbers.map((b) => [b.id, b.display_name]));

  const tickets: HistoryTicket[] = (
    (ticketsRes.data ?? []) as {
      id: string;
      business_day: string;
      service_name: string;
      assigned_barber_id: string | null;
      status: TicketStatus;
      service_price: number;
    }[]
  ).map((t) => ({
    id: t.id,
    businessDay: t.business_day,
    serviceName: t.service_name,
    barberId: t.assigned_barber_id,
    barberName: t.assigned_barber_id ? (names.get(t.assigned_barber_id) ?? null) : null,
    status: t.status,
    servicePrice: t.service_price,
  }));

  const viewer = { role: session.role, barberId: session.barberId };
  return {
    viewer,
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone_e164,
      visitsCount: c.visits_count,
      firstVisitAt: c.first_visit_at,
      lastVisitAt: c.last_visit_at,
      createdAt: c.created_at,
      notes: c.notes ?? "",
      preferredBarberId: c.preferred_barber_id,
      privacyAcceptedAt: c.privacy_accepted_at,
      privacyVersion: c.privacy_version,
      doNotContact: c.do_not_contact,
    },
    barbers: barbers.filter((b) => b.is_active).map((b) => ({ id: b.id, name: b.display_name })),
    history: toHistoryRows(tickets, viewer),
  };
}

// ---------------------------------------------------------------- escritura ----

const updateSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre.")
    .max(60, "El nombre es muy largo.")
    .optional(),
  notes: z.string().trim().max(500, "Las notas son muy largas (máximo 500 caracteres)."),
  preferred_barber_id: z.union([z.uuid(), z.literal("")]),
});

/** REQ-018.5 el dueño edita nombre y notas; REQ-018.4 el barbero, notas y preferido. */
export async function updateCustomer(
  _prev: CustomerFormState,
  formData: FormData,
): Promise<CustomerFormState> {
  const session = await getStaffSession();
  if (!session) return { error: "Sesión vencida. Vuelve a entrar." };
  const parsed = updateSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { id, name, notes, preferred_barber_id } = parsed.data;
  const supabase = await createSupabaseServerClient();
  if (session.role !== "owner") {
    const { data: allowed } = await supabase.rpc("barber_can_see_customer", { p_customer_id: id });
    if (!allowed) return { error: ERRORS.FORBIDDEN };
  }

  const { data: current } = await supabase
    .from("customers")
    .select("preferred_barber_id, preferred_barber_manual")
    .eq("id", id)
    .maybeSingle();
  if (!current) return { error: "No encontramos esa ficha." };

  const preferred = preferred_barber_id || null;
  const patch: Record<string, unknown> = { notes: notes || null, preferred_barber_id: preferred };
  if (session.role === "owner") {
    if (name) patch.name = name;
    // Un preferido elegido a mano no lo pisa el recálculo automático (REQ-018.1)
    if (preferred !== current.preferred_barber_id) patch.preferred_barber_manual = true;
  }

  const { error, count } = await supabase
    .from("customers")
    .update(patch, { count: "exact" })
    .eq("id", id);
  if (error || count === 0) return { error: mapError(error) };
  return { ok: true };
}

/** REQ-018.5 fusionar dos fichas (solo dueño). `keepId` conserva nombre y celular. */
export async function mergeCustomers(keepId: string, mergeId: string): Promise<MergeResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: ERRORS.FORBIDDEN };
  if (!z.uuid().safeParse(keepId).success || !z.uuid().safeParse(mergeId).success) {
    return { ok: false, error: ERRORS.CUSTOMER_NOT_FOUND };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("merge_customers", {
    p_keep_id: keepId,
    p_merge_id: mergeId,
  });
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}

/** Candidatas para fusionar: búsqueda del dueño con fecha de creación (para preseleccionar). */
export async function findMergeCandidates(
  q: string,
  excludeId: string,
): Promise<(CustomerListItem & { createdAt: string })[]> {
  const session = await getStaffSession();
  if (session?.role !== "owner" || q.trim().length < 2) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("search_customers", {
    p_business_id: session.business.id,
    p_q: q.trim().slice(0, 60),
    p_limit: 10,
  });
  return ((data ?? []) as (CustomerRow & { created_at: string })[])
    .filter((c) => c.id !== excludeId)
    .map((c) => ({
      id: c.id,
      name: c.name,
      phoneLast4: c.phone_e164.slice(-4),
      visitsCount: c.visits_count,
      lastVisitAt: c.last_visit_at,
      inQueueToday: false,
      createdAt: c.created_at,
    }));
}

/**
 * REQ-018.6 (Ley 1581): elimina los datos personales de la ficha a solicitud del cliente.
 * Nombre y celular se anonimizan en la ficha y en los turnos; montos y conteos se conservan.
 */
export async function anonymizeCustomer(id: string): Promise<MergeResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: ERRORS.FORBIDDEN };
  if (!z.uuid().safeParse(id).success) return { ok: false, error: ERRORS.CUSTOMER_NOT_FOUND };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("anonymize_customer", { p_customer_id: id });
  return error ? { ok: false, error: mapError(error) } : { ok: true };
}
