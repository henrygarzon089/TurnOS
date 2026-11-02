/**
 * Eventos del webhook de Meta (design.md §12.5, ADR-028). Meta repite eventos, así que cada paso es
 * idempotente. El contenido de los mensajes no se guarda ni se registra: los errores solo llevan el
 * código. Sin dependencias de Next: las pruebas inyectan el gateway y un canal falso (REQ-043.4).
 */
import { GatewayError, type Gateway } from "@/lib/db/gateway";
import {
  autoReplyText,
  normalizeOptOut,
  OPT_OUT_CONFIRMATION,
  OPT_OUT_KEYWORD,
  type WebhookEvent,
} from "@/lib/domain/whatsapp-webhook";
import type { CloudApiChannel } from "./cloud-api";

export type WebhookDeps = {
  gateway: Gateway;
  channel: Pick<CloudApiChannel, "sendText">;
};

type InboundContext = { optOutBusinessIds: string[]; contactPhone: string | null };
type MessageEvent = Extract<WebhookEvent, { type: "message" }>;

/** Una respuesta que no sale no se reintenta: el cliente puede volver a escribir. */
async function reply({ channel }: WebhookDeps, phoneE164: string, body: string) {
  const result = await channel.sendText({ phoneE164, body });
  if (!result.ok) console.error("Respuesta de WhatsApp sin enviar", result.code);
}

/** REQ-042.2 / REQ-042.3 baja en cada negocio con permiso vigente. Devuelve si alguno cambió. */
async function optOut(gateway: Gateway, phoneE164: string, businessIds: string[]) {
  let changed = false;
  for (const businessId of businessIds) {
    const done = await gateway.rpc<boolean>("whatsapp_opt_out_by_phone", {
      p_business_id: businessId,
      p_phone: phoneE164,
    });
    changed ||= done;
  }
  return changed;
}

async function handleMessage(deps: WebhookDeps, { phoneE164, text }: MessageEvent) {
  const { gateway } = deps;
  const context = await gateway.rpc<InboundContext>("whatsapp_inbound_context", {
    p_phone: phoneE164,
  });
  const wantsOut = normalizeOptOut(text) === OPT_OUT_KEYWORD;
  const changed = wantsOut && (await optOut(gateway, phoneE164, context.optOutBusinessIds));

  // La baja también gasta la ventana: un "PARAR" repetido no debe recibir la respuesta automática.
  const canReply = await gateway.rpc<boolean>("claim_whatsapp_reply", { p_phone: phoneE164 });
  if (changed) await reply(deps, phoneE164, OPT_OUT_CONFIRMATION);
  else if (canReply) await reply(deps, phoneE164, autoReplyText(context.contactPhone));
}

async function handleEvent(deps: WebhookDeps, event: WebhookEvent) {
  if (event.type === "message") return handleMessage(deps, event);
  // REQ-040.7 el estado solo avanza; un id que no es de un aviso no cambia nada.
  await deps.gateway.rpc("set_notification_status", {
    p_status: event.status,
    p_meta_message_id: event.messageId,
    p_error: event.errorCode,
  });
}

/** Un evento que falla no impide procesar los demás. */
export async function processWebhookEvents(events: WebhookEvent[], deps: WebhookDeps) {
  for (const event of events) {
    try {
      await handleEvent(deps, event);
    } catch (e) {
      console.error(
        "Evento de WhatsApp sin procesar",
        e instanceof GatewayError ? e.code : "error",
      );
    }
  }
}
