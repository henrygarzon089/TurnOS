import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";
import { homeSlug } from "@/lib/domain/modules";

/** REQ-101.7: la web y la página pública del negocio (tomar turno y reservar). */
export default function sitemap(): MetadataRoute.Sitemap {
  const slug = homeSlug();
  return [
    { url: `${SITE_URL}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/${slug}`, changeFrequency: "daily", priority: 0.8 },
    { url: `${SITE_URL}/${slug}/cita`, changeFrequency: "daily", priority: 0.7 },
  ];
}
