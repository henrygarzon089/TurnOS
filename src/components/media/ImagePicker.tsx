"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { removeBrandImage, uploadBrandImage } from "@/lib/actions/brand";
import { BRAND_SIZES, checkPickedFile, PICK_ERROR, type BrandKind } from "@/lib/media/brand";
import { mediaUrl } from "@/lib/media/paths";
import { resizeToBox } from "@/lib/media/resize";

const PREVIEW: Record<BrandKind, string> = {
  barber: "size-20 rounded-full",
  service: "h-20 w-30 rounded-md",
  logo: "size-20 rounded-md",
  cover: "h-20 w-40 rounded-md",
};

/**
 * Hito 20 (REQ-085.1…085.3, REQ-086.1, REQ-087.1, design.md §26.2): escoger o tomar una foto, que
 * el celular recorta y reduce; se guarda al momento (sin botón "Guardar") y se puede quitar.
 */
export function ImagePicker({
  kind,
  id = null,
  label,
  name,
  initialPath,
  onSaved,
}: {
  kind: BrandKind;
  id?: string | null;
  label: string;
  /** Texto alternativo de la vista previa. */
  name: string;
  initialPath: string | null;
  onSaved?: (path: string | null) => void;
}) {
  const [path, setPath] = useState(initialPath);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const box = BRAND_SIZES[kind];

  function done(r: { ok: true; path: string | null } | { ok: false; error: string }) {
    if (!r.ok) return setError(r.error);
    setPath(r.path);
    onSaved?.(r.path);
  }

  function pick(file: File) {
    setError(null);
    const invalid = checkPickedFile(file);
    if (invalid) return setError(invalid);
    startTransition(async () => {
      let blob: Blob | null = null;
      try {
        blob = await resizeToBox(file, box.width, box.height);
      } catch {
        blob = null;
      }
      if (!blob) return setError(PICK_ERROR);
      const form = new FormData();
      form.set("kind", kind);
      if (id) form.set("id", id);
      form.set("photo", blob, "foto.webp");
      done(await uploadBrandImage(form));
    });
  }

  return (
    <div className="flex flex-col gap-2" data-testid={`image-picker-${kind}`}>
      <span className="text-sm font-semibold">{label}</span>
      <div className="flex items-center gap-3">
        {path ? (
          <Image
            src={mediaUrl(path)}
            alt={name}
            width={box.width}
            height={box.height}
            unoptimized
            className={`${PREVIEW[kind]} border-line shrink-0 border object-cover`}
          />
        ) : (
          <span
            className={`${PREVIEW[kind]} border-line-strong text-muted flex shrink-0 items-center justify-center border border-dashed text-xs`}
          >
            Sin foto
          </span>
        )}
        <div className="flex flex-col items-start gap-1">
          <label className="text-brand flex min-h-12 cursor-pointer items-center text-sm font-semibold underline">
            {pending ? "Subiendo foto…" : path ? "Cambiar foto" : "Poner foto"}
            <input
              type="file"
              accept="image/*"
              disabled={pending}
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // deja volver a escoger el mismo archivo
                if (file) pick(file);
              }}
            />
          </label>
          {path && !pending && (
            <button
              type="button"
              className="text-muted min-h-12 text-sm underline"
              onClick={() => startTransition(async () => done(await removeBrandImage(kind, id)))}
            >
              Quitar foto
            </button>
          )}
        </div>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
