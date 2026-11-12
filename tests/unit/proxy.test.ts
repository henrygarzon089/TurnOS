import { afterEach, describe, expect, it, vi } from "vitest";
import { enabledModules, redirectForDisabled } from "@/lib/domain/modules";
import {
  NO_BUSINESS_MESSAGE,
  noBusinessDestination,
  shouldBounceLoginToApp,
} from "@/lib/domain/staff-entry";

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const rpc = vi.fn();
vi.mock("@/lib/db/supabase-gateway", () => ({ createAdminGateway: () => ({ rpc }) }));

const essential = enabledModules("");
const all = enabledModules("todos");

describe("redirectForDisabled (personal)", () => {
  it("REQ-079.5 una ruta apagada del dueño va a su inicio /admin", () => {
    for (const p of [
      "/admin/citas",
      "/admin/membresias",
      "/admin/regalos",
      "/admin/recordar",
      "/admin/limpieza",
      "/admin/mensajes",
      "/admin/citas/otra",
    ]) {
      expect(redirectForDisabled(p, essential), p).toBe("/admin");
    }
  });

  it("REQ-079.5 una ruta apagada de /app va a /app, que reparte por rol (dueño a Hoy, barbero a Mi fila)", () => {
    for (const p of ["/app/limpieza", "/app/mis-fotos"]) {
      expect(redirectForDisabled(p, essential), p).toBe("/app");
    }
  });

  it("REQ-079.5 las rutas encendidas no redirigen", () => {
    for (const p of [
      "/admin",
      "/admin/fila",
      "/admin/caja",
      "/admin/productos",
      "/app",
      "/app/fila",
      "/app/clientes",
      "/app/mis-numeros",
      "/app/estacion",
      "/entrar",
    ]) {
      expect(redirectForDisabled(p, essential), p).toBeNull();
    }
  });

  it("REQ-079.5 con todos los módulos encendidos nada redirige", () => {
    for (const p of ["/admin/citas", "/admin/regalos", "/app/limpieza", "/app/mis-fotos"]) {
      expect(redirectForDisabled(p, all), p).toBeNull();
    }
  });

  it("REQ-080.1 /crear-negocio va a /entrar en esencial y no redirige con todos", () => {
    expect(redirectForDisabled("/crear-negocio", essential)).toBe("/entrar");
    expect(redirectForDisabled("/crear-negocio", all)).toBeNull();
  });

  it("REQ-080.1 sin negocio y sin registro: /entrar con el motivo, sin ciclo con el proxy", () => {
    expect(noBusinessDestination(true)).toBe("/crear-negocio");
    expect(noBusinessDestination(false)).toBe("/entrar?motivo=sin-negocio");
    expect(NO_BUSINESS_MESSAGE).toBe("Tu cuenta no tiene un negocio.");
    // el proxy no devuelve a /app a quien llegó con ese motivo
    expect(shouldBounceLoginToApp(true, "sin-negocio")).toBe(false);
    expect(shouldBounceLoginToApp(true, undefined)).toBe(true);
    expect(shouldBounceLoginToApp(false, undefined)).toBe(false);
  });

  it("REQ-080.1 el enlace de la portada del personal sigue hacia /entrar sin ciclo", () => {
    // /entrar nunca redirige a una ruta que a su vez redirija a /entrar
    expect(redirectForDisabled("/entrar", essential)).toBeNull();
  });
});

describe("oferta de cita (públicas)", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    rpc.mockReset();
  });
  const raw = { enabled: true, barbers: [{ id: "b1", name: "Ana" }], openDays: ["2026-11-13"] };

  it("REQ-079.6 con el módulo apagado la oferta de cita desaparece aunque el negocio la tenga", async () => {
    vi.stubEnv("TURNOS_MODULES", "");
    rpc.mockResolvedValue(raw);
    const { getAppointmentInfo } = await import("@/lib/actions/public-appointments");
    const info = await getAppointmentInfo("gamma-club");
    expect(info?.enabled).toBe(false);
  });

  it("REQ-079.6 con todos los módulos la oferta de cita sigue igual", async () => {
    vi.stubEnv("TURNOS_MODULES", "todos");
    rpc.mockResolvedValue(raw);
    const { getAppointmentInfo } = await import("@/lib/actions/public-appointments");
    const info = await getAppointmentInfo("gamma-club");
    expect(info?.enabled).toBe(true);
  });
});
