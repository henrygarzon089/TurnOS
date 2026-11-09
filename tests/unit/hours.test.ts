import { describe, expect, it } from "vitest";
import { hourOptions } from "@/lib/domain/hours";

/** T-181 · REQ-078.33 / REQ-078.20: el horario con un selector propio en español (design §22.8). */
describe("horario: opciones del selector de horas", () => {
  it("REQ-078.33 las horas salen en español, cada 15 minutos, de 12:00 a. m. a 11:45 p. m. y fin del día", () => {
    const opts = hourOptions();
    expect(opts[0]).toEqual({ value: "00:00", label: "12:00 a. m." });
    expect(opts[1]).toEqual({ value: "00:15", label: "12:15 a. m." });
    expect(opts.find((o) => o.value === "09:00")?.label).toBe("9:00 a. m.");
    expect(opts.find((o) => o.value === "12:00")?.label).toBe("12:00 p. m.");
    expect(opts.find((o) => o.value === "20:00")?.label).toBe("8:00 p. m.");
    // 96 cuartos de hora + "11:59 p. m." para un local que abre hasta la medianoche
    expect(opts).toHaveLength(97);
    expect(opts.at(-1)).toEqual({ value: "23:59", label: "11:59 p. m." });
    for (const o of opts) expect(o.label).not.toMatch(/AM|PM/);
  });

  it("REQ-078.33 una hora guardada fuera de los cuartos de hora no se pierde: se agrega en su lugar", () => {
    const opts = hourOptions(["09:10", "09:00"]);
    expect(opts).toHaveLength(98);
    const i = opts.findIndex((o) => o.value === "09:10");
    expect(opts[i]).toEqual({ value: "09:10", label: "9:10 a. m." });
    expect(opts[i - 1].value).toBe("09:00");
    expect(opts[i + 1].value).toBe("09:15");
  });

  it("REQ-078.33 acepta la hora con segundos como la devuelve la base", () => {
    const opts = hourOptions(["08:05:00"]);
    expect(opts.some((o) => o.value === "08:05")).toBe(true);
  });
});
