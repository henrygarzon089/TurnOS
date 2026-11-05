import { describe, expect, it } from "vitest";
import { expectedUse, isConsumptionAlert } from "@/lib/domain/inventory";

describe("inventario: consumo esperado y alerta (design.md §18.3, ejemplo M)", () => {
  it("REQ-073.2 esperado = Σ servicios ÷ rendimiento, con 2 decimales", () => {
    expect(expectedUse([{ services: 30, servicesPerUnit: 40 }])).toBe(0.75);
    expect(expectedUse([{ services: 12, servicesPerUnit: 50 }])).toBe(0.24);
    expect(expectedUse([
      { services: 10, servicesPerUnit: 3 },
      { services: 5, servicesPerUnit: 6 },
    ])).toBe(4.17);
  });

  it("REQ-073.2 los servicios en \"Midiendo\" no suman al esperado", () => {
    expect(expectedUse([
      { services: 30, servicesPerUnit: 40 },
      { services: 20, servicesPerUnit: null },
    ])).toBe(0.75);
    expect(expectedUse([])).toBe(0);
  });

  it("REQ-073.4 alerta si pasa el porcentaje del negocio y al menos una unidad entera", () => {
    expect(isConsumptionAlert(2, 0.75, 10)).toBe(true); // cera del ejemplo M
    expect(isConsumptionAlert(1, 0.24, 10)).toBe(false); // guantes: una caja abierta no es exceso
    expect(isConsumptionAlert(11, 10, 10)).toBe(false); // justo en el 10 %
    expect(isConsumptionAlert(12, 10, 10)).toBe(true);
    expect(isConsumptionAlert(2, 0.6, 300)).toBe(false); // el porcentaje es del negocio
    expect(isConsumptionAlert(1, 0, 10)).toBe(true); // gastó sin servicios que lo expliquen
    expect(isConsumptionAlert(0, 0, 10)).toBe(false);
  });
});
