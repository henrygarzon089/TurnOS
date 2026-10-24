"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

/**
 * Mantiene una página de servidor al día: al recibir `queue_changed` (o reconectar) hace
 * router.refresh(), que vuelve a ejecutar el Server Component con datos frescos (ADR-008).
 */
export function LiveRefresh({
  businessId,
  showUpdated = false,
}: {
  businessId: string;
  showUpdated?: boolean;
}) {
  const router = useRouter();
  const reload = useCallback(() => router.refresh(), [router]);
  const { online, lastUpdated } = useQueueSubscription(businessId, reload);
  return (
    <>
      <ConnectionBanner online={online} />
      {showUpdated && <LastUpdated at={lastUpdated} />}
    </>
  );
}
