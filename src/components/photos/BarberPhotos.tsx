"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { deleteBarberPhoto, uploadBarberPhoto } from "@/lib/actions/photos";
import {
  checkPhotoUpload,
  MAX_BARBER_PHOTOS,
  NOT_A_PHOTO_ERROR,
  PHOTO_CONSENT_LABEL,
  PHOTO_LIMIT_ERROR,
  PHOTO_TOO_BIG_ERROR,
  type BarberPhoto,
} from "@/lib/media/barber-photos";
import { mediaUrl } from "@/lib/media/paths";
import { resizePhoto } from "@/lib/media/resize";

type Draft = { blob: Blob; url: string };

/** REQ-039.1–039.4: subir y borrar fotos de un barbero (`/app/mis-fotos` y `/admin/barberos`). */
export function BarberPhotos({
  barberId,
  barberName,
  photos,
}: {
  barberId: string;
  barberName: string;
  photos: BarberPhoto[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = photos.length >= MAX_BARBER_PHOTOS || error === PHOTO_LIMIT_ERROR;

  function changeDraft(next: Draft | null) {
    if (draft) URL.revokeObjectURL(draft.url);
    setDraft(next);
    setConsent(false);
  }

  async function pick(file: File) {
    setError(null);
    changeDraft(null);
    if (!file.type.startsWith("image/")) {
      setError(NOT_A_PHOTO_ERROR);
      return;
    }
    setReading(true);
    try {
      const blob = await resizePhoto(file);
      if (blob) changeDraft({ blob, url: URL.createObjectURL(blob) });
      else setError(PHOTO_TOO_BIG_ERROR);
    } catch {
      setError(NOT_A_PHOTO_ERROR); // createImageBitmap no pudo leerlo
    } finally {
      setReading(false);
    }
  }

  function upload() {
    if (!draft) return;
    const invalid = checkPhotoUpload({ consent, type: draft.blob.type, size: draft.blob.size });
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);
    const form = new FormData();
    form.set("barber_id", barberId);
    form.set("consent", "on");
    form.set("photo", draft.blob, "foto.webp");
    startTransition(async () => {
      const r = await uploadBarberPhoto(form);
      if (r.ok) changeDraft(null);
      else setError(r.error);
      if (r.ok || r.error === PHOTO_LIMIT_ERROR) router.refresh();
    });
  }

  function remove(id: string) {
    if (!window.confirm("¿Borrar esta foto?")) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteBarberPhoto(id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted text-sm">
        {photos.length} de {MAX_BARBER_PHOTOS} fotos
      </p>

      {full ? (
        <p role="alert" className="text-warn rounded-xl bg-amber-50 p-3 text-sm font-medium">
          {PHOTO_LIMIT_ERROR}
        </p>
      ) : (
        <>
          <label className="flex flex-col gap-1 text-sm font-medium">
            Escoger foto
            <input
              type="file"
              accept="image/*"
              disabled={reading || pending}
              className="input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // deja volver a escoger el mismo archivo
                if (file) void pick(file);
              }}
            />
          </label>
          {reading && <p className="text-muted text-sm">Preparando foto…</p>}
          {draft && (
            <div className="flex flex-col gap-3">
              <Image
                src={draft.url}
                alt="Foto por subir"
                width={96}
                height={96}
                unoptimized
                className="h-24 w-24 rounded-lg object-cover"
              />
              {/* REQ-039.3: se confirma foto por foto */}
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="mt-0.5 h-6 w-6 shrink-0"
                />
                <span>{PHOTO_CONSENT_LABEL}</span>
              </label>
              <button
                type="button"
                className="btn-primary"
                disabled={!consent || pending}
                onClick={upload}
              >
                {pending ? "Subiendo foto…" : "Subir foto"}
              </button>
            </div>
          )}
        </>
      )}
      {error && error !== PHOTO_LIMIT_ERROR && <ErrorText>{error}</ErrorText>}

      {photos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3" aria-label="Fotos de cortes">
          {photos.map((p) => (
            <li key={p.id} className="flex flex-col gap-1">
              <Image
                src={mediaUrl(p.path)}
                alt={`Corte de ${barberName}`}
                width={320}
                height={320}
                unoptimized
                className="aspect-square w-full rounded-lg object-cover"
              />
              <button
                type="button"
                className="text-danger min-h-12 text-sm font-semibold underline"
                disabled={pending}
                onClick={() => remove(p.id)}
              >
                Borrar foto
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
