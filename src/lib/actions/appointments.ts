"use server";

import { revalidatePath } from "next/cache";
import { getStaffSession } from "@/lib/auth/session";
import { appointmentErrorMessage, parseAppointmentSettingsForm } from "@/lib/domain/appointments";
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
