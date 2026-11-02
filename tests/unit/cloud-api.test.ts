import { afterEach, describe, expect, it, vi } from "vitest";
import type { NotificationChannel } from "@/lib/notifications/channel";
import { CloudApiChannel, cloudApiChannelFromEnv } from "@/lib/notifications/cloud-api";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const accepted = () => json({ messages: [{ id: "wamid.1" }] });

function channelWith(fetchImpl: typeof fetch) {
  return new CloudApiChannel({ accessToken: "tok", phoneNumberId: "123", fetchImpl });
}

const template = {
  phoneE164: "+573001234567",
  template: "turno_faltan_dos",
  params: ["Camilo", "Filo", "20 min", "https://x/t/abc"],
} as const;

/** Como `fetch` real: no responde nunca y rechaza cuando se aborta. */
const hangingFetch = (_url: unknown, init?: RequestInit) =>
  new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () =>
      reject(new DOMException("aborted", "AbortError")),
    );
  });

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("CloudApiChannel.sendTemplate", () => {
  it("REQ-040.1 envía la plantilla a la Graph API y devuelve el id de Meta", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => accepted());
    const result = await channelWith(fetchImpl).sendTemplate(template);

    expect(result).toEqual({ ok: true, messageId: "wamid.1" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\/123\/messages$/);
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer tok",
      "Content-Type": "application/json",
    });
    expect(JSON.parse(init?.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "573001234567",
      type: "template",
      template: {
        name: "turno_faltan_dos",
        language: { code: "es" },
        components: [
          {
            type: "body",
            parameters: [
              { type: "text", text: "Camilo" },
              { type: "text", text: "Filo" },
              { type: "text", text: "20 min" },
              { type: "text", text: "https://x/t/abc" },
            ],
          },
        ],
      },
    });
  });

  it("REQ-040.7 un rechazo de Meta devuelve su código y no lanza", async () => {
    const fetchImpl = vi.fn(async () => json({ error: { code: 131026, message: "x" } }, 400));
    await expect(channelWith(fetchImpl).sendTemplate(template)).resolves.toEqual({
      ok: false,
      code: "131026",
    });
  });

  it("REQ-040.7 un error HTTP sin cuerpo de Meta devuelve el estado y no lanza", async () => {
    const fetchImpl = vi.fn(async () => new Response("<html>Bad Gateway</html>", { status: 502 }));
    await expect(channelWith(fetchImpl).sendTemplate(template)).resolves.toEqual({
      ok: false,
      code: "http_502",
    });
  });

  it("REQ-040.7 una respuesta 200 sin id de mensaje cuenta como fallo", async () => {
    for (const res of [json({}), json({ messages: [] }), new Response("no es JSON")]) {
      await expect(channelWith(async () => res).sendTemplate(template)).resolves.toEqual({
        ok: false,
        code: "invalid_response",
      });
    }
  });

  it("REQ-040.7 un error de red no lanza y no se reintenta en línea", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(channelWith(fetchImpl).sendTemplate(template)).resolves.toEqual({
      ok: false,
      code: "network",
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("REQ-040.7 un `fetch` que lanza de forma síncrona tampoco se escapa", async () => {
    const fetchImpl = (() => {
      throw new Error("boom");
    }) as unknown as typeof fetch;
    await expect(channelWith(fetchImpl).sendTemplate(template)).resolves.toEqual({
      ok: false,
      code: "network",
    });
  });

  it("REQ-040.7 corta a los 5 s, ni antes ni después, y devuelve `timeout`", async () => {
    vi.useFakeTimers();
    let settled = false;
    const pending = channelWith(hangingFetch)
      .sendTemplate(template)
      .finally(() => {
        settled = true;
      });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(pending).resolves.toEqual({ ok: false, code: "timeout" });
  });

  it("REQ-040.7 el timeout también cubre un cuerpo que se queda colgado", async () => {
    vi.useFakeTimers();
    const fetchImpl = async (_url: unknown, init?: RequestInit) =>
      ({
        ok: true,
        status: 200,
        json: () => hangingFetch(_url, init),
      }) as unknown as Response;
    const pending = channelWith(fetchImpl).sendTemplate(template);

    await vi.advanceTimersByTimeAsync(5_000);
    await expect(pending).resolves.toEqual({ ok: false, code: "timeout" });
  });

  it("REQ-040.7 no deja el temporizador vivo al terminar", async () => {
    vi.useFakeTimers();
    await channelWith(async () => accepted()).sendTemplate(template);
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("CloudApiChannel.sendText", () => {
  it("REQ-042.4 envía texto libre al mismo endpoint", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => accepted());
    const result = await channelWith(fetchImpl).sendText({
      phoneE164: "+573001234567",
      body: "Este número solo envía avisos.",
    });

    expect(result).toEqual({ ok: true, messageId: "wamid.1" });
    expect(JSON.parse(fetchImpl.mock.calls[0][1]?.body as string)).toEqual({
      messaging_product: "whatsapp",
      to: "573001234567",
      type: "text",
      text: { body: "Este número solo envía avisos." },
    });
  });

  it("REQ-040.7 también nunca lanza", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    await expect(
      channelWith(fetchImpl).sendText({ phoneE164: "+573001234567", body: "Hola" }),
    ).resolves.toEqual({ ok: false, code: "network" });
  });
});

describe("REQ-009.5 CloudApiChannel detrás de NotificationChannel", () => {
  it("es canal servidor a servidor: sin enlace para abrir", () => {
    const channel: NotificationChannel = channelWith(async () => accepted());
    expect(channel.kind).toBe("cloud-api");
    expect(
      channel.buildLink({ phoneE164: "+573001234567", template: "Hola", vars: {} }),
    ).toBeNull();
  });
});

describe("cloudApiChannelFromEnv", () => {
  const env = {
    WHATSAPP_ACCESS_TOKEN: "tok",
    WHATSAPP_PHONE_NUMBER_ID: "123",
    WHATSAPP_APP_SECRET: "secret",
    WHATSAPP_VERIFY_TOKEN: "verify",
  };

  it("REQ-043.3 con las cuatro variables el canal queda activo", () => {
    expect(cloudApiChannelFromEnv(env)).toBeInstanceOf(CloudApiChannel);
  });

  it.each(Object.keys(env))("REQ-043.3 sin %s el canal queda inactivo", (name) => {
    expect(cloudApiChannelFromEnv({ ...env, [name]: undefined })).toBeNull();
    expect(cloudApiChannelFromEnv({ ...env, [name]: "" })).toBeNull();
  });

  it("REQ-043.4 crear el canal no toca la red", () => {
    const realFetch = vi.fn();
    vi.stubGlobal("fetch", realFetch);
    cloudApiChannelFromEnv(env);
    expect(realFetch).not.toHaveBeenCalled();
  });
});

describe("REQ-043.4 las pruebas no envían mensajes reales", () => {
  it("el canal usa el `fetch` inyectado, nunca el global", async () => {
    const realFetch = vi.fn();
    vi.stubGlobal("fetch", realFetch);
    await channelWith(async () => accepted()).sendTemplate(template);
    expect(realFetch).not.toHaveBeenCalled();
  });
});
