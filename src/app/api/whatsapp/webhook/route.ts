import "server-only";

import { after } from "next/server";
import { createAdminGateway } from "@/lib/db/supabase-gateway";
import {
  parseWebhookEvents,
  verifySignature,
  type WebhookEvent,
} from "@/lib/domain/whatsapp-webhook";
import { cloudApiChannelFromEnv } from "@/lib/notifications/cloud-api";
import { processWebhookEvents } from "@/lib/notifications/webhook";

/** Verificación de la suscripción en Meta (design.md §12.5). */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const token = process.env.WHATSAPP_VERIFY_TOKEN;
  if (
    !token ||
    params.get("hub.mode") !== "subscribe" ||
    params.get("hub.verify_token") !== token
  ) {
    return new Response(null, { status: 403 });
  }
  return new Response(params.get("hub.challenge"), { status: 200 });
}

function eventsOf(rawBody: string): WebhookEvent[] {
  try {
    return parseWebhookEvents(JSON.parse(rawBody));
  } catch {
    return [];
  }
}

/** La firma se valida sobre el cuerpo crudo, antes de leerlo (REQ-043.5). */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifySignature(rawBody, signature, process.env.WHATSAPP_APP_SECRET ?? "")) {
    return new Response(null, { status: 401 });
  }

  const channel = cloudApiChannelFromEnv();
  const events = eventsOf(rawBody);
  if (channel && events.length > 0) {
    after(async () => {
      try {
        await processWebhookEvents(events, { gateway: createAdminGateway(), channel });
      } catch {
        console.error("Webhook de WhatsApp sin procesar");
      }
    });
  }
  return new Response(null, { status: 200 });
}
