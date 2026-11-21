"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { getStaffSession } from "@/lib/auth/session";
import { createAdminGateway } from "@/lib/db/supabase-gateway";
import { JOB_STATUSES, parseJobApplication, type JobField, type JobStatus } from "@/lib/domain/jobs";
import { homeSlug, isModuleEnabled } from "@/lib/domain/modules";
import { phoneCountryOf } from "@/lib/domain/phone";
import { submitJobApplication } from "@/lib/jobs/submit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// "Trabaja con nosotros" (REQ-102, ADR-079): envío público con service_role y acciones del dueño.

export type JobFormState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; message?: string; errors: Partial<Record<JobField, string>> };

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/** REQ-102.3 / REQ-102.4 / REQ-102.5 */
export async function applyForJob(_prev: JobFormState, formData: FormData): Promise<JobFormState> {
  if (!isModuleEnabled("jobs"))
    return { status: "error", message: "Por ahora no estamos recibiendo postulaciones.", errors: {} };
  const s = (k: string) => String(formData.get(k) ?? "");
  const parsed = parseJobApplication({
    name: s("name"),
    phone: s("phone"),
    phoneCountry: phoneCountryOf(formData),
    role: s("role"),
    years: s("years"),
    portfolio: s("portfolio"),
    availability: s("availability"),
    message: s("message"),
    privacyAccepted: formData.get("privacyAccepted") === "on",
    website: s("website"),
  });
  // REQ-102.5: a un robot se le responde igual, sin guardar nada
  if (!parsed.ok && parsed.spam) return { status: "sent" };
  if (!parsed.ok) return { status: "error", errors: parsed.errors };
  const r = await submitJobApplication(
    createAdminGateway(),
    homeSlug(),
    parsed.data,
    s("privacyVersion") || "1",
    await clientIp(),
  );
  return r.ok ? { status: "sent" } : { status: "error", message: r.error, errors: {} };
}

async function ownerClient() {
  const session = await getStaffSession();
  if (session?.role !== "owner") return null;
  return createSupabaseServerClient();
}

/** REQ-102.6 marcar contactada, descartada o volver a nueva. */
export async function setJobStatus(id: string, status: JobStatus): Promise<{ error?: string }> {
  if (!(JOB_STATUSES as readonly string[]).includes(status)) return { error: "Estado no válido." };
  const supabase = await ownerClient();
  if (!supabase) return { error: "Solo el dueño puede cambiar las postulaciones." };
  const { error } = await supabase.rpc("set_job_application_status", { p_id: id, p_status: status });
  if (error) return { error: "No se pudo cambiar la postulación." };
  revalidatePath("/admin/postulaciones");
  return {};
}

/** REQ-102.6 / REQ-102.7 borrar (supresión). */
export async function deleteJob(id: string): Promise<{ error?: string }> {
  const supabase = await ownerClient();
  if (!supabase) return { error: "Solo el dueño puede borrar postulaciones." };
  const { error } = await supabase.rpc("delete_job_application", { p_id: id });
  if (error) return { error: "No se pudo borrar la postulación." };
  revalidatePath("/admin/postulaciones");
  return {};
}
