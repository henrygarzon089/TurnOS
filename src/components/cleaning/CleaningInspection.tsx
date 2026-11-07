"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitInspection, type ListItem } from "@/lib/actions/cleaning";
import {
  CAMERA_HINT,
  cleaningErrorMessage,
  inspectionPhotoPath,
  PHOTO_UPLOAD_FAILED,
} from "@/lib/domain/cleaning";
import { resizePhoto } from "@/lib/media/resize";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type Answer = {
  id: string;
  ok: boolean | null;
  note: string;
  barberId: string;
  file: File | null;
  path: string | null;
};

/**
 * REQ-063.1–063.3: la revisión del dueño. Lista de Cierre más "Estaciones entre clientes"; cada punto
 * queda Bien o Falla, con nota y foto opcionales, y la falla se puede asignar a un barbero activo.
 * Solo la ve el dueño (REQ-063.4): la página vive bajo /admin.
 */
export function CleaningInspection({
  closing,
  betweenClients,
  barbers,
  businessId,
}: {
  closing: ListItem[];
  betweenClients: ListItem[];
  barbers: { id: string; name: string }[];
  businessId: string;
}) {
  const router = useRouter();
  const fresh = () =>
    [...closing, ...betweenClients].map((i) => ({
      id: i.id,
      ok: null,
      note: "",
      barberId: "",
      file: null,
      path: null,
    }));
  const [answers, setAnswers] = useState<Answer[]>(fresh);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function update(id: string, patch: Partial<Answer>) {
    setAnswers((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  }

  /** Sube las fotos que falten; si una no sube, no se envía nada (como en REQ-061.6). */
  async function uploadAll(): Promise<Answer[] | null> {
    const supabase = createSupabaseBrowserClient();
    const next = [...answers];
    for (let i = 0; i < next.length; i++) {
      const a = next[i];
      if (!a.file || a.path) continue;
      try {
        const blob = await resizePhoto(a.file);
        if (!blob) return null;
        const path = inspectionPhotoPath(businessId);
        const { error: failed } = await supabase.storage
          .from("cleaning")
          .upload(path, blob, { contentType: blob.type });
        if (failed) return null;
        next[i] = { ...a, path };
      } catch {
        return null;
      } finally {
        setAnswers([...next]);
      }
    }
    return next;
  }

  async function send() {
    setError(null);
    setNotice(null);
    if (answers.some((a) => a.ok === null)) {
      setError(cleaningErrorMessage({ message: "INSPECTION_INCOMPLETE" }));
      return;
    }
    setBusy(true);
    try {
      const done = await uploadAll();
      if (!done) {
        setError(PHOTO_UPLOAD_FAILED);
        return;
      }
      const res = await submitInspection(
        done.map((a) => ({
          id: a.id,
          ok: a.ok,
          note: a.note,
          photoPath: a.path,
          barberId: a.barberId || null,
        })),
      );
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const n = res.data.failures;
      setNotice(
        n === 0
          ? "Revisión guardada, todo bien."
          : `Revisión guardada con ${n} ${n === 1 ? "falla" : "fallas"}.`,
      );
      setAnswers(fresh());
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  const group = (title: string, items: ListItem[]) => (
    <section aria-label={title} className="space-y-3">
      <h3 className="font-semibold">{title}</h3>
      {items.map((item) => {
        const a = answers.find((x) => x.id === item.id)!;
        return (
          <fieldset key={item.id} className="border-line rounded-sm border p-2">
            <legend className="px-1">{item.label}</legend>
            <div className="flex gap-2">
              {([true, false] as const).map((v) => (
                <label
                  key={String(v)}
                  className={`flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm border font-semibold ${
                    a.ok === v
                      ? v
                        ? "border-ok text-ok"
                        : "border-danger text-danger"
                      : "border-line"
                  }`}
                >
                  <input
                    type="radio"
                    name={`ok-${item.id}`}
                    className="sr-only"
                    checked={a.ok === v}
                    onChange={() => update(item.id, { ok: v, barberId: v ? "" : a.barberId })}
                  />
                  {v ? "Bien" : "Falla"}
                </label>
              ))}
            </div>
            {a.ok === false && (
              <label className="mt-2 block text-sm">
                Barbero
                <select
                  className="input mt-1 w-full"
                  value={a.barberId}
                  onChange={(e) => update(item.id, { barberId: e.target.value })}
                >
                  <option value="">General (sin barbero)</option>
                  {barbers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {a.ok !== null && (
              <div className="mt-2 space-y-2">
                <label className="block text-sm">
                  Nota (opcional)
                  <textarea
                    className="input mt-1 w-full"
                    rows={2}
                    maxLength={200}
                    value={a.note}
                    onChange={(e) => update(item.id, { note: e.target.value })}
                  />
                </label>
                <label className="btn-secondary inline-flex min-h-12 items-center">
                  {a.file ? "Cambiar foto" : "Tomar foto"}
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) update(item.id, { file, path: null });
                    }}
                  />
                </label>
              </div>
            )}
          </fieldset>
        );
      })}
    </section>
  );

  return (
    <form
      aria-label="Revisión"
      className="border-line bg-card mt-3 space-y-4 rounded-md border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Revisión</h2>
        <button
          type="button"
          className="btn-secondary min-h-10 px-3 text-sm"
          onClick={() =>
            setAnswers((prev) => prev.map((a) => (a.ok === null ? { ...a, ok: true } : a)))
          }
        >
          Lo demás, bien
        </button>
      </div>
      <p className="text-muted text-sm">{CAMERA_HINT}</p>
      {notice && (
        <p role="status" className="text-ok text-sm font-semibold">
          {notice}
        </p>
      )}
      {group("Cierre", closing)}
      {group("Estaciones entre clientes", betweenClients)}
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Guardando…" : "Guardar revisión"}
      </button>
    </form>
  );
}
