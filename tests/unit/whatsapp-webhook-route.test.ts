import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ after: vi.fn(), process: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("@/lib/db/supabase-gateway", () => ({ createAdminGateway: () => ({ rpc: vi.fn() }) }));
vi.mock("@/lib/notifications/webhook", () => ({ processWebhookEvents: m.process }));

import { GET, POST } from "@/app/api/whatsapp/webhook/route";
import { config } from "@/proxy";

const URL_BASE = "https://turnos.test/api/whatsapp/webhook";

const withCredentials = () => {
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
  vi.stubEnv("WHATSAPP_APP_SECRET", "secreto");
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verifica");
};

const signed = (body: string, secret = "secreto") =>
  new Request(URL_BASE, {
    method: "POST",
    body,
    headers: {
      "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
    },
  });

const statusBody = JSON.stringify({
  entry: [{ changes: [{ value: { statuses: [{ id: "wamid.1", status: "delivered" }] } }] }],
});

const verification = (token: string) =>
  new Request(`${URL_BASE}?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=abc123`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "");
  vi.stubEnv("WHATSAPP_APP_SECRET", "");
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "");
});

describe("GET /api/whatsapp/webhook", () => {
  it("REQ-043.5 responde el desafío de Meta con el token correcto", async () => {
    withCredentials();

    const res = await GET(verification("verifica"));

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("abc123");
  });

  it("REQ-043.5 rechaza otro token", async () => {
    withCredentials();

    expect((await GET(verification("otro"))).status).toBe(403);
  });

  it("REQ-043.5 rechaza si el servidor no tiene token", async () => {
    expect((await GET(new Request(`${URL_BASE}?hub.mode=subscribe`))).status).toBe(403);
  });
});

describe("POST /api/whatsapp/webhook", () => {
  it("REQ-043.5 una firma inválida da 401 y no procesa nada", async () => {
    withCredentials();

    const res = await POST(signed(statusBody, "otro"));

    expect(res.status).toBe(401);
    expect(m.after).not.toHaveBeenCalled();
  });

  it("REQ-043.5 sin secreto en el servidor da 401", async () => {
    const res = await POST(signed(statusBody, ""));

    expect(res.status).toBe(401);
  });

  it("REQ-040.7 responde 200 y procesa después de responder", async () => {
    withCredentials();

    const res = await POST(signed(statusBody));

    expect(res.status).toBe(200);
    expect(m.after).toHaveBeenCalledOnce();
    expect(m.process).not.toHaveBeenCalled();

    await m.after.mock.calls[0][0]();

    expect(m.process).toHaveBeenCalledOnce();
    expect(m.process.mock.calls[0][0]).toEqual([
      { type: "status", messageId: "wamid.1", status: "delivered", errorCode: null },
    ]);
  });

  it("REQ-043.5 firma válida con JSON roto da 200: repetirlo no lo arregla", async () => {
    withCredentials();

    const res = await POST(signed("{roto"));

    expect(res.status).toBe(200);
    expect(m.after).not.toHaveBeenCalled();
  });

  it("REQ-043.3 con el secreto pero sin canal responde 200 y no procesa", async () => {
    withCredentials();
    vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");

    const res = await POST(signed(statusBody));

    expect(res.status).toBe(200);
    expect(m.after).not.toHaveBeenCalled();
  });

  it("REQ-040.7 un error después de responder se registra y no sube", async () => {
    withCredentials();
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    m.process.mockRejectedValueOnce(new Error("boom"));

    await POST(signed(statusBody));
    await m.after.mock.calls[0][0]();

    expect(error).toHaveBeenCalledOnce();
    error.mockRestore();
  });
});

describe("proxy", () => {
  it("REQ-043.5 la ruta del webhook no pasa por la sesión del personal", () => {
    expect(config.matcher.some((p) => p.startsWith("/api"))).toBe(false);
    expect(readFileSync("src/proxy.ts", "utf8")).not.toMatch(/startsWith\("\/api/);
  });
});
