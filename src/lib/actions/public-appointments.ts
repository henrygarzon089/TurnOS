"use server";

import { headers } from "next/headers";
import { createAdminGateway } from "@/lib/db/supabase-gateway";
import * as appts from "@/lib/queue/appointments";

// Citas desde la portada y "Mi cita" (REQ-050, REQ-051, ADR-009): service_role + funciones SQL.

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/** REQ-050.1 */
export async function getAppointmentInfo(slug: string) {
  return appts.getAppointmentInfo(createAdminGateway(), slug);
}

/** REQ-049.3, 049.4 */
export async function getAppointmentSlots(
  slug: string,
  serviceId: string,
  barberId: string | null,
  day: string,
) {
  return appts.getAppointmentSlots(createAdminGateway(), slug, serviceId, barberId, day);
}

/** REQ-050.2–050.5, 050.7 */
export async function bookAppointment(input: appts.BookInput) {
  return appts.bookAppointment(createAdminGateway(), input, await clientIp());
}

/** REQ-051.1 */
export async function getAppointmentByToken(token: string) {
  return appts.getAppointmentByToken(createAdminGateway(), token);
}

/** REQ-051.2 */
export async function cancelAppointmentByToken(token: string) {
  return appts.cancelAppointmentByToken(createAdminGateway(), token);
}
