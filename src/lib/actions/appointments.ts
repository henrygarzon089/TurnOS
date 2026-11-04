"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "@/lib/auth/session";
import {
  appointmentErrorMessage,
  parseAppointmentSettingsForm,
  type AppointmentStatus,
} from "@/lib/domain/appointments";
import { normalizePhoneCO } from "@/lib/domain/phone";
import { businessDayBogota } from "@/lib/domain/time";
import { afterQueueChange } from "@/lib/notifications/after-queue-change";
import type { Slot } from "@/lib/queue/appointments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ---------------------------------------------------------------- tipos ----

export type AppointmentFormState = { ok?: boolean; error?: string } | undefined;

export type AppointmentSettingsView = {
  enabled: boolean;
  barbers: { id: string; name: string; accepts: boolean }[];
};

const FORBIDDEN = "Solo el dueño puede manejar las citas.";

// ----------------------------------------------------------------- ajustes ----

/** /admin/citas: encendido y barberos activos que reciben citas (REQ-049.1, 049.2). */
export async function getAppointmentSettings(): Promise<AppointmentSettingsView | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const [bizRes, barbersRes] = await Promise.all([
    supabase.from("businesses").select("appointments_enabled").eq("id", biz).single(),
    supabase
      .from("barbers")
      .select("id, display_name, accepts_appointments")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("sort_order")
      .order("display_name"),
  ]);
  return {
    enabled: Boolean(bizRes.data?.appointments_enabled),
    barbers: (barbersRes.data ?? []).map((b) => ({
      id: b.id as string,
      name: b.display_name as string,
      accepts: Boolean(b.accepts_appointments),
    })),
  };
}

/** REQ-049.1, 049.2, 049.6: solo el dueño; apagar no toca las citas ya reservadas. */
export async function saveAppointmentSettings(
  _prev: AppointmentFormState,
  formData: FormData,
): Promise<AppointmentFormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: FORBIDDEN };
  const s = parseAppointmentSettingsForm(formData);
  if (s.enabled && s.barberIds.length === 0) {
    return { error: "Marca al menos un barbero que reciba citas." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("save_appointment_settings", {
    p_business_id: session.business.id,
    p_enabled: s.enabled,
    p_barber_ids: s.barberIds,
  });
  if (error) return { error: appointmentErrorMessage(error) };
  revalidatePath("/admin/citas");
  return { ok: true };
}

// ------------------------------------------------------------------ agenda ----

/** REQ-054.1, 054.4: fila de appointments_agenda (con celular: solo el dueño la ve). */
export type AgendaItem = {
  id: string;
  day: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  phone: string;
  token: string;
  serviceId: string;
  serviceName: string;
  price: number;
  barberId: string;
  barberName: string;
  anyBarber: boolean;
  status: AppointmentStatus;
  source: "public" | "owner";
  cancelReason: "customer" | "business" | null;
  late: boolean;
  barberUnavailable: boolean;
  dayClosed: boolean;
};

export type AgendaView = {
  today: string;
  businessName: string;
  items: AgendaItem[];
  /** Barberos activos que reciben citas, con los servicios que hacen (REQ-049.3). */
  barbers: { id: string; name: string; serviceIds: string[] }[];
  services: { id: string; name: string; durationMin: number; price: number }[];
  templates: { confirm: string; reminder: string; cancelled: string };
};

export type ActionResult = { ok: true } | { ok: false; error: string };

/** /admin/citas: hoy y los 7 días siguientes (REQ-054.1). */
export async function getAppointmentAgenda(): Promise<AgendaView | null> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  const supabase = await createSupabaseServerClient();
  const biz = session.business.id;
  const today = businessDayBogota(new Date());
  const to = new Date(`${today}T00:00:00Z`);
  to.setUTCDate(to.getUTCDate() + 7);
  const [agendaRes, barbersRes, servicesRes, capRes, tplRes] = await Promise.all([
    supabase.rpc("appointments_agenda", {
      p_business_id: biz,
      p_from: today,
      p_to: to.toISOString().slice(0, 10),
    }),
    supabase
      .from("barbers")
      .select("id, display_name")
      .eq("business_id", biz)
      .eq("is_active", true)
      .eq("accepts_appointments", true)
      .order("sort_order"),
    supabase
      .from("services")
      .select("id, name, duration_min, price")
      .eq("business_id", biz)
      .eq("is_active", true)
      .order("sort_order"),
    supabase.from("barber_services").select("barber_id, service_id").eq("business_id", biz),
    supabase
      .from("message_templates")
      .select("key, body")
      .eq("business_id", biz)
      .in("key", ["appointment_confirm", "appointment_reminder", "appointment_cancelled"]),
  ]);
  const tpl = new Map((tplRes.data ?? []).map((t) => [t.key as string, t.body as string]));
  const cap = capRes.data ?? [];
  return {
    today,
    businessName: session.business.name,
    items: (agendaRes.data as AgendaItem[] | null) ?? [],
    barbers: (barbersRes.data ?? []).map((b) => ({
      id: b.id as string,
      name: b.display_name as string,
      serviceIds: cap.filter((c) => c.barber_id === b.id).map((c) => c.service_id as string),
    })),
    services: (servicesRes.data ?? []).map((x) => ({
      id: x.id as string,
      name: x.name as string,
      durationMin: x.duration_min as number,
      price: x.price as number,
    })),
    templates: {
      confirm: tpl.get("appointment_confirm") ?? "",
      reminder: tpl.get("appointment_reminder") ?? "",
      cancelled: tpl.get("appointment_cancelled") ?? "",
    },
  };
}

/** REQ-050.6: el dueño ve cualquier hora libre que no haya pasado (sin la hora mínima). */
export async function getOwnerSlots(
  serviceId: string,
  barberId: string | null,
  day: string,
): Promise<Slot[]> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.rpc("appointment_slots", {
    p_business_id: session.business.id,
    p_service_id: serviceId,
    p_barber_id: barberId,
    p_day: day,
    p_min_start: new Date().toISOString(),
  });
  return ((data ?? []) as { starts_at: string; barber_ids: string[] }[]).map((r) => ({
    startsAt: new Date(r.starts_at).toISOString(),
    barberIds: r.barber_ids,
  }));
}

export type OwnerBookResult =
  | { ok: true; token: string; existing: boolean; phone: string }
  | { ok: false; error: string; field?: "name" | "phone" | "startsAt" };

/** REQ-050.6: la cita queda a nombre del cliente; el dueño le manda el enlace por wa.me. */
export async function ownerBookAppointment(input: {
  serviceId: string;
  barberId: string | null;
  startsAt: string;
  name: string;
  phone: string;
}): Promise<OwnerBookResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: FORBIDDEN };
  if (input.name.trim().length < 2)
    return { ok: false, error: "Escribe el nombre.", field: "name" };
  const phone = normalizePhoneCO(input.phone);
  if (!phone)
    return {
      ok: false,
      error: "Escribe un celular colombiano de 10 dígitos (empieza por 3).",
      field: "phone",
    };
  if (!input.startsAt) return { ok: false, error: "Elige una hora.", field: "startsAt" };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.rpc("book_appointment", {
    p_business_id: session.business.id,
    p_service_id: input.serviceId,
    p_barber_id: input.barberId,
    p_starts_at: input.startsAt,
    p_name: input.name.trim(),
    p_phone: phone,
  });
  if (error) {
    const slot = error.message.includes("SLOT_");
    return {
      ok: false,
      error: appointmentErrorMessage(error),
      field: slot ? "startsAt" : undefined,
    };
  }
  afterQueueChange(session.business.id); // una cita de hoy cambia el estimado (REQ-053.1)
  revalidatePath("/admin/citas");
  const r = data as { token: string; existing: boolean };
  return { ok: true, token: r.token, existing: Boolean(r.existing), phone };
}

async function ownerAppointmentRpc(
  fn: "cancel_appointment" | "reassign_appointment",
  args: Record<string, unknown>,
): Promise<ActionResult> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { ok: false, error: FORBIDDEN };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc(fn, args);
  if (error) return { ok: false, error: appointmentErrorMessage(error) };
  afterQueueChange(session.business.id);
  revalidatePath("/admin/citas");
  return { ok: true };
}

/** REQ-054.2: el dueño cancela; luego le avisa al cliente por wa.me. */
export async function cancelAppointment(id: string): Promise<ActionResult> {
  return ownerAppointmentRpc("cancel_appointment", { p_id: id });
}

/** REQ-054.2: a otro barbero que reciba citas, haga el servicio y tenga esa hora libre. */
export async function reassignAppointment(id: string, barberId: string): Promise<ActionResult> {
  return ownerAppointmentRpc("reassign_appointment", { p_id: id, p_barber_id: barberId });
}
