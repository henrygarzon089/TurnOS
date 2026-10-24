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
      onConnection: setOnline,
    });
    const onBrowserOffline = () => setOnline(false);
    window.addEventListener("offline", onBrowserOffline);
    return () => {
      unsubscribe();
      window.removeEventListener("offline", onBrowserOffline);
    };
  }, [businessId]);

  return { online, lastUpdated };
}
