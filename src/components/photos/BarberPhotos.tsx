"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { Icon } from "@/components/ui/Icon";
import { Dialog, Sheet } from "@/components/ui/Sheet";
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

/**
 * REQ-039.1–039.4: subir y borrar fotos de un barbero (`/app/mis-fotos` y `/admin/barberos`).
 * T-171 (tablero Barbero-Otros, REQ-078.20): rejilla cuadrada numerada, "Subir foto" es un botón en
 * español sobre un selector escondido (nunca "Choose File"), la confirmación va en una hoja y borrar
 * pide confirmar en un diálogo. `fixed`: el botón queda fijo sobre la barra del barbero.
 */
export function BarberPhotos({
  barberId,
  barberName,
  photos,
  fixed = false,
}: {
  barberId: string;
  barberName: string;
  photos: BarberPhoto[];
  fixed?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [reading, setReading] = useState(false);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string | null>(null);
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
      if (r.ok || r.error === PHOTO_LIMIT_ERROR) changeDraft(null);
      if (!r.ok) setError(r.error);
      if (r.ok || r.error === PHOTO_LIMIT_ERROR) router.refresh();
    });
  }

  function remove() {
    const id = toDelete;
    if (!id) return;
    setError(null);
    startTransition(async () => {
      const r = await deleteBarberPhoto(id);
      setToDelete(null);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  const picker = (
    <label
      className={`btn-primary flex cursor-pointer items-center justify-center gap-2 ${
        reading || pending ? "pointer-events-none opacity-60" : ""
      }`}
    >
      <Icon name="camera" className="h-5 w-5" />
      {reading ? "Preparando foto…" : "Subir foto"}
      <input
        type="file"
        accept="image/*"
        aria-label="Escoger foto"
        disabled={reading || pending}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = ""; // deja volver a escoger el mismo archivo
          if (file) void pick(file);
        }}
      />
    </label>
  );

  return (
    <div className={`flex flex-col gap-3 ${fixed ? "pb-24" : ""}`}>
      {!fixed && (
        <p className="text-muted text-sm">
          {photos.length} de {MAX_BARBER_PHOTOS} fotos
        </p>
      )}
      {photos.length > 0 && (
        <ul
          className={`grid grid-cols-3 gap-0.5 ${fixed ? "-mx-4" : ""}`}
          aria-label="Fotos de cortes"
        >
          {photos.map((p, i) => (
            <li key={p.id} className="relative">
              <Image
                src={mediaUrl(p.path)}
                alt={`Corte de ${barberName}`}
                width={256}
                height={256}
                unoptimized
                className="bg-skeleton aspect-square w-full object-cover"
              />
              <button
                type="button"
                className="absolute inset-0"
                disabled={pending}
                aria-label={`Borrar foto ${i + 1}`}
                onClick={() => setToDelete(p.id)}
              />
              <span
                aria-hidden="true"
                className="bg-card text-ink pointer-events-none absolute top-1.5 left-1.5 min-w-5 rounded-sm px-1 text-center text-xs font-semibold"
              >
                {i + 1}
              </span>
            </li>
          ))}
        </ul>
      )}
      {photos.length > 0 ? (
        <p className="text-muted text-sm">Toca una foto para borrarla.</p>
      ) : (
        fixed && (
          <p className="text-muted py-8 text-center">
            Todavía no tienes fotos. Sube la de tu mejor corte.
          </p>
        )
      )}

      {full ? (
        <p role="alert" className="text-warn bg-warn-soft rounded-md p-3 text-sm font-medium">
          {PHOTO_LIMIT_ERROR}
        </p>
      ) : fixed ? (
        <div className="bg-card border-line fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t px-4 py-3">
          <div className="mx-auto max-w-md">{picker}</div>
        </div>
      ) : (
        picker
      )}
      {error && error !== PHOTO_LIMIT_ERROR && <ErrorText>{error}</ErrorText>}

      <Sheet open={draft !== null} onClose={() => changeDraft(null)} title="Nueva foto">
        {draft && (
          <>
            <Image
              src={draft.url}
              alt="Foto por subir"
              width={256}
              height={256}
              unoptimized
              className="mx-auto aspect-square w-40 rounded-sm object-cover"
            />
            {/* REQ-039.3: se confirma foto por foto */}
            <label className="flex min-h-12 items-start gap-3 text-base">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
                className="mt-0.5 h-6 w-6 shrink-0"
              />
              <span>{PHOTO_CONSENT_LABEL}</span>
            </label>
            {error && error !== PHOTO_LIMIT_ERROR && <ErrorText>{error}</ErrorText>}
            <button
              type="button"
              className="btn-primary"
              disabled={!consent || pending}
              onClick={upload}
            >
              {pending ? "Subiendo foto…" : "Subir foto"}
            </button>
          </>
        )}
      </Sheet>

      <Dialog
        open={toDelete !== null}
        onClose={() => setToDelete(null)}
        title="¿Borrar esta foto?"
        description="Los clientes ya no la verán al tomar turno."
      >
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={() => setToDelete(null)}>
            Cancelar
          </button>
          <button type="button" className="btn-danger flex-1" disabled={pending} onClick={remove}>
            {pending ? "Borrando…" : "Borrar"}
          </button>
        </div>
      </Dialog>
    </div>
  );
}
