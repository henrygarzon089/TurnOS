"use client";

import { useEffect, useState } from "react";

/**
 * REQ-078.10 para pantallas sin suscripción a la fila (tomar turno, reservar cita): si el
 * navegador tiene red. `since` es desde cuándo se ve lo que hay en pantalla (la hora de la franja).
 */
export function useBrowserOnline() {
  const [online, setOnline] = useState(true);
  const [since] = useState(() => new Date());
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    const id = requestAnimationFrame(sync);
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);
  return { online, since };
}
