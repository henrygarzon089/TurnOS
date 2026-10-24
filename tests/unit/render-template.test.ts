import { describe, expect, it } from "vitest";
import { renderTemplate } from "@/lib/notifications/render";

describe("REQ-033.1 plantillas de WhatsApp", () => {
  it("reemplaza las variables conocidas", () => {
    expect(
      renderTemplate("Hola {nombre}, te saluda {negocio}. Faltan 2 turnos ({tiempo}): {enlace}", {
        nombre: "Camilo",
        negocio: "La 33",
        tiempo: "≈ 25 min",
        enlace: "https://x/t/abc",
      }),
    ).toBe("Hola Camilo, te saluda La 33. Faltan 2 turnos (≈ 25 min): https://x/t/abc");
  });

  it("deja intactas las variables sin valor o desconocidas", () => {
    expect(renderTemplate("{nombre} {otra} {tiempo}", { nombre: "Ana" })).toBe(
      "Ana {otra} {tiempo}",
    );
  });
});
