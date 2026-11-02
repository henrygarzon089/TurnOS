import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** T-068 (design.md §12.6): lo que las pantallas del aviso deciden en el servidor, sin red. */
const m = vi.hoisted(() => ({
  session: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  getPublicBusiness: vi.fn(),
  getTicketByToken: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/notifications/after-queue-change", () => ({ afterQueueChange: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getStaffSession: m.session,
  barberEmailFromPhone: vi.fn(),
}));
vi.mock("@/lib/db/supabase-gateway", () => ({ createAdminGateway: () => ({ rpc: vi.fn() }) }));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({
      update: (patch: unknown) => {
        m.update(patch);
        return { eq: async () => m.eq() };
      },
    }),
  }),
}));
vi.mock("@/lib/queue/public-queue", () => ({
  getPublicBusiness: m.getPublicBusiness,
  getTicketByToken: m.getTicketByToken,
}));

import { AutoMessages } from "@/components/admin/AutoMessages";
import { saveWhatsAppSettings } from "@/lib/actions/admin";
import { getPublicBusiness, getTicketByToken } from "@/lib/actions/public";
import { AUTO_MESSAGES } from "@/lib/notifications/auto-messages";

const CREDENTIALS = {
  WHATSAPP_ACCESS_TOKEN: "tok",
  WHATSAPP_PHONE_NUMBER_ID: "123",
  WHATSAPP_APP_SECRET: "secret",
  WHATSAPP_VERIFY_TOKEN: "verify",
};

const withCredentials = () => Object.entries(CREDENTIALS).forEach(([k, v]) => vi.stubEnv(k, v));

const OWNER = { role: "owner", business: { id: "biz-1", name: "Filo" } };

const form = (fields: Record<string, string>) => {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.set(k, v));
  return data;
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.keys(CREDENTIALS).forEach((k) => vi.stubEnv(k, ""));
  vi.stubEnv("WHATSAPP_FAKE_CHANNEL", "");
  m.session.mockResolvedValue(OWNER);
  m.eq.mockResolvedValue({ error: null });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("REQ-043.3 sin credenciales del servidor todo sigue como hoy", () => {
  it("sin credenciales el formulario no ve el aviso aunque el negocio lo tenga activo", async () => {
    m.getPublicBusiness.mockResolvedValue({ slug: "filo", whatsappAutoEnabled: true });
    expect((await getPublicBusiness("filo"))?.whatsappAutoEnabled).toBe(false);
  });

  it("con credenciales respeta lo que tenga el negocio", async () => {
    withCredentials();
    m.getPublicBusiness.mockResolvedValue({ slug: "filo", whatsappAutoEnabled: true });
    expect((await getPublicBusiness("filo"))?.whatsappAutoEnabled).toBe(true);
    m.getPublicBusiness.mockResolvedValue({ slug: "filo", whatsappAutoEnabled: false });
    expect((await getPublicBusiness("filo"))?.whatsappAutoEnabled).toBe(false);
  });

  it("un negocio que no existe sigue siendo null", async () => {
    m.getPublicBusiness.mockResolvedValue(null);
    expect(await getPublicBusiness("no-existe")).toBeNull();
  });

  it('sin credenciales "Mi turno" no ofrece la baja', async () => {
    m.getTicketByToken.mockResolvedValue({ id: "t", whatsappConsent: true });
    expect((await getTicketByToken("tok"))?.whatsappConsent).toBe(false);
  });

  it('con credenciales "Mi turno" respeta el permiso de la ficha', async () => {
    withCredentials();
    m.getTicketByToken.mockResolvedValue({ id: "t", whatsappConsent: true });
    expect((await getTicketByToken("tok"))?.whatsappConsent).toBe(true);
  });
});

describe("REQ-043.3 / REQ-042.4 interruptor y número de contacto", () => {
  it("REQ-043.3 solo el dueño lo cambia", async () => {
    withCredentials();
    m.session.mockResolvedValue({ ...OWNER, role: "barber" });
    const r = await saveWhatsAppSettings(undefined, form({ whatsapp_auto_enabled: "on" }));
    expect(r?.error).toBeTruthy();
    expect(m.update).not.toHaveBeenCalled();
  });

  it("REQ-043.3 no se activa sin credenciales del servidor", async () => {
    const r = await saveWhatsAppSettings(undefined, form({ whatsapp_auto_enabled: "on" }));
    expect(r?.error).toBeTruthy();
    expect(m.update).not.toHaveBeenCalled();
  });

  it("REQ-042.4 guarda el número de contacto normalizado", async () => {
    withCredentials();
    const r = await saveWhatsAppSettings(
      undefined,
      form({ whatsapp_auto_enabled: "on", whatsapp_contact_phone: "300 123 4567" }),
    );
    expect(r).toEqual({ ok: true });
    expect(m.update).toHaveBeenCalledWith({
      whatsapp_auto_enabled: true,
      whatsapp_contact_phone: "+573001234567",
    });
  });

  it("REQ-042.5 sin número se guarda vacío y se puede apagar", async () => {
    withCredentials();
    const r = await saveWhatsAppSettings(undefined, form({ whatsapp_contact_phone: "  " }));
    expect(r).toEqual({ ok: true });
    expect(m.update).toHaveBeenCalledWith({
      whatsapp_auto_enabled: false,
      whatsapp_contact_phone: null,
    });
  });

  it("REQ-042.4 rechaza un número que no es un celular colombiano", async () => {
    withCredentials();
    const r = await saveWhatsAppSettings(undefined, form({ whatsapp_contact_phone: "12345" }));
    expect(r?.error).toMatch(/celular/i);
    expect(m.update).not.toHaveBeenCalled();
  });

  it("REQ-043.3 informa si la base rechaza el cambio", async () => {
    withCredentials();
    m.eq.mockResolvedValue({ error: { message: "x" } });
    const r = await saveWhatsAppSettings(undefined, form({ whatsapp_auto_enabled: "on" }));
    expect(r?.error).toBeTruthy();
  });
});

describe("/admin/mensajes con el aviso activo", () => {
  const html = (stats: { sent: number; failed: number; capReached: boolean }) =>
    renderToStaticMarkup(createElement(AutoMessages, { stats, businessName: "Filo" }));

  it("REQ-040.9 muestra los dos textos fijos, sin campos para editarlos", () => {
    const page = html({ sent: 0, failed: 0, capReached: false });
    expect(page).toContain("ya casi es tu turno");
    expect(page).toContain("te están llamando en Filo");
    expect(page).not.toMatch(/<(textarea|input)/);
  });

  it("REQ-040.9 los textos dicen lo mismo que las plantillas registradas en Meta (§12.3)", () => {
    expect(AUTO_MESSAGES.map((a) => a.body)).toEqual([
      "Hola {nombre}, en {negocio} ya casi es tu turno (≈ {tiempo}). Ve saliendo. Sigue tu turno aquí: {enlace}",
      "{nombre}, te están llamando en {negocio}. Tienes {minutos} minutos para llegar. Tu turno: {enlace}",
    ]);
  });

  it("REQ-043.2 muestra los enviados y los fallidos del mes", () => {
    const page = html({ sent: 1234, failed: 7, capReached: false });
    expect(page).toMatch(/1\.234/);
    expect(page).toContain("Enviados este mes");
    expect(page).toContain("Fallidos este mes");
    expect(page).not.toContain("tope");
  });

  it("REQ-043.2 avisa de forma visible si se llegó al tope", () => {
    const page = html({ sent: 3000, failed: 0, capReached: true });
    expect(page).toContain('role="alert"');
    expect(page).toContain("tope de 3.000 avisos");
  });
});
