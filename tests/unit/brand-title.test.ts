import { describe, expect, it } from "vitest";
import { publicTitle } from "@/lib/brand";

describe("REQ-091.6 título de la pestaña", () => {
  it("REQ-091.6 no repite Gamma Club cuando el negocio se llama igual que la app", () => {
    // El layout agrega " · Gamma Club": la pestaña queda "Fila · Gamma Club"
    expect(publicTitle("Gamma Club", "Fila")).toBe("Fila");
    expect(publicTitle("gamma club ", "Fila")).toBe("Fila");
  });

  it("REQ-091.6 con otro negocio conserva su nombre delante", () => {
    expect(publicTitle("Barbería La 33", "Fila")).toBe("Barbería La 33 · Fila");
  });
});
