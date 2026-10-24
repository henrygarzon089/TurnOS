"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { barberEmailFromPhone } from "@/lib/auth/session";
import { normalizePhoneCO } from "@/lib/domain/phone";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string } | undefined;

const ownerSchema = z.object({
  email: z.string().trim().email("Escribe un correo válido."),
  password: z.string().min(6, "La contraseña tiene al menos 6 caracteres."),
  volver: z.string().optional(),
});

const barberSchema = z.object({
  phone: z.string().trim(),
  pin: z.string().regex(/^\d{6}$/, "El PIN son 6 números."),
  volver: z.string().optional(),
});

function safeReturnPath(volver: string | undefined, fallback: string): string {
  if (volver && /^\/(app|admin)(\/|$)/.test(volver)) return volver;
  return fallback;
}

/** REQ-030.1 · Dueño: correo + contraseña. */
export async function signInOwner(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = ownerSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) {
    return { error: "Correo o contraseña incorrectos." };
  }
  redirect(safeReturnPath(parsed.data.volver, "/app"));
}

/** ADR-010 · Barbero: celular + PIN de 6 dígitos (cuenta alias en Supabase Auth). */
export async function signInBarber(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = barberSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Revisa los datos." };
  }
  const phone = normalizePhoneCO(parsed.data.phone);
  if (!phone) {
    return { error: "Escribe un celular colombiano de 10 dígitos (empieza por 3)." };
  }
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: barberEmailFromPhone(phone),
    password: parsed.data.pin,
  });
  if (error) {
    return { error: "Celular o PIN incorrectos." };
  }
  redirect(safeReturnPath(parsed.data.volver, "/app"));
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/entrar");
}
