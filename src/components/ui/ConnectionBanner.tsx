"use client";

import { useEffect, useState } from "react";

/** REQ-011.1: franja visible mientras no hay conexión con el servidor en tiempo real. */
export function ConnectionBanner({ online }: { online: boolean }) {
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-warn text-card sticky top-0 z-20 px-4 py-2 text-center text-sm font-semibold"
    >
      Sin conexión. Reintentando…
    </div>
  );
}

/** "Actualizado hace 5 s" (REQ-011.6). Se refresca cada 5 s. */
export function LastUpdated({ at }: { at: Date | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);
  if (!at) return null;
  const seconds = Math.max(0, Math.round((now - at.getTime()) / 1000));
  const text = seconds < 60 ? `hace ${seconds} s` : `hace ${Math.round(seconds / 60)} min`;
  return <p className="text-muted text-center text-xs">Actualizado {text}</p>;
}
