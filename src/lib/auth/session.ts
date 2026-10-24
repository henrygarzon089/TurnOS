import "server-only";

import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type Role = "owner" | "barber";

export type StaffSession = {
  userId: string;
  email: string | null;
  business: { id: string; name: string; slug: string };
  role: Role;
  /** Silla del usuario: siempre para barberos; para dueños solo si también atienden (REQ-012.5). */
  barberId: string | null;
  barberName: string | null;
};

/**
 * Sesión del personal con su membresía. En el MVP se toma la primera membresía (REQ-031.3:
 * el modelo soporta varias; la interfaz, una). `cache` evita repetir la consulta en un render.
 */
export const getStaffSession = cache(async (): Promise<StaffSession | null> => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("memberships")
    .select(
      "role, barber_id, businesses:business_id ( id, name, slug ), barbers:barber_id ( display_name )",
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!data || !data.businesses) {
    return null;
  }

  const business = Array.isArray(data.businesses) ? data.businesses[0] : data.businesses;
  const barber = Array.isArray(data.barbers) ? data.barbers[0] : data.barbers;

  return {
    userId: user.id,
    email: user.email ?? null,
    business: { id: business.id, name: business.name, slug: business.slug },
    role: data.role as Role,
    barberId: data.barber_id ?? null,
    barberName: barber?.display_name ?? null,
  };
});

/** Dominio del correo alias de los barberos (decisions.md ADR-010). */
export const BARBER_EMAIL_DOMAIN = "barberos.turnos.local";

export function barberEmailFromPhone(phoneE164: string): string {
  return `${phoneE164.replace(/^\+/, "")}@${BARBER_EMAIL_DOMAIN}`;
}
