/**
 * Lógica pública de las citas (REQ-050, REQ-051, design.md §14.3, ADR-009). Sin dependencias de
 * Next: recibe un Gateway (service_role en producción, Postgres local en integración).
 */
import { z } from "zod";
import { appointmentErrorMessage, type AppointmentStatus } from "@/lib/domain/appointments";
import { normalizePhoneCO } from "@/lib/domain/phone";
import { GatewayError, type Gateway } from "@/lib/db/gateway";
import { RATE_LIMITS } from "./public-queue";

// ----------------------------------------------------------------- tipos ----

export type AppointmentInfo = {
  enabled: boolean;
  barbers: { id: string; name: string; serviceIds: string[] }[];
  /** Días de hoy a +7 con horario (REQ-049.4, 049.5), `YYYY-MM-DD`. */
  openDays: string[];
};

export type Slot = { startsAt: string; barberIds: string[] };

export type PublicAppointment = {
  id: string;
  status: AppointmentStatus;
  lapsed: boolean;
  startsAt: string;
  endsAt: string;
  durationMin: number;
  serviceName: string;
  price: number;
  customerName: string;
  barberName: string;
  cancelReason: "customer" | "business" | null;
  /** Token de "Mi turno" cuando la cita ya llegó (REQ-051.4). */
  ticketToken: string | null;
  business: { name: string; slug: string; address: string | null };
};

export const bookSchema = z.object({
  slug: z.string().min(1),
  serviceId: z.string().uuid({ message: "Elige un servicio." }),
  barberId: z.string().uuid().nullable(),
  startsAt: z.string().min(1, "Elige una hora."),
  name: z.string().trim().min(2, "Escribe tu nombre.").max(60),
  phone: z.string().min(1, "Escribe tu celular."),
  privacyAccepted: z.boolean(),
  privacyVersion: z.number().int().nullable().optional(),
});
export type BookInput = z.infer<typeof bookSchema>;

export type BookResult =
  | { ok: true; token: string; existing: boolean }
  | {
      ok: false;
      error: string;
      field?: "name" | "phone" | "privacyAccepted" | "startsAt";
      slotTaken?: boolean;
    };

// --------------------------------------------------------------- lectura ----

/** REQ-050.1: si hay citas, con quién y qué días. null = negocio que no existe. */
export async function getAppointmentInfo(
  gw: Gateway,
  slug: string,
): Promise<AppointmentInfo | null> {
  const r = await gw.rpc<AppointmentInfo | null>("public_appointment_info", { p_slug: slug });
  if (!r) return null;
  return { enabled: Boolean(r.enabled), barbers: r.barbers ?? [], openDays: r.openDays ?? [] };
}

/** REQ-049.3, 049.4: horas libres de ese día (mínimo 1 hora desde ahora). */
export async function getAppointmentSlots(
  gw: Gateway,
  slug: string,
  serviceId: string,
  barberId: string | null,
  day: string,
): Promise<Slot[]> {
  const rows = await gw.rpc<{ starts_at: string; barber_ids: string[] }[] | null>(
    "public_appointment_slots_json",
    { p_slug: slug, p_service_id: serviceId, p_barber_id: barberId, p_day: day },
  );
  return (rows ?? []).map((r) => ({
    startsAt: new Date(r.starts_at).toISOString(),
    barberIds: r.barber_ids,
  }));
}

// -------------------------------------------------------------- reservar ----

/** REQ-050.2–050.5, 050.7. Devuelve el token de "Mi cita" (o el de la que ya tiene). */
export async function bookAppointment(
  gw: Gateway,
  input: BookInput,
  ip: string | null,
): Promise<BookResult> {
  const parsed = bookSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path[0];
    return {
      ok: false,
      error: issue?.message ?? "Revisa los datos.",
      field: field === "name" || field === "phone" || field === "startsAt" ? field : undefined,
    };
  }
  const d = parsed.data;
  if (!d.privacyAccepted) {
    return {
      ok: false,
      error: "Debes aceptar el aviso de privacidad para reservar.",
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

  // REQ-050.7 / NFR-004: los mismos topes que tomar turno, con su propia llave
  const okPhone = await gw.rpc<boolean>("check_rate_limit", {
    p_key: `cita-phone:${phone}`,
    p_limit: RATE_LIMITS.phonePerHour,
  });
  const okIp = ip
    ? await gw.rpc<boolean>("check_rate_limit", {
        p_key: `cita-ip:${ip}`,
        p_limit: RATE_LIMITS.ipPerHour,
      })
    : true;
  if (!okPhone || !okIp) {
    return { ok: false, error: "Demasiados intentos. Espera un momento e inténtalo de nuevo." };
  }

  try {
    const r = await gw.rpc<{ token: string; existing: boolean }>("public_book_appointment", {
      p_slug: d.slug,
      p_service_id: d.serviceId,
      p_barber_id: d.barberId,
      p_starts_at: d.startsAt,
      p_name: d.name,
      p_phone: phone,
      p_privacy_version: d.privacyVersion ?? null,
    });
    return { ok: true, token: r.token, existing: Boolean(r.existing) };
  } catch (e) {
    if (e instanceof GatewayError) {
      if (e.code === "P0002") return { ok: false, error: "No encontramos el negocio." };
      const error = appointmentErrorMessage({ message: e.message, code: e.code });
      const slot = e.message.includes("SLOT_");
      return { ok: false, error, field: slot ? "startsAt" : undefined, slotTaken: slot };
    }
    throw e;
  }
}

// --------------------------------------------------------------- Mi cita ----

/** REQ-051.1: null si el token no existe. */
export async function getAppointmentByToken(
  gw: Gateway,
  token: string,
): Promise<PublicAppointment | null> {
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return null;
  return (
    (await gw.rpc<PublicAppointment | null>("get_appointment_by_token", { p_token: token })) ?? null
  );
}

/** REQ-051.2 */
export async function cancelAppointmentByToken(
  gw: Gateway,
  token: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await gw.rpc("cancel_appointment_by_token", { p_token: token });
    return { ok: true };
  } catch (e) {
    if (e instanceof GatewayError) {
      if (e.code === "P0002") return { ok: false, error: "No encontramos esa cita." };
      return { ok: false, error: appointmentErrorMessage({ message: e.message, code: e.code }) };
    }
    throw e;
  }
}
