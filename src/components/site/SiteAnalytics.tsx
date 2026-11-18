"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";
import { shouldTrackPath } from "@/lib/domain/site";
import { redactVitalsUrl } from "@/lib/domain/vitals";

/**
 * REQ-101.8: visitas de la web con Vercel Web Analytics (sin cookies ni identificadores). Solo la
 * portada y las páginas públicas del negocio; las del personal y las que llevan token no se envían,
 * y la dirección va sin query ni fragmento (ADR-043).
 */
export function siteBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
  const path = new URL(event.url).pathname;
  if (!shouldTrackPath(path)) return null;
  return { ...event, url: redactVitalsUrl(event.url) };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={siteBeforeSend} />;
}
