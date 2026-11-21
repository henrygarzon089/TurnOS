import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/actions/jobs", () => ({ setJobStatus: vi.fn(), deleteJob: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ getStaffSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: vi.fn() }));

import { JobApplications, type JobApplicationRow } from "@/components/admin/JobApplications";
import { NavJobsCount } from "@/components/admin/NavJobsCount";

const row = (over: Partial<JobApplicationRow>): JobApplicationRow => ({
  id: "j1",
  full_name: "Camilo Ruiz",
  phone_e164: "+573001234567",
  role: "barbero",
  years_experience: 3,
  portfolio_url: "https://instagram.com/camilo",
  availability: "tiempo_completo",
  message: "Me gusta el degradado",
  status: "nueva",
  created_at: "2026-11-18T15:00:00Z",
  ...over,
});

const now = new Date("2026-11-20T15:00:00Z");
const html = (rows: JobApplicationRow[]) =>
  renderToStaticMarkup(<JobApplications rows={rows} businessName="Gamma Club" now={now} />);

describe("REQ-102.6 Postulaciones del dueño", () => {
  it("REQ-102.6 cada postulación muestra sus datos y las acciones", () => {
    const h = html([row({})]);
    for (const t of [
      "Camilo Ruiz",
      "Barbero · 3 años · Tiempo completo",
      "300 123 4567",
      "Ver su trabajo",
      "Me gusta el degradado",
      "Hace 2 días",
      "Escribir por WhatsApp",
      "Marcar contactada",
      "Descartar",
      "Borrar datos",
    ])
      expect(h).toContain(t);
    expect(h).toContain("https://wa.me/573001234567?text=");
  });

  it("REQ-102.6 separa nuevas, contactadas y descartadas con su número", () => {
    const h = html([row({}), row({ id: "j2", status: "contactada" }), row({ id: "j3", status: "descartada" })]);
    expect(h).toContain("Nuevas (1)");
    expect(h).toContain("Contactadas (1)");
    expect(h).toContain("Descartadas (1)");
    expect(h).toContain("Volver a nuevas");
  });

  it("REQ-102.6 sin postulaciones dice de dónde llegan", () => {
    expect(html([])).toContain("No hay postulaciones nuevas");
  });

  it("REQ-102.6 celular de otro país se muestra completo", () => {
    expect(html([row({ phone_e164: "+5491155550001" })])).toContain("+5491155550001");
  });

  it("REQ-102.6 el menú cuenta las nuevas y en cero no pinta nada", async () => {
    const one = renderToStaticMarkup(await NavJobsCount({ load: async () => 2 }));
    expect(one).toContain('aria-label="2 postulaciones nuevas"');
    expect(await NavJobsCount({ load: async () => 0 })).toBeNull();
    expect(await NavJobsCount({ load: async () => Promise.reject(new Error("x")) })).toBeNull();
  });

  it("REQ-102.7 la pantalla lee con la sesión del dueño (RLS), no con service_role", () => {
    const page = readFileSync("src/app/(staff)/admin/postulaciones/page.tsx", "utf8");
    expect(page).toContain("createSupabaseServerClient");
    expect(page).not.toMatch(/service_role|createSupabaseAdminClient|createAdminGateway/);
  });
});
