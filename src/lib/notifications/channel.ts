/**
 * Canal de notificaciones al cliente (REQ-009.5, ADR-003). En el MVP solo existe WaMeChannel:
 * construye un enlace wa.me con el mensaje prellenado; lo abre el barbero con un toque.
 * Cambiar a WhatsApp Cloud API = agregar otra implementación de esta interfaz.
 */
import { waMeNumber } from "@/lib/domain/phone";
import { renderTemplate, type TemplateVars } from "./render";

export interface NotificationChannel {
  readonly kind: "wa.me" | "cloud-api";
  /** Enlace que el barbero abre (wa.me). Los canales servidor→servidor devolverían null. */
  buildLink(input: { phoneE164: string; template: string; vars: TemplateVars }): string | null;
}

export const waMeChannel: NotificationChannel = {
  kind: "wa.me",
  buildLink({ phoneE164, template, vars }) {
    const text = renderTemplate(template, vars);
    return `https://wa.me/${waMeNumber(phoneE164)}?text=${encodeURIComponent(text)}`;
  },
};

/** Canal activo del negocio. En el MVP siempre wa.me. */
export function getChannel(): NotificationChannel {
  return waMeChannel;
}
