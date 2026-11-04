import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/** T-086 (REQ-054.5): las plantillas de citas en /admin/mensajes. */
const m = vi.hoisted(() => ({ session: vi.fn(), upsert: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/lib/notifications/after-queue-change", () => ({ afterQueueChange: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({
  getStaffSession: m.session,
  barberEmailFromPhone: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    from: () => ({ upsert: async (rows: unknown) => (m.upsert(rows), { error: null }) }),
  }),
}));

import { TemplatesForm, type TemplateKey } from "@/components/admin/SettingsForms";
import { saveTemplates } from "@/lib/actions/admin";

const TEMPLATES: Record<TemplateKey, string> = {
  notify_2_turns: "a {nombre}",
  reminder_inactive: "b {nombre}",
  share_queue: "c {enlace}",
  birthday: "d {nombre}",
  membership_renewal: "e {fecha}",
  gift_card: "f {valor}",
  appointment_confirm: "Hola {nombre}, tu cita es el {fecha} a las {hora}: {enlace}",
  appointment_reminder: "Recuerda {nombre}: mañana a las {hora}",
  appointment_cancelled: "{nombre}, cancelamos tu cita de las {hora}",
};

beforeEach(() => {
  vi.clearAllMocks();
  m.session.mockResolvedValue({ role: "owner", business: { id: "biz-1", name: "Filo" } });
});

describe("REQ-054.5 plantillas de citas", () => {
  it("REQ-054.5 /admin/mensajes trae Confirmar cita, Recordar cita y Cita cancelada con {hora}", () => {
    const html = renderToStaticMarkup(
      createElement(TemplatesForm, { templates: TEMPLATES, businessName: "Filo" }),
    );
    for (const title of ["Confirmar cita", "Recordar cita", "Cita cancelada"])
      expect(html).toContain(title);
    expect(html).toContain("{nombre} {negocio} {fecha} {hora} {enlace}");
    // vista previa con las variables llenas
    expect(html).toContain("Recuerda Camilo: mañana a las 10:30 a. m.");
  });

  it("REQ-054.5 guardar incluye las tres plantillas de citas", async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(TEMPLATES)) fd.set(k, v);
    expect(await saveTemplates(undefined, fd)).toEqual({ ok: true });
    const keys = (m.upsert.mock.calls[0][0] as { key: string }[]).map((r) => r.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        "appointment_confirm",
        "appointment_reminder",
        "appointment_cancelled",
      ]),
    );
  });

  it("REQ-054.5 una plantilla de cita vacía no se guarda", async () => {
    const fd = new FormData();
    for (const [k, v] of Object.entries(TEMPLATES)) fd.set(k, v);
    fd.set("appointment_reminder", "  ");
    expect(await saveTemplates(undefined, fd)).toEqual({
      error: "Cada plantilla debe tener entre 1 y 1000 caracteres.",
    });
    expect(m.upsert).not.toHaveBeenCalled();
  });
});
