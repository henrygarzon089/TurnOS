/**
 * Envío automático de los avisos del turno (design.md §12.4, REQ-040). Lee la fila, decide con
 * `pickNotifications` y envía solo lo que `claim_notification` aceptó: ese insert con
 * `unique (ticket_id, kind)` es lo que hace que dos ejecuciones a la vez no repitan un aviso.
 * Sin dependencias de Next: las pruebas inyectan el gateway y un canal falso (REQ-043.4).
 */
import type { Gateway } from "@/lib/db/gateway";
import { estimateQueue } from "@/lib/domain/queue-estimate";
import { pickNotifications, type PickedNotification } from "@/lib/domain/queue-notifications";
import type { RecordedNotification, TicketContact } from "@/lib/domain/queue-notifications";
import { toSnapshot } from "@/lib/queue/public-queue";
import type { CloudApiChannel, WhatsAppTemplate } from "./cloud-api";

export type DispatchDeps = {
  gateway: Gateway;
  channel: Pick<CloudApiChannel, "sendTemplate">;
  /** Base del enlace a "Mi turno". */
  appUrl: string;
  now?: Date;
};

type QueueTicket = TicketContact & {
  status: "waiting" | "called";
  customerName: string;
  publicToken: string;
};

type NotificationQueue =
  | { enabled: false }
  | {
      enabled: true;
      business: { name: string; graceMinutes: number };
      queue: unknown;
      tickets: QueueTicket[];
      recorded: RecordedNotification[];
      staleClaims: string[];
    };

/** La plantilla no admite "≈ 0 min". */
const MIN_WAIT_MIN = 5;

const firstName = (name: string) => name.trim().split(/\s+/)[0];

function templateFor(
  n: PickedNotification,
  ticket: QueueTicket,
  business: { name: string; graceMinutes: number },
  appUrl: string,
): { template: WhatsAppTemplate; params: string[] } {
  const link = `${appUrl}/t/${ticket.publicToken}`;
  const name = firstName(ticket.customerName);
  return n.kind === "called"
    ? {
        template: "turno_te_llaman",
        params: [name, business.name, String(business.graceMinutes), link],
      }
    : {
        template: "turno_faltan_dos",
        params: [name, business.name, `${Math.max(n.waitMin, MIN_WAIT_MIN)} min`, link],
      };
}

/** Reclama y envía un aviso. Si Meta rechaza vuelve "Avisar" (REQ-040.7). */
async function deliver(
  gw: Gateway,
  channel: DispatchDeps["channel"],
  n: PickedNotification,
  message: { template: WhatsAppTemplate; params: string[] },
) {
  const claim = await gw.rpc<string>("claim_notification", {
    p_ticket_id: n.ticketId,
    p_kind: n.kind,
  });
  if (claim !== "claimed") return;
  const id = await gw.rpc<string>("notification_id", { p_ticket_id: n.ticketId, p_kind: n.kind });
  const result = await channel.sendTemplate({ phoneE164: n.phoneE164, ...message });
  await gw.rpc(
    "set_notification_status",
    result.ok
      ? { p_status: "sent", p_id: id, p_meta_message_id: result.messageId }
      : { p_status: "failed", p_id: id, p_error: result.code },
  );
}

/**
 * Corre con `after()`: lo que falle aquí nunca llega a la acción de la fila. Una falla en un aviso
 * no detiene los demás; ese `claimed` lo recoge la autocorrección de la siguiente ejecución.
 */
export async function dispatchQueueNotifications(
  businessId: string,
  { gateway: gw, channel, appUrl, now = new Date() }: DispatchDeps,
): Promise<void> {
  const state = await gw.rpc<NotificationQueue>("get_notification_queue", {
    p_business_id: businessId,
  });
  if (!state.enabled) return;

  // Una ejecución murió antes de enviar: el aviso vuelve al botón manual (design.md §12.4)
  for (const id of state.staleClaims) {
    await gw.rpc("set_notification_status", {
      p_status: "failed",
      p_id: id,
      p_error: "stale_claim",
    });
  }

  const tickets = new Map(state.tickets.map((t) => [t.id, t]));
  const picked = pickNotifications({
    estimates: estimateQueue({ now, ...toSnapshot(state.queue) }),
    waiting: state.tickets.filter((t) => t.status === "waiting"),
    called: state.tickets.filter((t) => t.status === "called"),
    recorded: state.recorded,
  });

  const results = await Promise.allSettled(
    picked.map((n) =>
      deliver(gw, channel, n, templateFor(n, tickets.get(n.ticketId)!, state.business, appUrl)),
    ),
  );
  for (const r of results) {
    if (r.status === "rejected") console.error("Aviso automático sin enviar", r.reason);
  }
}
