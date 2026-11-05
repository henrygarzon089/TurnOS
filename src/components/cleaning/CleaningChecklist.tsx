"use client";

import { useState } from "react";
import { submitCleaningRecord, type ListItem } from "@/lib/actions/cleaning";
import {
  CAMERA_HINT,
  KIND_LABEL,
  PHOTO_UPLOAD_FAILED,
  recordPhotoPath,
  validateChecklist,
  type ChecklistAnswer,
  type CleaningKind,
} from "@/lib/domain/cleaning";
import { resizePhoto } from "@/lib/media/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * REQ-061: la lista de apertura, cierre o profunda. Casillas de ≥ 48 px; al desmarcar un punto
 * aparece "¿Por qué?". Las fotos se reducen y suben al bucket privado antes de enviar; si una no
 * sube, no se envía nada y lo marcado se conserva (REQ-061.6).
 */
export function CleaningChecklist({
  kind,
  items,
  businessId,
  businessDay,
  onDone,
  onCancel,
}: {
  kind: CleaningKind;
  items: ListItem[];
  businessId: string;
  businessDay: string;
  onDone: (result: { isComplete: boolean; isLate: boolean }) => void;
  onCancel: () => void;
}) {
  const [answers, setAnswers] = useState<ChecklistAnswer[]>(
    items.map((i) => ({ id: i.id, done: true, note: "" })),
  );
  const [files, setFiles] = useState<File[]>([]);
  // Rutas ya subidas por archivo: si el envío falla, no se vuelven a subir
  const [uploaded, setUploaded] = useState<Map<File, string>>(new Map());
  const [error, setError] = useState<{ text: string; itemId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const maxPhotos = kind === "closing" ? 1 : 3;

  function update(id: string, patch: Partial<ChecklistAnswer>) {
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  async function uploadAll(): Promise<string[] | null> {
    const supabase = createSupabaseBrowserClient();
    const paths: string[] = [];
    const next = new Map(uploaded);
    for (const file of files) {
      const done = next.get(file);
      if (done) {
        paths.push(done);
        continue;
      }
      try {
        const blob = await resizePhoto(file);
        if (!blob) return null;
        const path = recordPhotoPath(businessId, businessDay);
        const { error: failed } = await supabase.storage
          .from("cleaning")
          .upload(path, blob, { contentType: blob.type });
        if (failed) return null;
        next.set(file, path);
        paths.push(path);
      } catch {
        return null;
      } finally {
        setUploaded(new Map(next));
      }
    }
    return paths;
  }

  async function send() {
    setError(null);
    const check = validateChecklist(kind, answers, files.length);
    if (!check.ok) {
      setError({ text: check.error, itemId: check.itemId });
      return;
    }
    setBusy(true);
    try {
      const paths = await uploadAll();
      if (!paths) {
        setError({ text: PHOTO_UPLOAD_FAILED });
        return;
      }
      const res = await submitCleaningRecord(kind, answers, paths);
      if (!res.ok) setError({ text: res.error });
      else onDone(res.data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      aria-label={KIND_LABEL[kind]}
      className="border-line bg-card mt-3 space-y-3 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <h2 className="text-lg font-semibold">{KIND_LABEL[kind]}</h2>
      <ul className="space-y-2">
        {items.map((item) => {
          const a = answers.find((x) => x.id === item.id)!;
          return (
            <li key={item.id}>
              <label className="flex min-h-12 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-6 w-6 shrink-0"
                  checked={a.done}
                  onChange={(e) => update(item.id, { done: e.target.checked })}
                />
                <span>{item.label}</span>
              </label>
              {!a.done && (
                <label className="mt-1 block text-sm">
                  ¿Por qué?
                  <textarea
                    className="input mt-1 w-full"
                    rows={2}
                    maxLength={200}
                    value={a.note}
                    aria-invalid={error?.itemId === item.id}
                    onChange={(e) => update(item.id, { note: e.target.value })}
                  />
                </label>
              )}
              {error?.itemId === item.id && (
                <p role="alert" className="text-danger text-sm">
                  {error.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div>
        <p className="font-medium">
          {kind === "closing" ? "Foto del local limpio" : `Fotos (opcional, hasta ${maxPhotos})`}
        </p>
        <p className="text-muted text-sm">{CAMERA_HINT}</p>
        <label className="btn-secondary mt-2 inline-flex min-h-12 items-center">
          Tomar foto
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) setFiles((prev) => (prev.length >= maxPhotos ? [...prev.slice(1), file] : [...prev, file]));
            }}
          />
        </label>
        {files.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {files.map((f, i) => (
              <li key={i} className="flex items-center justify-between gap-2">
                <span className="truncate">Foto {i + 1}</span>
                <button
                  type="button"
                  className="text-muted min-h-12 px-2"
                  onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {error && !error.itemId && (
        <p role="alert" className="text-danger text-sm">
          {error.text}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary flex-1" disabled={busy}>
          {busy ? "Enviando…" : "Enviar"}
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
