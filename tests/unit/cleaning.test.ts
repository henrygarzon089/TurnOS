import { describe, expect, it, vi } from "vitest";
import {
  alreadyRecordedText,
  CAMERA_HINT,
  checkAttachment,
  cleaningErrorMessage,
  formatHour,
  inspectionPhotoPath,
  pendingSuggestions,
  PHOTO_PURGED,
  PHOTO_UPLOAD_FAILED,
  recordPhotoPath,
  taskAttachmentPath,
  taskStatusLabel,
  TASK_SUGGESTIONS,
  validateChecklist,
} from "@/lib/domain/cleaning";
import { purgeCleaningPhotos } from "@/lib/cleaning/purge";
import type { Gateway } from "@/lib/db/gateway";

const BIZ = "11111111-1111-4111-8111-111111111111";
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

describe("REQ-061 llenar la lista", () => {
  const all = (done: boolean) => [
    { id: "a", done, note: "" },
    { id: "b", done: true, note: "" },
  ];

  it("REQ-061.3 un punto sin marcar pide nota, y señala cuál", () => {
    expect(validateChecklist("opening", all(false), 0)).toEqual({
      ok: false,
      error: "Escribe por qué no se hizo",
      itemId: "a",
    });
    expect(validateChecklist("opening", [{ id: "a", done: false, note: "   " }], 0).ok).toBe(false);
    expect(validateChecklist("opening", [{ id: "a", done: false, note: "Llovía" }], 0)).toEqual({ ok: true });
  });

  it("REQ-061.3 la nota tiene hasta 200 caracteres", () => {
    expect(validateChecklist("opening", [{ id: "a", done: false, note: "x".repeat(201) }], 0)).toEqual({
      ok: false,
      error: "La nota tiene hasta 200 caracteres",
      itemId: "a",
    });
  });

  it("REQ-061.4 el cierre lleva exactamente una foto; apertura y profunda hasta 3", () => {
    expect(validateChecklist("closing", all(true), 0)).toEqual({ ok: false, error: "Falta la foto del local" });
    expect(validateChecklist("closing", all(true), 2)).toEqual({ ok: false, error: "El cierre lleva una sola foto" });
    expect(validateChecklist("closing", all(true), 1)).toEqual({ ok: true });
    expect(validateChecklist("deep", all(true), 0)).toEqual({ ok: true });
    expect(validateChecklist("opening", all(true), 4)).toEqual({ ok: false, error: "Máximo 3 fotos" });
  });

  it("REQ-061.5 antes de la cámara se pide el local vacío", () => {
    expect(CAMERA_HINT).toBe("Toma la foto del local vacío, sin personas");
  });

  it("REQ-061.6 si la foto no sube, el aviso pide intentar de nuevo", () => {
    expect(PHOTO_UPLOAD_FAILED).toBe("No se pudo subir la foto. Intenta de nuevo");
  });
});

describe("REQ-061 mensajes de la base en español", () => {
  it("REQ-061.2 dice quién registró y a qué hora", () => {
    expect(alreadyRecordedText("opening", "Carlos", "2026-11-10T09:05:00-05:00")).toBe(
      "La apertura de hoy ya la registró Carlos a las 9:05 a. m.",
    );
    expect(alreadyRecordedText("closing", "Dueño", "2026-11-10T19:30:00-05:00")).toBe(
      "El cierre de hoy ya lo registró Dueño a las 7:30 p. m.",
    );
    expect(alreadyRecordedText("deep", "Juan", "2026-11-10T12:00:00-05:00")).toBe(
      "La limpieza profunda de esta semana ya la registró Juan a las 12:00 p. m.",
    );
    expect(
      cleaningErrorMessage(
        { message: "ALREADY_RECORDED", details: '{"at": "2026-11-10T09:05:00-05:00", "doneBy": "Carlos"}' },
        "opening",
      ),
    ).toBe("La apertura de hoy ya la registró Carlos a las 9:05 a. m.");
  });

  it("REQ-061.7 el cierre temprano dice desde qué hora", () => {
    expect(formatHour("19:00")).toBe("7:00 p. m.");
    expect(formatHour("09:30")).toBe("9:30 a. m.");
    expect(formatHour("12:00")).toBe("12:00 p. m.");
    expect(formatHour("00:15")).toBe("12:15 a. m.");
    expect(cleaningErrorMessage({ message: "CLOSING_TOO_EARLY", details: '{"from": "19:00"}' })).toBe(
      "El cierre se registra desde las 7:00 p. m.",
    );
  });

  it("REQ-060.5 la lista cambió mientras se llenaba", () => {
    expect(cleaningErrorMessage({ message: "LIST_CHANGED" })).toBe("La lista cambió. Vuelve a abrirla");
  });

  it("REQ-061.3 los demás errores tienen su texto, y lo desconocido no asusta", () => {
    expect(cleaningErrorMessage({ message: "NOTE_REQUIRED" })).toBe("Escribe por qué no se hizo");
    expect(cleaningErrorMessage({ message: "PHOTO_REQUIRED" })).toBe("Falta la foto del local");
    expect(cleaningErrorMessage({ code: "42501", message: "FORBIDDEN" })).toBe("No tienes permiso para esta acción.");
    expect(cleaningErrorMessage(null)).toBe("No se pudo guardar. Revisa tu conexión.");
    expect(cleaningErrorMessage({ message: "ALREADY_RECORDED", details: "no es json" }, "opening")).toBe(
      "Ya está registrada.",
    );
  });
});

describe("REQ-064 tareas periódicas y fotos", () => {
  it("REQ-064.1 sugiere aire, botiquín y plagas, sin repetir las que ya existen", () => {
    expect(TASK_SUGGESTIONS).toEqual([
      { name: "Aire acondicionado", everyDays: 30 },
      { name: "Botiquín", everyDays: 30 },
      { name: "Control de plagas", everyDays: 180 },
    ]);
    expect(pendingSuggestions(["botiquín "]).map((s) => s.name)).toEqual(["Aire acondicionado", "Control de plagas"]);
  });

  it("REQ-064.3 el adjunto es una foto o un PDF de hasta 5 MB", () => {
    expect(checkAttachment({ type: "image/jpeg", size: 9_000_000 })).toBeNull();
    expect(checkAttachment({ type: "application/pdf", size: 5 * 1024 * 1024 })).toBeNull();
    expect(checkAttachment({ type: "application/pdf", size: 5 * 1024 * 1024 + 1 })).toBe("El PDF pesa más de 5 MB");
    expect(checkAttachment({ type: "text/plain", size: 10 })).toBe("Sube una foto o un PDF");
  });

  it("REQ-064.4 el estado de la tarea en palabras", () => {
    expect(taskStatusLabel("overdue")).toBe("Vencida");
    expect(taskStatusLabel("soon")).toBe("Vence pronto");
    expect(taskStatusLabel("ok")).toBe("Al día");
  });

  it("REQ-064.5 las rutas van en las carpetas privadas que admiten las políticas", () => {
    expect(recordPhotoPath(BIZ, "2026-11-10")).toMatch(new RegExp(`^${BIZ}/records/2026-11-10/${UUID}\\.webp$`));
    expect(inspectionPhotoPath(BIZ)).toMatch(new RegExp(`^${BIZ}/inspections/${UUID}\\.webp$`));
    expect(taskAttachmentPath(BIZ, BIZ, "application/pdf")).toMatch(new RegExp(`^${BIZ}/tasks/${BIZ}/${UUID}\\.pdf$`));
    expect(taskAttachmentPath(BIZ, BIZ, "image/webp")).toMatch(/\.webp$/);
  });

  it("REQ-064.6 la foto vieja se reemplaza por el aviso", () => {
    expect(PHOTO_PURGED).toBe("Foto borrada (más de 90 días)");
  });
});

describe("REQ-064.6 purga de fotos a los 90 días", () => {
  function fakeGateway(over: Partial<Record<string, unknown>> = {}) {
    const calls: { fn: string; args: Record<string, unknown> }[] = [];
    const answers: Record<string, unknown> = {
      cleaning_purge_claim: true,
      cleaning_photos_to_purge: {
        records: [{ id: "r1", paths: ["a/records/x.webp"] }],
        inspections: [{ id: "i1", paths: ["a/inspections/y.webp", "a/inspections/z.webp"] }],
      },
      mark_cleaning_photos_purged: null,
      ...over,
    };
    const gateway: Gateway = {
      rpc: vi.fn(async <T>(fn: string, args: Record<string, unknown>) => {
        calls.push({ fn, args });
        return answers[fn] as T;
      }) as Gateway["rpc"],
    };
    return { gateway, calls };
  }

  it("REQ-064.6 borra los archivos y después marca los registros", async () => {
    const { gateway, calls } = fakeGateway();
    const remove = vi.fn(async () => true);
    expect(await purgeCleaningPhotos("biz", { gateway, removeObjects: remove })).toEqual({ purged: 3 });
    expect(remove).toHaveBeenCalledWith(["a/records/x.webp", "a/inspections/y.webp", "a/inspections/z.webp"]);
    expect(calls.at(-1)).toEqual({
      fn: "mark_cleaning_photos_purged",
      args: { p_business_id: "biz", p_record_ids: ["r1"], p_inspection_ids: ["i1"] },
    });
  });

  it("REQ-064.6 corre una vez por día: sin claim no toca nada", async () => {
    const { gateway, calls } = fakeGateway({ cleaning_purge_claim: false });
    const remove = vi.fn(async () => true);
    expect(await purgeCleaningPhotos("biz", { gateway, removeObjects: remove })).toEqual({ purged: 0 });
    expect(remove).not.toHaveBeenCalled();
    expect(calls).toHaveLength(1);
  });

  it("REQ-064.6 si Storage falla no marca nada (se reintenta otro día)", async () => {
    const { gateway, calls } = fakeGateway();
    const remove = vi.fn(async () => false);
    expect(await purgeCleaningPhotos("biz", { gateway, removeObjects: remove })).toEqual({ purged: 0 });
    expect(calls.map((c) => c.fn)).not.toContain("mark_cleaning_photos_purged");
  });

  it("REQ-064.6 sin fotos viejas no llama a Storage", async () => {
    const { gateway } = fakeGateway({ cleaning_photos_to_purge: { records: [], inspections: [] } });
    const remove = vi.fn(async () => true);
    expect(await purgeCleaningPhotos("biz", { gateway, removeObjects: remove })).toEqual({ purged: 0 });
    expect(remove).not.toHaveBeenCalled();
  });

  it("REQ-064.6 un error de la base no rompe la pantalla que la disparó", async () => {
    const gateway: Gateway = {
      rpc: vi.fn(async () => {
        throw new Error("boom");
      }) as Gateway["rpc"],
    };
    expect(await purgeCleaningPhotos("biz", { gateway, removeObjects: vi.fn(async () => true) })).toEqual({ purged: 0 });
  });
});
