"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { barberEmailFromPhone } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type InvitationRow = {
  barber_id: string;
  barber_name: string;
  barber_phone: string | null;
  business_name: string;
  business_slug: string;
  is_valid: boolean;
};

async function fetchInvitationRow(token: string): Promise<InvitationRow | null> {
  const admin = createSupabaseAdminClient();
  const { data } = (await admin.rpc("get_invitation", { p_token: token }).maybeSingle()) as {
    data: InvitationRow | null;
  };
  return data;
}

export type InvitationInfo = {
  barberName: string;
  businessName: string;
  businessSlug: string;
  isValid: boolean;
};

/** Datos mínimos de una invitación para la pantalla /invitacion/[token]. */
export async function getInvitation(token: string): Promise<InvitationInfo | null> {
  if (!/^[A-Za-z0-9_-]{8,64}$/.test(token)) return null;
  const data = await fetchInvitationRow(token);
  if (!data) return null;
  return {
    barberName: data.barber_name,
    businessName: data.business_name,
    businessSlug: data.business_slug,
    isValid: data.is_valid,
  };
}

const acceptSchema = z.object({
  token: z.string(),
  pin: z.string().regex(/^\d{6}$/, "El PIN son 6 números."),
  pin2: z.string(),
});

export type AcceptState = { error?: string } | undefined;

/**
 * REQ-030.2 / ADR-010: el barbero elige su PIN. Se crea (o actualiza) su cuenta alias en Auth,
 * se vincula con accept_invitation y se inicia sesión.
 */
export async function acceptInvitation(
  _prev: AcceptState,
  formData: FormData,
): Promise<AcceptState> {
  const parsed = acceptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data.pin !== parsed.data.pin2) return { error: "Los dos PIN no coinciden." };
  if (/^(\d)\1{5}$/.test(parsed.data.pin) || parsed.data.pin === "123456") {
    return { error: "Elige un PIN menos obvio (no repitas el mismo número ni uses 123456)." };
  }

  const admin = createSupabaseAdminClient();
  const info = await fetchInvitationRow(parsed.data.token);
  if (!info || !info.is_valid) return { error: "Esta invitación ya no es válida." };

  // Celular del barbero → correo alias (ADR-010)
  if (!info.barber_phone) return { error: "El barbero no tiene celular registrado." };
  const email = barberEmailFromPhone(info.barber_phone);

  let userId: string | undefined;
  const created = await admin.auth.admin.createUser({
    email,
    password: parsed.data.pin,
    email_confirm: true,
  });
  if (created.error) {
    // Ya existía (reinvitación): actualizamos el PIN.
    const list = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existing = list.data?.users.find((u) => u.email === email);
    if (!existing) return { error: "No se pudo crear tu acceso." };
    const upd = await admin.auth.admin.updateUserById(existing.id, { password: parsed.data.pin });
    if (upd.error) return { error: "No se pudo guardar tu PIN." };
    userId = existing.id;
  } else {
    userId = created.data.user.id;
  }

  const accepted = await admin.rpc("accept_invitation", {
    p_token: parsed.data.token,
    p_user_id: userId,
  });
  if (accepted.error) return { error: "Esta invitación ya no es válida." };

  const supabase = await createSupabaseServerClient();
  const signed = await supabase.auth.signInWithPassword({ email, password: parsed.data.pin });
  if (signed.error) return { error: "Tu acceso quedó creado; entra con tu celular y PIN." };
  redirect("/app/fila");
}
