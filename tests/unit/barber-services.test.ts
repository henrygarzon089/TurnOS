import { describe, expect, it } from "vitest";
import { barbersForService, serviceAvailability } from "@/lib/domain/barber-services";

const today = [
  { id: "juan", name: "Juan", status: "available" as const },
  { id: "ana", name: "Ana", status: "paused" as const },
];
const corte = { id: "corte", barberIds: ["juan", "ana", "luis"] };
const cepillado = { id: "cep", barberIds: ["ana"] };
const tinte = { id: "tinte", barberIds: ["luis"] };

describe("REQ-035.6 barberos del formulario según el servicio", () => {
  it("REQ-035.6 solo los presentes que hacen el servicio", () => {
    expect(barbersForService(cepillado, today).map((b) => b.id)).toEqual(["ana"]);
    expect(barbersForService(corte, today).map((b) => b.id)).toEqual(["juan", "ana"]);
  });
  it("REQ-035.6 sin dato de quién lo hace (datos viejos) se muestran todos", () => {
    expect(barbersForService({ id: "x" }, today)).toHaveLength(2);
  });
});

describe("REQ-035.7 servicio que hoy nadie hace", () => {
  it("REQ-035.7 si ninguno de los presentes lo hace, no se puede escoger", () => {
    expect(serviceAvailability(tinte, today)).toBe("nobody_today");
  });
  it("REQ-035.7 si quien lo hace está en pausa, sigue disponible", () => {
    expect(serviceAvailability(cepillado, today)).toBe("available");
  });
  it("REQ-035.7 con nadie presente todavía, todo sigue disponible (Q16)", () => {
    expect(serviceAvailability(tinte, [])).toBe("available");
  });
});
