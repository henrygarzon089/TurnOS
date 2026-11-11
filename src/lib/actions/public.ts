"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminGateway } from "@/lib/db/supabase-gateway";
import { afterQueueChange } from "@/lib/notifications/after-queue-change";
import { whatsappChannelReady } from "@/lib/notifications/cloud-api";
import * as queue from "@/lib/queue/public-queue";
import * as giftCards from "@/lib/gift-cards/public-gift-card";
import { barberEmailFromPhone } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { normalizeScreenView, type ScreenView } from "@/lib/domain/screen";

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

// ================================================================ T-017: fila pública ====

async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
}

/** REQ-001.1 */
export async function getPublicBusiness(slug: string) {
  const business = await queue.getPublicBusiness(createAdminGateway(), slug);
  if (!business) return null;
  // REQ-043.3
  return {
    ...business,
    whatsappAutoEnabled: business.whatsappAutoEnabled && whatsappChannelReady(),
  };
}

/** REQ-022.1: barbero preferido para preseleccionar en "Tomar turno". */
export async function getPreferredBarber(slug: string, phone: string): Promise<string | null> {
  return queue.getPreferredBarber(createAdminGateway(), slug, phone);
}

/** REQ-039.5: "Ver cortes" en el formulario de turno. */
export async function getBarberPhotos(slug: string, barberId: string) {
  return queue.getBarberPhotos(createAdminGateway(), slug, barberId);
}

/** REQ-037.2: ¿la ficha de este celular ya tiene cumpleaños? */
export async function customerHasBirthday(slug: string, phone: string): Promise<boolean> {
  return queue.customerHasBirthday(createAdminGateway(), slug, phone);
}

/** REQ-041.1 / REQ-041.3: ¿la ficha de este celular ya tiene permiso vigente? */
export async function customerHasWhatsappConsent(slug: string, phone: string): Promise<boolean> {
  return queue.customerHasWhatsappConsent(createAdminGateway(), slug, phone);
}

/** REQ-003: tomar turno. Devuelve el token (o el existente, REQ-003.5). */
export async function joinQueue(input: queue.JoinInput): Promise<queue.JoinResult> {
  const gw = createAdminGateway();
  const result = await queue.joinQueue(gw, input, await clientIp());
  if (result.ok) afterQueueChange(await queue.registerNewTicket(gw, result.token, result.existing));
  return result;
}

/** REQ-004 */
/** REQ-056.2 página pública de la tarjeta de regalo */
export async function getGiftCardByToken(token: string) {
  return giftCards.getGiftCardByToken(createAdminGateway(), token);
}

export async function getTicketByToken(token: string) {
  const ticket = await queue.getTicketByToken(createAdminGateway(), token);
  if (!ticket) return null;
  // REQ-043.3
  return { ...ticket, whatsappConsent: ticket.whatsappConsent && whatsappChannelReady() };
}

/** REQ-005 */
export async function cancelTicketByToken(token: string) {
  const gw = createAdminGateway();
  const result = await queue.cancelTicketByToken(gw, token);
  if (result.ok) afterQueueChange(await queue.ticketBusinessId(gw, token));
  return result;
}

/** REQ-042.1 */
export async function optOutWhatsapp(token: string) {
  return queue.optOutWhatsapp(createAdminGateway(), token);
}

/** REQ-038.4 */
export async function setTicketCourtesy(token: string, productId: string | null) {
  return queue.setTicketCourtesy(createAdminGateway(), token, productId);
}

/** REQ-002.1: aviso de privacidad vigente del negocio. */
export async function getPrivacyPolicy(slug: string) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin
    .from("privacy_policy_versions")
    .select("version, body, published_at, businesses:business_id!inner ( name, slug )")
    .eq("businesses.slug", slug)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const biz = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses;
  return {
    version: data.version as number,
    body: data.body as string,
    publishedAt: data.published_at as string,
    businessName: biz.name as string,
  };
}

// ================================================================ T-027: pantalla TV ====

export type { ScreenView } from "@/lib/domain/screen";

/** REQ-013.1: datos de la pantalla (clave en la URL). */
export async function getScreenQueue(slug: string, key: string): Promise<ScreenView | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug) || !/^[A-Za-z0-9_-]{8,64}$/.test(key)) return null;
  const admin = createSupabaseAdminClient();
  const { data } = await admin.rpc("get_screen_queue", { p_slug: slug, p_key: key });
  // REQ-078.25: números y citas desde la 0071; antes, solo nombres (normalizeScreenView)
  return data ? normalizeScreenView(data as Parameters<typeof normalizeScreenView>[0]) : null;
}
