/** Limpieza y bioseguridad (Hito 11, REQ-060…REQ-064, design.md §16). Lógica pura, sin red. */

export type CleaningKind = "opening" | "closing" | "deep";
export type TaskStatus = "overdue" | "soon" | "ok";

export const KIND_LABEL: Record<CleaningKind, string> = {
  opening: "Apertura",
  closing: "Cierre",
  deep: "Limpieza profunda",
};

/** REQ-061.5 */
export const CAMERA_HINT = "Toma la foto del local vacío, sin personas";
/** REQ-061.6 */
export const PHOTO_UPLOAD_FAILED = "No se pudo subir la foto. Intenta de nuevo";
/** REQ-064.6 */
export const PHOTO_PURGED = "Foto borrada (más de 90 días)";

const NOTE_REQUIRED = "Escribe por qué no se hizo";
const NOTE_TOO_LONG = "La nota tiene hasta 200 caracteres";
const PHOTO_REQUIRED = "Falta la foto del local";
const MAX_PHOTOS = 3;

export type ChecklistAnswer = { id: string; done: boolean; note: string };
export type ChecklistCheck = { ok: true } | { ok: false; error: string; itemId?: string };

/** REQ-061.3/061.4: lo mismo que revisa submit_cleaning_record, antes de subir fotos. */
export function validateChecklist(
  kind: CleaningKind,
  answers: ChecklistAnswer[],
  photoCount: number,
): ChecklistCheck {
  for (const a of answers) {
    if (a.done) continue;
    const note = a.note.trim();
    if (!note) return { ok: false, error: NOTE_REQUIRED, itemId: a.id };
    if (note.length > 200) return { ok: false, error: NOTE_TOO_LONG, itemId: a.id };
  }
  if (kind === "closing") {
    if (photoCount === 0) return { ok: false, error: PHOTO_REQUIRED };
    if (photoCount > 1) return { ok: false, error: "El cierre lleva una sola foto" };
  } else if (photoCount > MAX_PHOTOS) {
    return { ok: false, error: `Máximo ${MAX_PHOTOS} fotos` };
  }
  return { ok: true };
}

/** "19:00" → "7:00 p. m." (hora del horario, sin zona). */
export function formatHour(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`;
}

/** REQ-061.2 "La apertura de hoy ya la registró Carlos a las 9:05 a. m." */
export function alreadyRecordedText(kind: CleaningKind, doneBy: string, atIso: string): string {
  const hour = formatHour(atIso.slice(11, 16)); // la base manda la hora de Bogotá
  if (kind === "closing") return `El cierre de hoy ya lo registró ${doneBy} a las ${hour}`;
  if (kind === "deep") return `La limpieza profunda de esta semana ya la registró ${doneBy} a las ${hour}`;
  return `La apertura de hoy ya la registró ${doneBy} a las ${hour}`;
}

const ERRORS: Record<string, string> = {
  CLEANING_DISABLED: "La limpieza está apagada.",
  LIST_CHANGED: "La lista cambió. Vuelve a abrirla",
  INVALID_ITEM: "La lista cambió. Vuelve a abrirla",
  NOTE_REQUIRED,
  PHOTO_REQUIRED,
  TOO_MANY_PHOTOS: `Máximo ${MAX_PHOTOS} fotos`,
  INVALID_PATH: PHOTO_UPLOAD_FAILED,
  INVALID_KIND: "Esa lista no se registra.",
  LIST_EMPTY: "La lista necesita al menos un punto.",
  INVALID_LABEL: "Cada punto tiene de 1 a 80 caracteres.",
  INSPECTION_INCOMPLETE: "Califica todos los puntos: Bien o Falla.",
  INVALID_BARBER: "Ese barbero no está activo.",
  INVALID_NOTE: "La nota tiene hasta 200 caracteres.",
  NOT_MISSED: "Ese día no tiene un cierre pendiente.",
  INVALID_NAME: "Escribe el nombre de la tarea (hasta 80 caracteres).",
  INVALID_FREQUENCY: "La frecuencia va de 1 a 730 días.",
  INVALID_DATE: "La fecha no puede ser futura.",
  NOT_FOUND: "Esa tarea ya no existe.",
  INVALID_WEEKS: "Escoge entre 1 y 52 semanas.",
  FORBIDDEN: "No tienes permiso para esta acción.",
};

type DbError = { message?: string; code?: string; details?: string | null };

function parseDetails(details: string | null | undefined): Record<string, string> | null {
  try {
    const v = JSON.parse(details ?? "");
    return v && typeof v === "object" ? v : null;
  } catch {
    return null;
  }
}

/** Mensaje en español para los errores de las funciones de limpieza (0057–0059). */
export function cleaningErrorMessage(e: DbError | null, kind?: CleaningKind): string {
  const msg = e?.message ?? "";
  if (msg.includes("ALREADY_RECORDED")) {
    const d = parseDetails(e?.details);
    return d?.doneBy && d.at && kind ? alreadyRecordedText(kind, d.doneBy, d.at) : "Ya está registrada.";
  }
  if (msg.includes("CLOSING_TOO_EARLY")) {
    const d = parseDetails(e?.details);
    return d?.from ? `El cierre se registra desde las ${formatHour(d.from)}` : "Todavía no es hora del cierre.";
  }
  const key = Object.keys(ERRORS).find((k) => msg.includes(k));
  if (key) return ERRORS[key];
  if (e?.code === "42501") return ERRORS.FORBIDDEN;
  return "No se pudo guardar. Revisa tu conexión.";
}

// ------------------------------------------------------------ tareas ----

/** REQ-064.1 tareas sugeridas (no se siembran). */
export const TASK_SUGGESTIONS = [
  { name: "Aire acondicionado", everyDays: 30 },
  { name: "Botiquín", everyDays: 30 },
  { name: "Control de plagas", everyDays: 180 },
] as const;

export function pendingSuggestions(existingNames: string[]) {
  const have = new Set(existingNames.map((n) => n.trim().toLocaleLowerCase("es")));
  return TASK_SUGGESTIONS.filter((s) => !have.has(s.name.toLocaleLowerCase("es")));
}

export function taskStatusLabel(status: TaskStatus): string {
  return status === "overdue" ? "Vencida" : status === "soon" ? "Vence pronto" : "Al día";
}

const PDF_MAX = 5 * 1024 * 1024;

/** REQ-064.3 una foto (se reduce antes de subir) o un PDF de hasta 5 MB. */
export function checkAttachment(file: { type: string; size: number }): string | null {
  if (file.type.startsWith("image/")) return null;
  if (file.type === "application/pdf") return file.size > PDF_MAX ? "El PDF pesa más de 5 MB" : null;
  return "Sube una foto o un PDF";
}

// ------------------------------------------------------------- rutas ----
// §16.3 bucket privado `cleaning`; las políticas de Storage admiten solo estas rutas.

export function recordPhotoPath(businessId: string, day: string): string {
  return `${businessId}/records/${day}/${crypto.randomUUID()}.webp`;
}

export function inspectionPhotoPath(businessId: string): string {
  return `${businessId}/inspections/${crypto.randomUUID()}.webp`;
}

export function taskAttachmentPath(businessId: string, taskId: string, type: string): string {
  const ext = type === "application/pdf" ? "pdf" : "webp";
  return `${businessId}/tasks/${taskId}/${crypto.randomUUID()}.${ext}`;
}
