import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
  insert: vi.fn(),
  signInWithPassword: vi.fn(),
  getStaffSession: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT ${url}`);
  },
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));
vi.mock("@/lib/auth/session", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth/session")>()),
  getStaffSession: m.getStaffSession,
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { signInWithPassword: m.signInWithPassword },
    from: () => ({
      insert: (row: unknown) => {
        m.insert(row);
        return { select: () => ({ single: async () => ({ error: { message: "x" } }) }) };
      },
    }),
  }),
}));

import { createBarber } from "@/lib/actions/admin";
import { signInBarber } from "@/lib/actions/auth";
import { barberEmailFromPhone } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";
import { BarberPhoneInputs } from "@/components/admin/BarberForms";

afterEach(() => vi.clearAllMocks());

const OWNER = { role: "owner", business: { id: "b1", name: "Gamma Club", slug: "gamma-club" } };

function barberForm(phone: string, country?: "co" | "other"): FormData {
  const f = new FormData();
  f.set("display_name", "Pedro");
  f.set("phone", phone);
  f.set("commission_pct", "50");
  if (country) f.set("phone_country", country);
  return f;
}

describe("REQ-081 barbero con celular de otro país", () => {
  it("REQ-081.1 el formulario del barbero ofrece Colombia (+57) por defecto y Otro país", () => {
    const html = renderToStaticMarkup(<BarberPhoneInputs idPrefix="nb" />);
    expect(html).toContain("País del celular");
    expect(html).toContain('name="phone_country"');
    expect(html).toMatch(/<option value="co" selected="">Colombia \(\+57\)<\/option>/);
    expect(html).toContain("Otro país");
  });

  it("REQ-081.1 crear un barbero con otro país guarda el número E.164 con indicativo", async () => {
    m.getStaffSession.mockResolvedValue(OWNER);
    await createBarber({}, barberForm("+54 9 11 2345 6789", "other"));
    expect(m.insert).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: "Pedro", phone_e164: "+5491123456789" }),
    );
  });

  it("REQ-081.1 sin escoger país, el celular sigue siendo colombiano", async () => {
    m.getStaffSession.mockResolvedValue(OWNER);
    await createBarber({}, barberForm("300 123 4567"));
    expect(m.insert).toHaveBeenCalledWith(expect.objectContaining({ phone_e164: "+573001234567" }));
    const r = await createBarber({}, barberForm("+54 9 11 2345 6789"));
    expect(r.error).toBe("Escribe un celular colombiano de 10 dígitos.");
  });

  it("REQ-081.2 un número de otro país inválido se rechaza con el mensaje del indicativo", async () => {
    m.getStaffSession.mockResolvedValue(OWNER);
    const r = await createBarber({}, barberForm("5491123456789", "other"));
    expect(r.error).toBe(
      "Escribe el celular con el indicativo del país, por ejemplo +54 9 11 2345 6789.",
    );
    expect(m.insert).not.toHaveBeenCalled();
  });

  it("REQ-081.3 la cuenta alias de la invitación sirve con un número de otro país", () => {
    expect(barberEmailFromPhone("+5491123456789")).toBe("5491123456789@barberos.turnos.local");
  });

  it("REQ-081.4 la pantalla de entrar ofrece 'Mi celular no es de Colombia'", () => {
    const html = renderToStaticMarkup(<LoginForm initialTab="barber" />);
    expect(html).toContain("Mi celular no es de Colombia");
    expect(html).toContain('name="phone_country" value="co"');
  });

  it("REQ-081.4 el barbero entra con su número de otro país y su PIN", async () => {
    m.signInWithPassword.mockResolvedValue({ error: null });
    const f = new FormData();
    f.set("phone", "+54 9 11 2345 6789");
    f.set("phone_country", "other");
    f.set("pin", "123456");
    await expect(signInBarber(undefined, f)).rejects.toThrow("NEXT_REDIRECT /app");
    expect(m.signInWithPassword).toHaveBeenCalledWith({
      email: "5491123456789@barberos.turnos.local",
      password: "123456",
    });
  });

  it("REQ-081.5 al editar a un barbero de otro país, sale 'Otro país' y su número completo", () => {
    const html = renderToStaticMarkup(
      <BarberPhoneInputs idPrefix="p_1" phoneE164="+5491123456789" />,
    );
    expect(html).toMatch(/<option value="other" selected="">Otro país<\/option>/);
    expect(html).toContain('value="+5491123456789"');
  });

  it("REQ-081.6 las acciones de clientes siguen solo con celular colombiano", () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) walk(p);
        else if (/\.tsx?$/.test(name)) files.push(p);
      }
    };
    walk("src");
    const users = files
      .filter((f) => readFileSync(f, "utf8").includes("normalizeBarberPhone"))
      .map((f) => f.replace(/\\/g, "/"))
      .sort();
    expect(users).toEqual([
      "src/lib/actions/admin.ts",
      "src/lib/actions/auth.ts",
      "src/lib/domain/phone.ts",
    ]);
    // En admin.ts, solo crear y editar barbero lo usan (el contacto del negocio sigue colombiano)
    const admin = readFileSync("src/lib/actions/admin.ts", "utf8");
    expect(admin.match(/normalizeBarberPhone\(/g)).toHaveLength(1);
    expect(admin.match(/barberPhone\(parsed\.data\.phone, formData\)/g)).toHaveLength(2);
  });
});
