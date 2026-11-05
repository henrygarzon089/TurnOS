"use server";

import { after } from "next/server";
import { getStaffSession } from "@/lib/auth/session";
import { purgeCleaningPhotos } from "@/lib/cleaning/purge";
import { createAdminGateway } from "@/lib/db/supabase-gateway";
import {
  cleaningErrorMessage,
  type CleaningKind,
  type ChecklistAnswer,
  type TaskStatus,
  validateChecklist,
} from "@/lib/domain/cleaning";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Limpieza (Hito 11, design.md §16.6). Todas las funciones SQL validan el negocio y el rol por
 * dentro; aquí se llaman con la sesión del usuario. Las fotos las sube el navegador directo al
 * bucket privado `cleaning` (§16.3) y estas acciones solo guardan las rutas.
 */

// ---------------------------------------------------------------- tipos ----

export type ListItem = { id: string; label: string };
export type RecordSummary = {
  id: string;
  kind: CleaningKind;
  businessDay: string;
  doneBy: string;
  at: string;
  isComplete: boolean;
  isLate: boolean;
};

export type CleaningToday =
  | { enabled: false }
  | {
      enabled: true;
      isOwner: boolean;
      businessDay: string;
      weekStart: string;
      isOpenDay: boolean;
      opensAt: string | null;
      closesAt: string | null;
      closingFrom: string | null;
      openingPending: boolean;
      opening: RecordSummary | null;
      closing: RecordSummary | null;
      deep: RecordSummary | null;
      lists: { opening: ListItem[]; closing: ListItem[]; deep: ListItem[]; betweenClients?: ListItem[] };
    };

export type OwnerSummary =
  | { enabled: false }
  | {
      enabled: true;
      businessDay: string;
      openingPending: boolean;
      missedClosings: { day: string }[];
      deepPending: boolean;
      deepMissedWeeks: string[];
      flagged: (RecordSummary & { day: string; notes: { label: string; note: string }[] })[];
      tasksDue: { id: string; name: string; nextDue: string | null; overdue: boolean }[];
    };

export type HistoryWeek = {
  weekStart: string;
  deepDone: boolean;
  missedClosings: number;
  inspections: number;
  generalFailures: number;
  barbers: {
    barberId: string | null;
    name: string;
    complete: number;
    incomplete: number;
    late: number;
    failures: number;
  }[];
  entries: (
    | (RecordSummary & { type: "record" })
    | { type: "inspection"; id: string; businessDay: string; at: string; doneBy: string; failures: number }
  )[];
};

export type RecordDetail = RecordSummary & {
  items: { label: string; done: boolean; note: string | null }[];
  photos: string[];
  photosPurged: boolean;
};

export type InspectionItem = {
  group: "closing" | "between_clients";
  label: string;
  ok: boolean;
  note: string | null;
  photoPath: string | null;
  barberId: string | null;
  photoPurged?: boolean;
};
export type InspectionDetail = {
  id: string;
  at: string;
  doneBy: string;
  items: InspectionItem[];
  photosPurged: boolean;
};

export type CleaningTask = {
  id: string;
  name: string;
  everyDays: number;
  isActive: boolean;
  lastDone: string | null;
  nextDue: string | null;
  status: TaskStatus;
  runs: { id: string; doneOn: string; note: string | null; attachmentPath: string | null; at: string }[];
};

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const SESSION_ENDED = "Tu sesión terminó. Entra de nuevo.";
const ONLY_OWNER = "Solo el dueño puede hacer esto.";

async function staff() {
  const session = await getStaffSession();
  if (!session) return null;
  return { session, supabase: await createSupabaseServerClient() };
}

async function owner() {
  const s = await staff();
  return s?.session.role === "owner" ? s : null;
}

/** REQ-064.6: la purga corre después de responder, una vez al día (no frena la pantalla). */
function schedulePurge(businessId: string) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  after(() =>
    purgeCleaningPhotos(businessId, {
      gateway: createAdminGateway(),
      removeObjects: async (paths) => {
        const { error } = await createSupabaseAdminClient().storage.from("cleaning").remove(paths);
        return !error;
      },
    }),
  );
}

// ---------------------------------------------------------------- lectura ----

/** REQ-061.11/062.1: "Limpieza" del barbero (y la pestaña Hoy del dueño). */
export async function getCleaningToday(): Promise<CleaningToday | null> {
  const s = await staff();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("cleaning_today", { p_business_id: s.session.business.id });
  if (error) return null;
  const today = data as CleaningToday;
  if (today.enabled) schedulePurge(s.session.business.id);
  return today;
}

/** REQ-062.3–062.5, REQ-064.4: tarjeta "Limpieza" del panel del dueño. */
export async function getOwnerCleaningSummary(): Promise<OwnerSummary | null> {
  const s = await owner();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("cleaning_owner_summary", { p_business_id: s.session.business.id });
  if (error) return null;
  const summary = data as OwnerSummary;
  if (summary.enabled) schedulePurge(s.session.business.id);
  return summary;
}

/** REQ-063.5 */
export async function getCleaningHistory(weeks = 8): Promise<HistoryWeek[] | null> {
  const s = await owner();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("cleaning_history", {
    p_business_id: s.session.business.id,
    p_weeks: weeks,
  });
  return error ? null : (data as HistoryWeek[]);
}

/** URL firmadas de 1 hora con la sesión del usuario: las políticas deciden qué puede abrir (§16.3). */
async function signedUrls(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  paths: string[],
): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data } = await supabase.storage.from("cleaning").createSignedUrls(paths, 3600);
  const urls: Record<string, string> = {};
  for (const d of data ?? []) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl;
  return urls;
}

/** REQ-063.6: un registro con sus puntos, notas y fotos (si no pasaron 90 días). */
export async function getRecordDetail(
  id: string,
): Promise<(RecordDetail & { photoUrls: string[] }) | null> {
  const s = await owner();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("cleaning_record_detail", { p_id: id });
  if (error) return null;
  const detail = data as RecordDetail;
  const urls = await signedUrls(s.supabase, detail.photos);
  return { ...detail, photoUrls: detail.photos.map((p) => urls[p]).filter(Boolean) };
}

/** REQ-063.6: una revisión con sus fallas, notas y fotos. */
export async function getInspectionDetail(
  id: string,
): Promise<(InspectionDetail & { photoUrls: Record<string, string> }) | null> {
  const s = await owner();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("cleaning_inspection_detail", { p_id: id });
  if (error) return null;
  const detail = data as InspectionDetail;
  const paths = detail.items.map((i) => i.photoPath).filter((p): p is string => Boolean(p));
  return { ...detail, photoUrls: await signedUrls(s.supabase, paths) };
}

/** REQ-064.4 */
export async function getCleaningTasks(): Promise<CleaningTask[] | null> {
  const s = await owner();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("cleaning_tasks_list", { p_business_id: s.session.business.id });
  return error ? null : (data as CleaningTask[]);
}

/** URL firmada de un adjunto de tarea (solo el dueño la puede abrir). */
export async function getTaskAttachmentUrl(path: string): Promise<string | null> {
  const s = await owner();
  if (!s) return null;
  const urls = await signedUrls(s.supabase, [path]);
  return urls[path] ?? null;
}

// ---------------------------------------------------------------- escritura ----

/** REQ-061: envía una lista ya llena; las fotos ya están en Storage. */
export async function submitCleaningRecord(
  kind: CleaningKind,
  answers: ChecklistAnswer[],
  photoPaths: string[],
): Promise<ActionResult<{ isComplete: boolean; isLate: boolean }>> {
  const s = await staff();
  if (!s) return { ok: false, error: SESSION_ENDED };
  const check = validateChecklist(kind, answers, photoPaths.length);
  if (!check.ok) return { ok: false, error: check.error };
  const { data, error } = await s.supabase.rpc("submit_cleaning_record", {
    p_business_id: s.session.business.id,
    p_kind: kind,
    p_items: answers.map((a) => ({ id: a.id, done: a.done, note: a.done ? null : a.note.trim() })),
    p_photo_paths: photoPaths,
  });
  if (error) return { ok: false, error: cleaningErrorMessage(error, kind) };
  return { ok: true, data: data as { isComplete: boolean; isLate: boolean } };
}

/** REQ-060.1/060.2 */
export async function setCleaningEnabled(enabled: boolean): Promise<ActionResult> {
  const s = await owner();
  if (!s) return { ok: false, error: ONLY_OWNER };
  const { error } = await s.supabase.rpc("cleaning_set_enabled", {
    p_business_id: s.session.business.id,
    p_enabled: enabled,
  });
  return error ? { ok: false, error: cleaningErrorMessage(error) } : { ok: true, data: undefined };
}

/** REQ-060.3: la lista completa en su orden (id null = punto nuevo). */
export async function saveCleaningList(
  kind: CleaningKind | "between_clients",
  items: { id: string | null; label: string }[],
): Promise<ActionResult<ListItem[]>> {
  const s = await owner();
  if (!s) return { ok: false, error: ONLY_OWNER };
  const { data, error } = await s.supabase.rpc("cleaning_save_list", {
    p_business_id: s.session.business.id,
    p_kind: kind,
    p_items: items,
  });
  return error ? { ok: false, error: cleaningErrorMessage(error) } : { ok: true, data: data as ListItem[] };
}

/** Las 4 listas para la pestaña Listas (el dueño las lee con RLS). */
export async function getCleaningLists(): Promise<Record<string, ListItem[]> | null> {
  const s = await owner();
  if (!s) return null;
  const { data, error } = await s.supabase
    .from("cleaning_checklist_items")
    .select("id, kind, label")
    .eq("business_id", s.session.business.id)
    .order("sort_order");
  if (error) return null;
  const lists: Record<string, ListItem[]> = { opening: [], closing: [], deep: [], between_clients: [] };
  for (const r of data as { id: string; kind: string; label: string }[]) {
    lists[r.kind]?.push({ id: r.id, label: r.label });
  }
  return lists;
}

/** REQ-062.3 */
export async function ackMissedClosing(day: string, note: string): Promise<ActionResult> {
  const s = await owner();
  if (!s) return { ok: false, error: ONLY_OWNER };
  const { error } = await s.supabase.rpc("ack_missed_closing", {
    p_business_id: s.session.business.id,
    p_day: day,
    p_note: note.trim() || null,
  });
  return error ? { ok: false, error: cleaningErrorMessage(error) } : { ok: true, data: undefined };
}

/** REQ-063.1–063.3 */
export async function submitInspection(
  items: { id: string; ok: boolean | null; note: string; photoPath: string | null; barberId: string | null }[],
): Promise<ActionResult<{ failures: number }>> {
  const s = await owner();
  if (!s) return { ok: false, error: ONLY_OWNER };
  if (items.some((i) => i.ok === null)) return { ok: false, error: cleaningErrorMessage({ message: "INSPECTION_INCOMPLETE" }) };
  const { data, error } = await s.supabase.rpc("submit_cleaning_inspection", {
    p_business_id: s.session.business.id,
    p_items: items.map((i) => ({
      id: i.id,
      ok: i.ok,
      note: i.note.trim() || null,
      photoPath: i.photoPath,
      barberId: i.ok ? null : i.barberId,
    })),
  });
  return error ? { ok: false, error: cleaningErrorMessage(error) } : { ok: true, data: data as { failures: number } };
}

/** REQ-064.1 */
export async function saveCleaningTask(task: {
  id: string | null;
  name: string;
  everyDays: number;
  isActive: boolean;
}): Promise<ActionResult<string>> {
  const s = await owner();
  if (!s) return { ok: false, error: ONLY_OWNER };
  const { data, error } = await s.supabase.rpc("save_cleaning_task", {
    p_business_id: s.session.business.id,
    p_id: task.id,
    p_name: task.name,
    p_every_days: task.everyDays,
    p_is_active: task.isActive,
  });
  return error ? { ok: false, error: cleaningErrorMessage(error) } : { ok: true, data: data as string };
}

/** REQ-064.2/064.3: el adjunto ya está en Storage. */
export async function recordCleaningTaskRun(run: {
  taskId: string;
  doneOn: string;
  note: string;
  attachmentPath: string | null;
}): Promise<ActionResult> {
  const s = await owner();
  if (!s) return { ok: false, error: ONLY_OWNER };
  const { error } = await s.supabase.rpc("record_cleaning_task_run", {
    p_business_id: s.session.business.id,
    p_task_id: run.taskId,
    p_done_on: run.doneOn,
    p_note: run.note.trim() || null,
    p_attachment_path: run.attachmentPath,
  });
  return error ? { ok: false, error: cleaningErrorMessage(error) } : { ok: true, data: undefined };
}
