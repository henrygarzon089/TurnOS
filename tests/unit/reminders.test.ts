import { describe, expect, it } from "vitest";
import { buildReminderLink } from "@/lib/notifications/reminder";

describe("REQ-020.3 recordatorio por WhatsApp", () => {
  it("REQ-020.3 abre wa.me con el mensaje editable, el nombre del cliente y el enlace de la fila", () => {
    const link = buildReminderLink({
      phoneE164: "+573002000005",
      template: "Hola {nombre}, en {negocio} te extrañamos: {enlace}",
      customerName: "Mateo Londoño",
      businessName: "Barbería La 33",
      queueUrl: "https://turnos.app/la-33",
    });
    expect(link.startsWith("https://wa.me/573002000005?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(
      "Hola Mateo, en Barbería La 33 te extrañamos: https://turnos.app/la-33",
    );
  });
});
