"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { getBarberPhotos } from "@/lib/actions/public";
import type { BarberPhoto } from "@/lib/media/barber-photos";
import { mediaUrl } from "@/lib/media/paths";

/** REQ-039.5: hoja inferior encima del formulario; lo escrito sigue en JoinForm. */
export function BarberCutsSheet({
  slug,
  barber,
  onClose,
}: {
  slug: string;
  barber: { id: string; name: string };
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<BarberPhoto[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let stale = false;
    getBarberPhotos(slug, barber.id)
      .then((p) => {
        if (!stale) setPhotos(p);
      })
      .catch(() => {
        if (!stale) setFailed(true);
      });
    return () => {
      stale = true;
    };
  }, [slug, barber.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Cortes de ${barber.name}`}
      className="fixed inset-0 z-30 flex items-end bg-black/40"
    >
      <div className="bg-card mx-auto flex max-h-[85dvh] w-full max-w-md flex-col gap-3 rounded-t-2xl p-5">
        <p className="text-lg font-bold">Cortes de {barber.name}</p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {failed && <ErrorText>No se pudieron cargar las fotos.</ErrorText>}
          {!failed && !photos && <p className="text-muted text-sm">Cargando fotos…</p>}
          {photos?.length === 0 && (
            <p className="text-muted text-sm">Este barbero no tiene fotos para mostrar</p>
          )}
          {photos && photos.length > 0 && (
            <ul className="grid grid-cols-2 gap-2">
              {photos.map((p) => (
                <li key={p.id}>
                  <Image
                    src={mediaUrl(p.path)}
                    alt={`Corte de ${barber.name}`}
                    width={400}
                    height={400}
                    unoptimized
                    className="aspect-square w-full rounded-lg object-cover"
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cerrar
        </button>
      </div>
    </div>
  );
}
