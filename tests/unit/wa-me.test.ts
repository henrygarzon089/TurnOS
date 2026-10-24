import { describe, expect, it } from "vitest";
import { waMeChannel } from "@/lib/notifications/channel";

describe("REQ-009.2 enlace wa.me con mensaje prellenado", () => {
  it("usa el número E.164 sin + y codifica el texto con las variables", () => {
    const link = waMeChannel.buildLink({
      phoneE164: "+573001234567",
      template: "Hola {nombre}, te saluda {negocio}. Faltan 2 turnos ({tiempo}). {enlace}",
      vars: { nombre: "Camilo", negocio: "La 33", tiempo: "≈ 25 min", enlace: "https://x/t/abc" },
    });
    expect(link).toBe(
      "https://wa.me/573001234567?text=" +
        encodeURIComponent(
          "Hola Camilo, te saluda La 33. Faltan 2 turnos (≈ 25 min). https://x/t/abc",
        ),
    );
    expect(link!.startsWith("https://wa.me/573001234567?text=Hola%20Camilo")).toBe(true);
  });
});
