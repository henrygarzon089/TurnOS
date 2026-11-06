"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { redactVitalsUrl } from "@/lib/domain/vitals";

/**
 * Velocidad de usuarios reales (REQ-075.3). Sin cookies ni identificadores, solo envía en
 * producción; la URL sale sin token, query ni fragmento (REQ-075.4, ADR-043).
 */
export function VitalsReporter() {
  return <SpeedInsights beforeSend={(event) => ({ ...event, url: redactVitalsUrl(event.url) })} />;
}
