import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/brand";

/** REQ-101.7: se indexan la web y la página pública; no el personal ni las páginas con token. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/app",
        "/entrar",
        "/crear-negocio",
        "/t/",
        "/c/",
        "/regalo/",
        "/invitacion/",
        "/diseno",
        "/api/",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
