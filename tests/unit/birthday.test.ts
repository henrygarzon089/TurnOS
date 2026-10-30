import { describe, expect, it } from "vitest";
import { BIRTHDAY_INVALID, celebrationLabel, parseBirthday } from "@/lib/domain/birthday";
import { buildBirthdayLink } from "@/lib/notifications/reminder";

describe("REQ-037.1 / REQ-037.3 día y mes de cumpleaños", () => {
  it("REQ-037.1 es opcional: sin día ni mes no hay cumpleaños", () => {
    expect(parseBirthday("", "")).toEqual({ ok: true, birthday: null });
    expect(parseBirthday(undefined, undefined)).toEqual({ ok: true, birthday: null });
    expect(parseBirthday(" ", null)).toEqual({ ok: true, birthday: null });
  });

  it("REQ-037.1 guarda día y mes como números, sin año", () => {
    expect(parseBirthday("7", "11")).toEqual({ ok: true, birthday: { day: 7, month: 11 } });
    expect(parseBirthday("07", "1")).toEqual({ ok: true, birthday: { day: 7, month: 1 } });
  });

  it("REQ-037.3 el 31 de abril no existe", () => {
    expect(parseBirthday("31", "4")).toEqual({ ok: false, error: BIRTHDAY_INVALID });
  });

  it("REQ-037.3 el 30 de febrero no existe", () => {
    expect(parseBirthday("30", "2")).toEqual({ ok: false, error: BIRTHDAY_INVALID });
  });

  it("REQ-037.3 el 29 de febrero es válido", () => {
    expect(parseBirthday("29", "2")).toEqual({ ok: true, birthday: { day: 29, month: 2 } });
  });

  it("REQ-037.3 el texto del error es 'Esa fecha no existe'", () => {
    expect(BIRTHDAY_INVALID).toBe("Esa fecha no existe");
  });

  it("REQ-037.3 día 0, mes 13 o letras tampoco existen", () => {
    for (const [d, m] of [
      ["0", "5"],
      ["32", "1"],
      ["10", "13"],
      ["10", "0"],
      ["1.5", "2"],
      ["x", "2"],
    ]) {
      expect(parseBirthday(d, m)).toEqual({ ok: false, error: BIRTHDAY_INVALID });
    }
  });

  it("REQ-037.1 día sin mes (o al revés) pide los dos", () => {
    expect(parseBirthday("7", "")).toEqual({ ok: false, error: "Escribe el día y el mes." });
    expect(parseBirthday("", "7")).toEqual({ ok: false, error: "Escribe el día y el mes." });
  });
});

describe("REQ-037.4 lista y plantilla de cumpleaños", () => {
  it("REQ-037.4 el botón de WhatsApp usa la plantilla con {nombre} y {negocio}", () => {
    const link = buildBirthdayLink({
      phoneE164: "+573002000005",
      template: "¡Feliz cumpleaños, {nombre}! En {negocio} te deseamos un gran día.",
      customerName: "Mateo Londoño",
      businessName: "Barbería La 33",
    });
    expect(link.startsWith("https://wa.me/573002000005?text=")).toBe(true);
    expect(decodeURIComponent(link.split("text=")[1])).toBe(
      "¡Feliz cumpleaños, Mateo! En Barbería La 33 te deseamos un gran día.",
    );
  });

  it("REQ-037.4 cada fila dice cuándo celebra: hoy, mañana o la fecha", () => {
    expect(celebrationLabel("2026-10-30", "2026-10-30")).toBe("Hoy");
    expect(celebrationLabel("2026-10-31", "2026-10-30")).toBe("Mañana");
    expect(celebrationLabel("2026-11-01", "2026-10-30")).toBe("Domingo 1 de noviembre");
    expect(celebrationLabel("2027-01-02", "2026-12-30")).toBe("Sábado 2 de enero");
  });
});
