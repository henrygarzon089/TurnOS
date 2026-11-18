"use server";

import { createAdminGateway } from "@/lib/db/supabase-gateway";
import { isModuleEnabled } from "@/lib/domain/modules";
import { getPublicSite } from "@/lib/queue/public-site";
import { getAppointmentInfo } from "./public-appointments";
import { getPublicBusiness } from "./public";

/**
 * REQ-101.1 / REQ-101.4: todo lo que muestra la web del negocio, leído de la base en cada visita.
 * null si el negocio no existe (la portada muestra entonces la genérica).
 */
export async function getSiteHome(slug: string) {
  const business = await getPublicBusiness(slug);
  if (!business) return null;
  const [site, appts] = await Promise.all([
    // Sin la migración 0080 (o si falla la lectura) la web sale sin horario, equipo ni fidelidad
    getPublicSite(createAdminGateway(), slug).catch(() => null),
    getAppointmentInfo(slug),
  ]);
  // REQ-050.1: "Reservar una cita" solo con citas encendidas y alguien que las reciba
  const canBook = Boolean(appts?.enabled && appts.barbers.length > 0 && appts.openDays.length > 0);
  return {
    business,
    hours: site?.hours ?? [],
    // REQ-079: un módulo apagado no se ofrece en la web (PA-H27-4)
    loyalty: isModuleEnabled("loyalty") ? (site?.loyalty ?? null) : null,
    team: site?.team ?? [],
    reviewUrl: site?.reviewUrl ?? null,
    products: isModuleEnabled("products") ? business.products : [],
    canBook,
  };
}

export type SiteHomeData = NonNullable<Awaited<ReturnType<typeof getSiteHome>>>;
