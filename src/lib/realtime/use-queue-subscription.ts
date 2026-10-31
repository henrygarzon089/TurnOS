"use client";

import { useEffect, useRef, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { subscribeToQueue, type MinimalClient } from "./queue-subscription";

/**
 * Hook: se suscribe a `queue:<businessId>` y llama `reload` al recibir cambios o reconectar.
 * Devuelve `online` para la franja "Sin conexión" (REQ-011.1) y `lastUpdated`.
 */
export function useQueueSubscription(
  businessId: string | null,
  reload: () => void | Promise<void>,
) {
  const [online, setOnline] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const reloadRef = useRef(reload);

  useEffect(() => {
    reloadRef.current = reload;
  }, [reload]);

  useEffect(() => {
    if (!businessId) return;
    const client = createSupabaseBrowserClient();
    const unsubscribe = subscribeToQueue({
      client: client as unknown as MinimalClient,
      businessId,
      reload: async () => {
        await reloadRef.current();
        setLastUpdated(new Date());
      },
      // Un SUBSCRIBED tardío llega por el socket ya abierto: no apaga la franja si no hay red
      onConnection: (up) => setOnline(up && navigator.onLine),
    });
    const onBrowserOffline = () => setOnline(false);
    const onBrowserOnline = () => setOnline(true);
    window.addEventListener("offline", onBrowserOffline);
    window.addEventListener("online", onBrowserOnline);
    return () => {
      unsubscribe();
      window.removeEventListener("offline", onBrowserOffline);
      window.removeEventListener("online", onBrowserOnline);
    };
  }, [businessId]);

  return { online, lastUpdated };
}
