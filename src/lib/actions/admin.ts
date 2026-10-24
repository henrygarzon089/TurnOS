"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getStaffSession } from "@/lib/auth/session";
import { parseCOP } from "@/lib/domain/money";
import { normalizePhoneCO } from "@/lib/domain/phone";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { error?: string; ok?: boolean } | undefined;

// ---------------------------------------------------------------- crear negocio ----

const businessSchema = z.object({
  name: z.string().trim().min(2, "El nombre del negocio es muy corto.").max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]{3,40}$/, "El enlace solo puede tener letras, números y guiones (3 a 40)."),
  address: z.string().trim().max(200).optional(),
});

const accountSchema = z.object({
  email: z.string().trim().email("Escribe un correo válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
});

/** Convierte "Barbería La 33" → "barberia-la-33". */
export async function slugify(name: string): Promise<string> {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

/** Paso 1 (REQ-030.1): crea la cuenta del dueño (si no hay sesión) y el negocio. */
export async function createBusiness(_prev: FormState, formData: FormData): Promise<FormState> {
  const raw = Object.fromEntries(formData);
  const biz = businessSchema.safeParse(raw);
  if (!biz.success) return { error: biz.error.issues[0]?.message };

  const supabase = await createSupabaseServerClient();
  let {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const acc = accountSchema.safeParse(raw);
    if (!acc.success) return { error: acc.error.issues[0]?.message };
    const admin = createSupabaseAdminClient();
    const created = await admin.auth.admin.createUser({
      email: acc.data.email,
      password: acc.data.password,
      email_confirm: true,
    });
    if (created.error) {
      return {
        error: /already|registered|exists/i.test(created.error.message)
          ? "Ese correo ya tiene cuenta. Entra con tu contraseña."
          : "No se pudo crear la cuenta. Intenta de nuevo.",
      };
    }
    const signed = await supabase.auth.signInWithPassword({
      email: acc.data.email,
      password: acc.data.password,
    });
    if (signed.error) return { error: "No se pudo iniciar sesión." };
    user = signed.data.user;
  }

  const { error } = await supabase.rpc("create_business", {
    p_name: biz.data.name,
    p_slug: biz.data.slug,
    p_address: biz.data.address || null,
  });
  if (error) {
    return {
      error:
        error.code === "23505"
          ? "Ese enlace ya está en uso. Elige otro."
          : "No se pudo crear el negocio.",
    };
  }
  redirect("/crear-negocio?paso=2");
}

// ---------------------------------------------------------------- horario ----

const hourRow = z.object({
  weekday: z.coerce.number().int().min(0).max(6),
  is_closed: z.boolean(),
  opens_at: z.string().regex(/^\d{2}:\d{2}$/),
  closes_at: z.string().regex(/^\d{2}:\d{2}$/),
});

/** Paso 2 / /admin/horario (REQ-017.1). Espera campos d{n}_closed, d{n}_opens, d{n}_closes. */
export async function saveBusinessHours(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede cambiar el horario." };

  const rows = [];
  for (let d = 0; d < 7; d++) {
    const parsed = hourRow.safeParse({
      weekday: d,
      is_closed: formData.get(`d${d}_closed`) === "on",
      opens_at: formData.get(`d${d}_opens`) || "09:00",
      closes_at: formData.get(`d${d}_closes`) || "20:00",
    });
    if (!parsed.success) return { error: "Revisa las horas." };
    if (!parsed.data.is_closed && parsed.data.closes_at <= parsed.data.opens_at) {
      return { error: "La hora de cierre debe ser después de la de apertura." };
    }
    rows.push({ ...parsed.data, business_id: session.business.id });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("business_hours").upsert(rows);
  if (error) return { error: "No se pudo guardar el horario." };

  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/")) redirect(next);
  return { ok: true };
}

// ---------------------------------------------------------------- servicios ----

const serviceSchema = z.object({
  name: z.string().trim().min(1, "El servicio necesita un nombre.").max(60),
  duration_min: z.coerce
    .number()
    .int()
    .positive()
    .refine((n) => n % 5 === 0, "La duración va en múltiplos de 5 minutos."),
  price: z.string().transform((s, ctx) => {
    const n = parseCOP(s);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "El precio debe ser un número entero en pesos." });
      return z.NEVER;
    }
    return n;
  }),
  counts_for_loyalty: z.boolean().default(true),
});

/** Paso 3 (REQ-030.1): hasta 5 servicios iniciales s{n}_name / s{n}_duration / s{n}_price. */
export async function addInitialServices(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede crear servicios." };

  const rows = [];
  for (let i = 0; i < 5; i++) {
    const name = formData.get(`s${i}_name`);
    if (typeof name !== "string" || name.trim() === "") continue;
    const parsed = serviceSchema.safeParse({
      name,
      duration_min: formData.get(`s${i}_duration`),
      price: formData.get(`s${i}_price`),
      counts_for_loyalty: true,
    });
    if (!parsed.success) return { error: `Servicio ${i + 1}: ${parsed.error.issues[0]?.message}` };
    rows.push({ ...parsed.data, business_id: session.business.id, sort_order: i });
  }
  if (rows.length === 0) return { error: "Agrega al menos un servicio." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("services").insert(rows);
  if (error) return { error: "No se pudieron guardar los servicios." };
  redirect("/admin");
}

// ---------------------------------------------------------------- barberos ----

const barberSchema = z.object({
  display_name: z.string().trim().min(1, "El barbero necesita un nombre.").max(60),
  phone: z.string().trim(),
  commission_pct: z.coerce.number().int().min(0).max(100),
});

/** REQ-016.1: crea el barbero y su invitación; devuelve el enlace para compartir. */
export async function createBarber(
  _prev: { error?: string; ok?: boolean; inviteUrl?: string },
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; inviteUrl?: string }> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede crear barberos." };
  const parsed = barberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const phone = normalizePhoneCO(parsed.data.phone);
  if (!phone) return { error: "Escribe un celular colombiano de 10 dígitos." };

  const supabase = await createSupabaseServerClient();
  const inserted = await supabase
    .from("barbers")
    .insert({
      business_id: session.business.id,
      display_name: parsed.data.display_name,
      phone_e164: phone,
      commission_pct: parsed.data.commission_pct,
    })
    .select("id")
    .single();
  if (inserted.error) return { error: "No se pudo crear el barbero." };

  const invite = await inviteBarber(inserted.data.id);
  if ("error" in invite) return { error: invite.error };
  return { ok: true, inviteUrl: invite.url };
}

/** REQ-030.2: enlace de invitación válido 7 días. */
export async function inviteBarber(barberId: string): Promise<{ url: string } | { error: string }> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede invitar." };
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("invitations")
    .insert({ business_id: session.business.id, barber_id: barberId })
    .select("token")
    .single();
  if (error || !data) return { error: "No se pudo crear la invitación." };
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
  return { url: `${base}/invitacion/${data.token}` };
}

/** REQ-016.3 / REQ-030.4: retira al barbero (pierde acceso, conserva historial). */
export async function removeBarber(barberId: string): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.rpc("remove_barber", { p_barber_id: barberId });
  if (error) return { error: "No se pudo retirar al barbero." };
  return { ok: true };
}

// ================================================================ T-008: administración ====

async function requireOwner() {
  const session = await getStaffSession();
  if (session?.role !== "owner") throw new Error("FORBIDDEN");
  return session;
}

/** Crea o edita un servicio (REQ-015.1). Campos: id?, name, duration_min, price, counts_for_loyalty */
export async function upsertService(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede editar servicios." };
  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    duration_min: formData.get("duration_min"),
    price: formData.get("price"),
    counts_for_loyalty: formData.get("counts_for_loyalty") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const id = formData.get("id");
  const supabase = await createSupabaseServerClient();
  const row = { ...parsed.data, business_id: session.business.id };
  const { error } =
    typeof id === "string" && id
      ? await supabase.from("services").update(row).eq("id", id)
      : await supabase.from("services").insert(row);
  if (error) return { error: "No se pudo guardar el servicio." };
  return { ok: true };
}

/** Activa/desactiva (REQ-015.2): los turnos existentes conservan el servicio. */
export async function toggleService(id: string, isActive: boolean): Promise<FormState> {
  await requireOwner();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("services").update({ is_active: isActive }).eq("id", id);
  return error ? { error: "No se pudo cambiar el estado." } : { ok: true };
}

const productSchema = z.object({
  name: z.string().trim().min(1, "El producto necesita un nombre.").max(60),
  price: z.string().transform((s, ctx) => {
    const n = parseCOP(s);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "El precio debe ser un número entero en pesos." });
      return z.NEVER;
    }
    return n;
  }),
});

/** Crea o edita un producto (REQ-024.1). */
export async function upsertProduct(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede editar productos." };
  const parsed = productSchema.safeParse({
    name: formData.get("name"),
    price: formData.get("price"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const id = formData.get("id");
  const supabase = await createSupabaseServerClient();
  const row = { ...parsed.data, business_id: session.business.id };
  const { error } =
    typeof id === "string" && id
      ? await supabase.from("products").update(row).eq("id", id)
      : await supabase.from("products").insert(row);
  if (error) return { error: "No se pudo guardar el producto." };
  return { ok: true };
}

export async function toggleProduct(id: string, isActive: boolean): Promise<FormState> {
  await requireOwner();
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", id);
  return error ? { error: "No se pudo cambiar el estado." } : { ok: true };
}

/** Edita nombre, celular y comisión de un barbero (REQ-016.1, REQ-025.1, REQ-025.3 vía trigger). */
export async function updateBarber(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede editar barberos." };
  const parsed = barberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const phone = normalizePhoneCO(parsed.data.phone);
  if (!phone) return { error: "Escribe un celular colombiano de 10 dígitos." };
  const id = formData.get("id");
  if (typeof id !== "string") return { error: "Barbero inválido." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("barbers")
    .update({
      display_name: parsed.data.display_name,
      phone_e164: phone,
      commission_pct: parsed.data.commission_pct,
    })
    .eq("id", id);
  if (error) return { error: "No se pudo guardar." };
  return { ok: true };
}

/**
 * REQ-016.4: marca al barbero presente hoy (status available) o ausente (off).
 * El dueño puede hacerlo con cualquiera; el barbero solo consigo mismo (RLS).
 */
export async function setBarberPresent(barberId: string, present: boolean): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const { error } = await supabase
    .from("barbers")
    .update(
      present ? { status: "available", present_day: today } : { status: "off", present_day: null },
    )
    .eq("id", barberId);
  return error ? { error: "No se pudo cambiar la asistencia." } : { ok: true };
}

/** REQ-033.1: plantillas de WhatsApp. Campos: notify_2_turns, reminder_inactive, share_queue */
export async function saveTemplates(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede editar las plantillas." };
  const keys = ["notify_2_turns", "reminder_inactive", "share_queue"] as const;
  const rows = [];
  for (const key of keys) {
    const body = formData.get(key);
    if (typeof body !== "string" || body.trim().length === 0 || body.length > 1000) {
      return { error: "Cada plantilla debe tener entre 1 y 1000 caracteres." };
    }
    rows.push({ business_id: session.business.id, key, body: body.trim() });
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("message_templates").upsert(rows);
  return error ? { error: "No se pudieron guardar las plantillas." } : { ok: true };
}

const businessSettingsSchema = z.object({
  name: z.string().trim().min(2).max(80),
  address: z.string().trim().max(200).optional(),
  chairs_count: z.coerce.number().int().min(1).max(50),
  default_commission_pct: z.coerce.number().int().min(0).max(100),
  grace_minutes: z.coerce.number().int().min(1).max(60),
  inactive_days: z.coerce.number().int().min(1).max(365),
  reminder_cooldown_days: z.coerce.number().int().min(1).max(90),
  pwa_name: z.string().trim().max(40).optional(),
});

/** REQ-016.2 y parámetros del negocio (/admin/negocio). */
export async function updateBusiness(_prev: FormState, formData: FormData): Promise<FormState> {
  const session = await getStaffSession();
  if (session?.role !== "owner") return { error: "Solo el dueño puede editar el negocio." };
  const parsed = businessSettingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Revisa los datos del negocio." };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      ...parsed.data,
      address: parsed.data.address || null,
      pwa_name: parsed.data.pwa_name || null,
    })
    .eq("id", session.business.id);
  return error ? { error: "No se pudo guardar." } : { ok: true };
}
