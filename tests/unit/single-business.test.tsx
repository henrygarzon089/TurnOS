import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), createUser: vi.fn() }));
const redirect = vi.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT ${url}`);
});
vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => redirect(url),
  useRouter: () => ({ refresh: () => {}, push: () => {} }),
  usePathname: () => "/",
}));
vi.mock("@/lib/auth/session", () => ({ getStaffSession: vi.fn(), barberEmailFromPhone: vi.fn() }));
vi.mock("@/lib/actions/auth", () => ({ signInBarber: vi.fn(), signInOwner: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({ auth: { admin: { createUser: m.createUser } } }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getUser: m.getUser }, rpc: m.rpc }),
}));

import { createBusiness } from "@/lib/actions/admin";
import { LoginForm } from "@/components/auth/LoginForm";
import HomePage from "@/app/page";
import { HOME_SLUG } from "@/lib/domain/modules";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function form(): FormData {
  const f = new FormData();
  f.set("name", "Otro Negocio");
  f.set("slug", "otro-negocio");
  f.set("email", "a@b.co");
  f.set("password", "12345678");
  return f;
}

describe("un solo negocio (REQ-080)", () => {
  it("REQ-080.1 el formulario de entrar no pinta el enlace a crear negocio sin canSignup", () => {
    const sin = renderToStaticMarkup(<LoginForm initialTab="owner" />);
    expect(sin).not.toContain("/crear-negocio");
    const con = renderToStaticMarkup(<LoginForm initialTab="owner" canSignup />);
    expect(con).toContain("/crear-negocio");
  });

  it("REQ-080.1 createBusiness rechaza con signup apagado, en español, sin tocar la base", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    const r = await createBusiness(undefined, form());
    expect(r?.error).toBe("Crear negocios nuevos no está disponible.");
    expect(m.getUser).not.toHaveBeenCalled();
    expect(m.createUser).not.toHaveBeenCalled();
    expect(m.rpc).not.toHaveBeenCalled();
  });

  it("REQ-080.1 con todos los módulos createBusiness sigue su camino normal", async () => {
    vi.stubEnv("TURNOS_MODULES", "todos");
    m.getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    m.rpc.mockResolvedValue({ error: null });
    await createBusiness(undefined, form()).catch(() => {});
    expect(m.rpc).toHaveBeenCalledWith("create_business", expect.anything());
  });

  it("REQ-080.2 la portada en modo esencial redirige al negocio único", () => {
    vi.stubEnv("TURNOS_MODULES", "");
    expect(() => HomePage()).toThrow(`NEXT_REDIRECT /${HOME_SLUG}`);
  });

  it("REQ-080.2 con todos los módulos la portada de hoy se muestra", () => {
    vi.stubEnv("TURNOS_MODULES", "todos");
    const out = renderToStaticMarkup(HomePage() as React.ReactElement);
    expect(out).toContain("TurnOS");
    expect(redirect).not.toHaveBeenCalled();
  });
});
