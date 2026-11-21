/**
 * Envío de "Trabaja con nosotros" (REQ-102.4, REQ-102.5, design §34.1) por la función SQL con
 * service_role (ADR-009). Separado de la server action para probarlo contra Postgres local.
 */
import { GatewayError, type Gateway } from "@/lib/db/gateway";
import type { JobApplication } from "@/lib/domain/jobs";

export type SubmitResult = { ok: true } | { ok: false; error: string };

export { JOB_SENT_MESSAGE } from "./sent-message";

export async function submitJobApplication(
  gw: Gateway,
  slug: string,
  d: JobApplication,
  privacyVersion: string,
  ip: string | null,
): Promise<SubmitResult> {
  try {
    const r = await gw.rpc<string>("submit_job_application", {
      p_slug: slug,
      p_name: d.name,
      p_phone: d.phoneE164,
      p_role: d.role,
      p_years: d.years,
      p_portfolio: d.portfolioUrl,
      p_availability: d.availability,
      p_message: d.message,
      p_privacy_version: privacyVersion,
      p_ip: ip,
    });
    if (r === "rate_limited")
      return { ok: false, error: "Ya recibimos varias postulaciones desde este celular. Intenta mañana." };
    return { ok: true };
  } catch (e) {
    if (e instanceof GatewayError && e.code === "22023")
      return { ok: false, error: "Revisa los datos e intenta otra vez." };
    return { ok: false, error: "No pudimos enviar tu postulación. Intenta otra vez en un momento." };
  }
}
