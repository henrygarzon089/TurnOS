import "server-only";

import { after } from "next/server";
import { createAdminGateway } from "@/lib/db/supabase-gateway";
import { cloudApiChannelFromEnv } from "./cloud-api";
import { dispatchQueueNotifications } from "./dispatch";

/**
 * Se llama al final de toda acción que cambia la fila (design.md §12.4). El envío va después de
 * responder: una falla o demora de Meta no afecta la acción (REQ-040.7). Sin credenciales no hace
 * nada (REQ-043.3). Sin negocio tampoco: la lectura previa falló y la siguiente acción lo recoge.
 */
export function afterQueueChange(businessId: string | null): void {
  const channel = cloudApiChannelFromEnv();
  if (!channel || !businessId) return;
  after(async () => {
    try {
      await dispatchQueueNotifications(businessId, {
        gateway: createAdminGateway(),
        channel,
        appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
      });
    } catch (e) {
      console.error("Avisos automáticos sin revisar", e);
    }
  });
}
