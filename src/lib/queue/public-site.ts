/**
 * Lectura pública de la web del negocio (REQ-101, ADR-077, design §33.1): horario de la semana,
 * regla de fidelidad y equipo, por `get_public_site` con service_role (ADR-009). Sin celulares.
 */
import type { Gateway } from "@/lib/db/gateway";
import type { SiteHours, SiteLoyalty, SiteTeamMember } from "@/lib/domain/site";

export type PublicSite = {
  hours: SiteHours;
  loyalty: SiteLoyalty;
  team: SiteTeamMember[];
  /** REQ-036: enlace de reseñas en Google, o null. */
  reviewUrl: string | null;
};

export async function getPublicSite(gw: Gateway, slug: string): Promise<PublicSite | null> {
  if (!/^[a-z0-9-]{3,40}$/.test(slug)) return null;
  const raw = await gw.rpc<Partial<PublicSite> | null>("get_public_site", { p_slug: slug });
  if (!raw) return null;
  return {
    reviewUrl: raw.reviewUrl ?? null,
    hours: raw.hours ?? [],
    loyalty: raw.loyalty ?? null,
    team: (raw.team ?? []).map((t) => ({ id: t.id, name: t.name, photoPath: t.photoPath ?? null })),
  };
}
