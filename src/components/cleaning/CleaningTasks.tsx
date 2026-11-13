"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  getTaskAttachmentUrl,
  recordCleaningTaskRun,
  saveCleaningTask,
  type CleaningTask,
} from "@/lib/actions/cleaning";
import {
  checkAttachment,
  pendingSuggestions,
  PHOTO_UPLOAD_FAILED,
  taskAttachmentPath,
  taskStatusLabel,
} from "@/lib/domain/cleaning";
import { businessDayBogota, formatDayCO } from "@/lib/domain/time";
import { resizePhoto } from "@/lib/media/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

const STATUS_CLASS = { overdue: "text-danger", soon: "text-warn", ok: "text-ok" } as const;

/** REQ-064.1: nombre de 1 a 80 caracteres y frecuencia de 1 a 730 días. */
function TaskForm({
  initial,
  submitLabel,
  onSaved,
  onCancel,
}: {
  initial: { id: string | null; name: string; everyDays: number; isActive: boolean };
  submitLabel: string;
  onSaved: () => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial.name);
  const [days, setDays] = useState(initial.everyDays ? String(initial.everyDays) : "");
  const [isActive, setIsActive] = useState(initial.isActive);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    const res = await saveCleaningTask({
      id: initial.id,
      name: name.trim(),
      everyDays: Number(days),
      isActive,
    });
    if (!res.ok) setError(res.error);
    else onSaved();
  }

  return (
    <form
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="block text-sm">
        Nombre
        <input
          className="input mt-1 w-full"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Cada cuántos días
        <input
          className="input mt-1 w-full"
          inputMode="numeric"
          value={days}
          onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))}
        />
      </label>
      {initial.id && (
        <label className="flex min-h-12 items-center gap-3 text-sm">
          <input
            type="checkbox"
            className="h-6 w-6"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
          Activa
        </label>
      )}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1">
          {submitLabel}
        </button>
        {onCancel && (
          <button type="button" className="btn-secondary" onClick={onCancel}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

/** REQ-064.2/064.3: fecha de hoy o anterior, nota y un adjunto (foto reducida o PDF ≤ 5 MB). */
function RunForm({
  task,
  businessId,
  onSaved,
  onCancel,
}: {
  task: CleaningTask;
  businessId: string;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const today = businessDayBogota();
  const [doneOn, setDoneOn] = useState(today);
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  // Ruta ya subida: si el registro falla, no se vuelve a subir
  const [path, setPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload(): Promise<string | null | false> {
    if (!file) return null;
    if (path) return path;
    try {
      const blob = file.type === "application/pdf" ? file : await resizePhoto(file);
      if (!blob) return false;
      const target = taskAttachmentPath(businessId, task.id, file.type);
      const { error: failed } = await createSupabaseBrowserClient()
        .storage.from("cleaning")
        .upload(target, blob, { contentType: blob.type });
      if (failed) return false;
      setPath(target);
      return target;
    } catch {
      return false;
    }
  }

  async function save() {
    setError(null);
    setBusy(true);
    try {
      const attachment = await upload();
      if (attachment === false) {
        setError(PHOTO_UPLOAD_FAILED);
        return;
      }
      const res = await recordCleaningTaskRun({
        taskId: task.id,
        doneOn,
        note,
        attachmentPath: attachment,
      });
      if (!res.ok) setError(res.error);
      else onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label={`Registrar ${task.name}`}
      className="mt-2 space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="block text-sm">
        Fecha
        <input
          type="date"
          className="input mt-1 w-full"
          max={today}
          value={doneOn}
          onChange={(e) => setDoneOn(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        Nota (opcional)
        <textarea
          className="input mt-1 w-full"
          rows={2}
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      <label className="btn-secondary inline-flex items-center">
        {file ? "Cambiar adjunto" : "Adjuntar foto o PDF"}
        <input
          type="file"
          accept="image/*,application/pdf"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            const bad = checkAttachment(f);
            setError(bad);
            if (!bad) {
              setFile(f);
              setPath(null);
            }
          }}
        />
      </label>
      {file && <p className="text-muted truncate text-sm">{file.name}</p>}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? "Guardando…" : "Guardar registro"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function TaskCard({ task, businessId }: { task: CleaningTask; businessId: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "run" | "edit">("view");
  const done = () => {
    setMode("view");
    router.refresh();
  };

  // La pestaña se abre antes de esperar la URL firmada: Safari bloquea window.open tras un await
  async function openAttachment(path: string) {
    const tab = window.open("about:blank", "_blank");
    const url = await getTaskAttachmentUrl(path);
    if (!url) tab?.close();
    else if (tab) tab.location.href = url;
    else window.location.assign(url);
  }

  return (
    <section aria-label={task.name} className="border-line bg-card mt-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{task.name}</h2>
        <span
          className={`text-sm font-semibold ${task.isActive ? STATUS_CLASS[task.status] : "text-muted"}`}
        >
          {task.isActive ? taskStatusLabel(task.status) : "Inactiva"}
        </span>
      </div>
      <p className="text-muted text-sm">
        Cada {task.everyDays} {task.everyDays === 1 ? "día" : "días"}
        {task.lastDone && ` · Última: ${formatDayCO(task.lastDone)}`}
        {task.nextDue && ` · Próxima: ${formatDayCO(task.nextDue)}`}
      </p>
      {mode === "view" && (
        <div className="mt-2 flex gap-2">
          <button type="button" className="btn-primary flex-1" onClick={() => setMode("run")}>
            Registrar
          </button>
          <button type="button" className="btn-secondary" onClick={() => setMode("edit")}>
            Editar
          </button>
        </div>
      )}
      {mode === "run" && (
        <RunForm
          task={task}
          businessId={businessId}
          onSaved={done}
          onCancel={() => setMode("view")}
        />
      )}
      {mode === "edit" && (
        <TaskForm
          initial={task}
          submitLabel="Guardar"
          onSaved={done}
          onCancel={() => setMode("view")}
        />
      )}
      {task.runs.length > 0 && (
        <ul aria-label={`Historial de ${task.name}`} className="mt-3 space-y-1 text-sm">
          {task.runs.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2">
              <span>
                {formatDayCO(r.doneOn)}
                {r.note && <span className="text-muted"> · {r.note}</span>}
              </span>
              {r.attachmentPath && (
                <button
                  type="button"
                  className="text-brand min-h-12 px-2 font-semibold underline underline-offset-4"
                  onClick={() => void openAttachment(r.attachmentPath!)}
                >
                  Ver adjunto
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** REQ-064.1–064.4: la pestaña Tareas de /admin/limpieza. Solo el dueño. */
export function CleaningTasks({
  tasks,
  businessId,
}: {
  tasks: CleaningTask[];
  businessId: string;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suggestions = pendingSuggestions(tasks.map((t) => t.name));

  async function addSuggestion(name: string, everyDays: number) {
    setError(null);
    const res = await saveCleaningTask({ id: null, name, everyDays, isActive: true });
    if (!res.ok) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="mt-3">
      {suggestions.length > 0 && (
        <div className="border-line bg-card rounded-md border p-3">
          <h2 className="font-semibold">Sugeridas</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s.name}
                type="button"
                className="btn-secondary px-3"
                onClick={() => void addSuggestion(s.name, s.everyDays)}
              >
                Agregar {s.name} (cada {s.everyDays} días)
              </button>
            ))}
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-danger mt-2 text-sm">
          {error}
        </p>
      )}
      {tasks.length === 0 && (
        <p className="text-muted mt-3 text-sm">Todavía no hay tareas periódicas.</p>
      )}
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} businessId={businessId} />
      ))}
      <div className="border-line bg-card mt-3 rounded-md border p-3">
        {adding ? (
          <TaskForm
            initial={{ id: null, name: "", everyDays: 0, isActive: true }}
            submitLabel="Crear tarea"
            onSaved={() => {
              setAdding(false);
              router.refresh();
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button type="button" className="btn-secondary w-full" onClick={() => setAdding(true)}>
            Nueva tarea
          </button>
        )}
      </div>
    </div>
  );
}
