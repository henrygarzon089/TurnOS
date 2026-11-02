/**
 * WhatsApp Cloud API de Meta (design.md §12.3, ADR-027): envío servidor a servidor, sin reintentos
 * en línea. Nunca lanza: una falla se devuelve como `{ ok: false, code }` y no afecta la fila
 * (REQ-040.7). El `code` es el de Meta o uno de `http_<estado>`, `invalid_response`, `timeout`,
 * `network`.
 */
import { waMeNumber } from "@/lib/domain/phone";
import type { NotificationChannel } from "./channel";

const GRAPH_API_URL = "https://graph.facebook.com/v26.0";
const TIMEOUT_MS = 5_000;
/** Debe coincidir con el idioma con que Meta aprobó las plantillas. */
const TEMPLATE_LANGUAGE = "es";

export type WhatsAppTemplate = "turno_faltan_dos" | "turno_te_llaman";

export type SendResult = { ok: true; messageId: string } | { ok: false; code: string };

export type CloudApiConfig = {
  accessToken: string;
  phoneNumberId: string;
  /** Las pruebas inyectan uno falso: ninguna toca la red (REQ-043.4). */
  fetchImpl?: typeof fetch;
};

type GraphResponse = {
  messages?: { id?: string }[];
  error?: { code?: number | string };
};

export class CloudApiChannel implements NotificationChannel {
  readonly kind = "cloud-api";
  private readonly accessToken: string;
  private readonly phoneNumberId: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ accessToken, phoneNumberId, fetchImpl = fetch }: CloudApiConfig) {
    this.accessToken = accessToken;
    this.phoneNumberId = phoneNumberId;
    this.fetchImpl = fetchImpl;
  }

  /** Servidor a servidor: no hay enlace que abrir. */
  buildLink(): null {
    return null;
  }

  sendTemplate(input: {
    phoneE164: string;
    template: WhatsAppTemplate;
    params: readonly string[];
  }): Promise<SendResult> {
    return this.post(input.phoneE164, {
      type: "template",
      template: {
        name: input.template,
        language: { code: TEMPLATE_LANGUAGE },
        components: [
          { type: "body", parameters: input.params.map((text) => ({ type: "text", text })) },
        ],
      },
    });
  }

  /** Solo dentro de la ventana de 24 h que abrió el cliente al escribir (REQ-042). */
  sendText(input: { phoneE164: string; body: string }): Promise<SendResult> {
    return this.post(input.phoneE164, { type: "text", text: { body: input.body } });
  }

  private async post(phoneE164: string, message: object): Promise<SendResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await this.fetchImpl(`${GRAPH_API_URL}/${this.phoneNumberId}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: waMeNumber(phoneE164),
          ...message,
        }),
        signal: controller.signal,
      });
      // El temporizador sigue vivo aquí: el cuerpo también puede colgarse.
      const data: GraphResponse | null = await res.json().catch(() => null);
      if (controller.signal.aborted) return { ok: false, code: "timeout" };
      if (!res.ok) return { ok: false, code: String(data?.error?.code ?? `http_${res.status}`) };
      const messageId = data?.messages?.[0]?.id;
      return messageId ? { ok: true, messageId } : { ok: false, code: "invalid_response" };
    } catch {
      return { ok: false, code: controller.signal.aborted ? "timeout" : "network" };
    } finally {
      clearTimeout(timer);
    }
  }
}

/** Responde como Meta sin salir de la máquina: los E2E corren el servidor real (REQ-043.4). */
const fakeGraphFetch: typeof fetch = async () =>
  Response.json({ messages: [{ id: `fake.${crypto.randomUUID()}` }] });

/**
 * Canal con las credenciales del entorno, o null si falta alguna: sin el secreto y el token del
 * webhook no llegarían los estados ni "PARAR", así que tampoco se envía (REQ-043.3).
 * `WHATSAPP_FAKE_CHANNEL=1` da un canal falso para los E2E; en Vercel se ignora, para que producción
 * nunca marque "Avisado ✓" sin haber enviado.
 */
export function cloudApiChannelFromEnv(
  env: Record<string, string | undefined> = process.env,
): CloudApiChannel | null {
  if (env.WHATSAPP_FAKE_CHANNEL === "1" && !env.VERCEL) {
    return new CloudApiChannel({
      accessToken: "fake",
      phoneNumberId: "fake",
      fetchImpl: fakeGraphFetch,
    });
  }
  const {
    WHATSAPP_ACCESS_TOKEN: accessToken,
    WHATSAPP_PHONE_NUMBER_ID: phoneNumberId,
    WHATSAPP_APP_SECRET: appSecret,
    WHATSAPP_VERIFY_TOKEN: verifyToken,
  } = env;
  if (!accessToken || !phoneNumberId || !appSecret || !verifyToken) return null;
  return new CloudApiChannel({ accessToken, phoneNumberId });
}

/** REQ-043.3: sin credenciales del servidor las pantallas siguen como hoy. */
export function whatsappChannelReady(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return cloudApiChannelFromEnv(env) !== null;
}
