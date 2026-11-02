import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ after: vi.fn(), dispatch: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/server", () => ({ after: m.after }));
vi.mock("@/lib/db/supabase-gateway", () => ({ createAdminGateway: () => ({ rpc: vi.fn() }) }));
vi.mock("@/lib/notifications/dispatch", () => ({ dispatchQueueNotifications: m.dispatch }));

import { afterQueueChange } from "@/lib/notifications/after-queue-change";
import { getChannel } from "@/lib/notifications/channel";

const withCredentials = () => {
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "123");
  vi.stubEnv("WHATSAPP_APP_SECRET", "secret");
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verify");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://turnos.test");
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("WHATSAPP_ACCESS_TOKEN", "");
});

describe("afterQueueChange", () => {
  it("REQ-040.7 el envío queda para después de responder", () => {
    withCredentials();

    afterQueueChange("biz-1");

    expect(m.after).toHaveBeenCalledOnce();
    expect(m.dispatch).not.toHaveBeenCalled();
  });

  it("REQ-040.1 después de responder revisa la fila del negocio con el enlace público", async () => {
    withCredentials();
    afterQueueChange("biz-1");

    await m.after.mock.calls[0][0]();

    expect(m.dispatch).toHaveBeenCalledExactlyOnceWith(
      "biz-1",
      expect.objectContaining({ appUrl: "https://turnos.test" }),
    );
  });

  it("REQ-040.7 un error del envío no sale de aquí", async () => {
    withCredentials();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    m.dispatch.mockRejectedValue(new Error("Meta caído"));
    afterQueueChange("biz-1");

    await expect(m.after.mock.calls[0][0]()).resolves.toBeUndefined();

    expect(log).toHaveBeenCalledOnce();
    log.mockRestore();
  });

  it("REQ-043.3 sin credenciales no hace nada", () => {
    afterQueueChange("biz-1");

    expect(m.after).not.toHaveBeenCalled();
  });

  it("sin negocio no hace nada", () => {
    withCredentials();

    afterQueueChange(null);

    expect(m.after).not.toHaveBeenCalled();
  });
});

describe("REQ-040.8 botón manual", () => {
  it("REQ-040.8 getChannel sigue construyendo el enlace de wa.me", () => {
    withCredentials();

    const link = getChannel().buildLink({
      phoneE164: "+573001110001",
      template: "Hola {nombre}",
      vars: { nombre: "Ana" },
    });

    expect(link).toBe("https://wa.me/573001110001?text=Hola%20Ana");
  });
});
