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
import { Icon } from "@/components/ui/Icon";
import { resizePhoto } from "@/lib/media/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Answer = ChecklistAnswer & { skipped: boolean };

/** Lo que falta para enviar: puntos sin marcar y sin "¿Por qué?", y la foto del cierre (REQ-061.3/4). */
export function missingText(missing: number, needsPhoto: boolean): string {
  const items = missing === 1 ? "falta 1" : `faltan ${missing}`;
  if (missing > 0 && needsPhoto) return `Enviar (${items} y la foto)`;
  if (missing > 0) return `Enviar (${items})`;
  if (needsPhoto) return "Enviar (falta la foto)";
  return "Enviar";
}

/**
 * REQ-061: la lista de apertura, cierre o profunda, como el tablero Barbero-Otros (T-171): casillas
 * de 48 px que empiezan sin marcar; "No se hizo" abre "¿Por qué?" (REQ-061.3). La foto es un recuadro
 * "Tomar foto" de 150 px que se vuelve la vista previa (REQ-078.20). "Enviar" dice lo que falta y no
 * se deja tocar hasta que esté todo. Las fotos se reducen y suben al bucket privado antes de enviar;
 * si una no sube, no se envía nada y lo marcado se conserva (REQ-061.6).
 */
export function CleaningChecklist({
  kind,
  items,
  businessId,
  businessDay,
  onDone,
  onCancel,
  fixed = false,
}: {
  kind: CleaningKind;
  items: ListItem[];
  businessId: string;
  businessDay: string;
  onDone: (result: { isComplete: boolean; isLate: boolean }) => void;
  onCancel?: () => void;
  /** El botón de enviar queda fijo sobre la barra del barbero. */
  fixed?: boolean;
}) {
  const [answers, setAnswers] = useState<Answer[]>(
    items.map((i) => ({ id: i.id, done: false, note: "", skipped: false })),
  );
  const [files, setFiles] = useState<{ file: File; url: string }[]>([]);
  // Rutas ya subidas por archivo: si el envío falla, no se vuelven a subir
  const [uploaded, setUploaded] = useState<Map<File, string>>(new Map());
  const [error, setError] = useState<{ text: string; itemId?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const maxPhotos = kind === "closing" ? 1 : 3;
  const missing = answers.filter((a) => !a.done && !(a.skipped && a.note.trim())).length;
  const needsPhoto = kind === "closing" && files.length === 0;

  function update(id: string, patch: Partial<Answer>) {
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  function addFile(file: File) {
    setFiles((prev) => {
      const next = { file, url: URL.createObjectURL(file) };
      if (prev.length < maxPhotos) return [...prev, next];
      URL.revokeObjectURL(prev[0].url);
      return [...prev.slice(1), next];
    });
  }

  function removeFile(f: File) {
    setFiles((prev) => {
      prev.filter((x) => x.file === f).forEach((x) => URL.revokeObjectURL(x.url));
      return prev.filter((x) => x.file !== f);
    });
  }

  async function uploadAll(): Promise<string[] | null> {
    const supabase = createSupabaseBrowserClient();
    const paths: string[] = [];
    const next = new Map(uploaded);
    for (const { file } of files) {
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
    const plain = answers.map(({ id, done, note }) => ({ id, done, note: done ? "" : note }));
    const check = validateChecklist(kind, plain, files.length);
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
      const res = await submitCleaningRecord(kind, plain, paths);
      if (!res.ok) setError({ text: res.error });
      else onDone(res.data);
    } finally {
      setBusy(false);
    }
  }

  const sendButton = (
    <button
      type="submit"
      // Deshabilitado en gris, como el tablero: no compite con la pestaña elegida
      className="btn-primary disabled:bg-skeleton disabled:text-muted w-full disabled:opacity-100"
      disabled={busy || missing > 0 || needsPhoto}
    >
      {busy ? "Enviando…" : missingText(missing, needsPhoto)}
    </button>
  );

  return (
    <form
      aria-label={KIND_LABEL[kind]}
      className={fixed ? "pb-24" : "border-line bg-card mt-3 rounded-md border pb-4"}
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {!fixed && <h2 className="px-4 pt-4 text-lg font-semibold">{KIND_LABEL[kind]}</h2>}
      <ul className="divide-line border-line divide-y border-b">
        {items.map((item) => {
          const a = answers.find((x) => x.id === item.id)!;
          return (
            <li key={item.id} className="px-4">
              <div className="flex items-center gap-2">
                <label className="flex min-h-12 flex-1 items-center gap-3 py-1">
                  <input
                    type="checkbox"
                    className="accent-brand h-6 w-6 shrink-0"
                    checked={a.done}
                    onChange={(e) => update(item.id, { done: e.target.checked, skipped: false })}
                  />
                  <span>{item.label}</span>
                </label>
                {!a.done && !a.skipped && (
                  <button
                    type="button"
                    className="text-muted min-h-12 shrink-0 px-1 text-sm underline underline-offset-2"
                    aria-label={`No se hizo: ${item.label}`}
                    onClick={() => update(item.id, { skipped: true })}
                  >
                    No se hizo
                  </button>
                )}
              </div>
              {!a.done && a.skipped && (
                <label className="block pb-3 text-sm">
                  ¿Por qué?
                  <textarea
                    className="input mt-1 w-full"
                    rows={2}
                    maxLength={200}
                    value={a.note}
                    autoFocus
                    aria-invalid={error?.itemId === item.id}
                    onChange={(e) => update(item.id, { note: e.target.value })}
                  />
                </label>
              )}
              {error?.itemId === item.id && (
                <p role="alert" className="text-danger pb-2 text-sm">
                  {error.text}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="px-4">
        <p className="text-muted pt-5 pb-1 text-xs font-semibold tracking-wide uppercase">
          {kind === "closing"
            ? "Foto del local limpio"
            : `Foto de la estación (opcional, hasta ${maxPhotos})`}
        </p>
        <p className="text-muted pb-2 text-sm">{CAMERA_HINT}</p>
        <div className="flex flex-col gap-2">
          {files.map(({ file, url }, i) => (
            <div key={url} className="relative h-[150px] overflow-hidden rounded-md">
              {/* eslint-disable-next-line @next/next/no-img-element -- vista previa local (blob:) */}
              <img src={url} alt={`Foto ${i + 1}`} className="h-full w-full object-cover" />
              <button
                type="button"
                className="bg-card text-ink absolute top-2 right-2 min-h-10 rounded-sm px-3 text-sm font-semibold"
                onClick={() => removeFile(file)}
              >
                Quitar
              </button>
            </div>
          ))}
          {files.length < maxPhotos && (
            <label className="border-line-strong text-ink flex h-[150px] cursor-pointer flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed text-sm font-semibold">
              <Icon name="camera" className="h-6 w-6" />
              <span>Tomar foto</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  if (file) addFile(file);
                }}
              />
            </label>
          )}
        </div>
      </div>

      {error && !error.itemId && (
        <p role="alert" className="text-danger px-4 pt-3 text-sm">
          {error.text}
        </p>
      )}
      {fixed ? (
        <div className="bg-card border-line fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t px-4 py-3">
          <div className="mx-auto max-w-md">{sendButton}</div>
        </div>
      ) : (
        <div className="flex gap-2 px-4 pt-4">
          <div className="flex-1">{sendButton}</div>
          {onCancel && (
            <button type="button" className="btn-secondary" onClick={onCancel} disabled={busy}>
              Cancelar
            </button>
          )}
        </div>
      )}
    </form>
  );
}
