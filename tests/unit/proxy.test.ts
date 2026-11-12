import { afterEach, describe, expect, it, vi } from "vitest";
import { enabledModules, redirectForDisabled } from "@/lib/domain/modules";

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

  it("REQ-079.5 una ruta apagada del barbero va a Mi fila", () => {
    for (const p of ["/app/limpieza", "/app/mis-fotos"]) {
      expect(redirectForDisabled(p, essential), p).toBe("/app/fila");
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

  it("REQ-079.5 /crear-negocio no redirige todavía (lo agrega T-189)", () => {
    expect(redirectForDisabled("/crear-negocio", essential)).toBeNull();
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
