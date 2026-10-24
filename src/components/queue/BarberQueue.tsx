"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";
import { NewSaleButton } from "@/components/cash/NewSaleSheet";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import {
  callNext,
  finishService,
  getMyQueue,
  markNoShow,
  markNotified,
  setMyStatus,
  startService,
  type ActionResult,
  type BarberQueueView,
  type QueueTicket,
} from "@/lib/actions/queue";
import { minutesBetween } from "@/lib/domain/time";
import { withRetry } from "@/lib/net/retry";
import { getChannel } from "@/lib/notifications/channel";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

const STATUS_LABEL = {
  available: "Disponible",
  busy: "En servicio",
  paused: "En pausa",
  off: "No estás hoy",
} as const;

export function BarberQueue({ initial, appUrl }: { initial: BarberQueueView; appUrl: string }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pauseSheet, setPauseSheet] = useState(false);
  /** REQ-023.1: turno cuyo cobro se está registrando. */
  const [checkout, setCheckout] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [tick, setTick] = useState(0);

  // Sin red, la relectura también falla: se conserva el último estado (REQ-011.6) en vez de
  // dejar que el error tumbe la página justo después de mostrar "Revisa tu conexión" (REQ-011.3).
  const reload = useCallback(async () => {
    try {
      const v = await getMyQueue();
      if (v) setView(v);
    } catch {
      // la franja de conexión (ConnectionBanner) ya avisa; el canal vuelve a leer al reconectar
    }
  }, []);
  const { online, lastUpdated } = useQueueSubscription(view.business.id, reload);

  // Reloj para "hace N min" y el resaltado de gracia (REQ-008.1)
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 15_000);
    return () => clearInterval(id);
  }, []);
  void tick;

  /** Ejecuta una acción con reintento (REQ-011.3); no cambia la pantalla hasta confirmar. */
  function run(key: string, action: () => Promise<ActionResult>) {
    setError(null);
    setBusyAction(key);
    startTransition(async () => {
      try {
        const r = await withRetry(action);
        if (!r.ok) setError(r.error);
      } catch {
        setError("No se pudo guardar. Revisa tu conexión.");
      } finally {
        setBusyAction(null);
        await reload();
      }
    });
  }

  const b = view.barber;
  const current = view.current;
  const canCall = b.status === "available" && !current;
  const now = new Date();

  return (
    <main className="pb-28">
      <ConnectionBanner online={online} />

      <section className="flex items-center justify-between py-3">
        <div>
          <h1 className="text-2xl font-bold">Mi fila</h1>
          <p className="text-muted text-sm">
            {b.name} · <span className="font-medium">{STATUS_LABEL[b.status]}</span>
          </p>
        </div>
        {b.status === "off" ? (
          <button
            type="button"
            className="btn-secondary w-auto px-4"
            disabled={busyAction !== null}
            onClick={() => run("present", () => setMyStatus("available"))}
          >
            Estoy aquí
          </button>
        ) : b.status === "paused" ? (
          <button
            type="button"
            className="btn-secondary w-auto px-4"
            disabled={busyAction !== null}
            onClick={() => run("resume", () => setMyStatus("available"))}
          >
            Volver
          </button>
        ) : (
          <button
            type="button"
            className="btn-secondary w-auto px-4"
            disabled={busyAction !== null || !!current}
            onClick={() =>
              view.mineWaiting > 0 ? setPauseSheet(true) : run("pause", () => setMyStatus("paused"))
            }
          >
            Pausar
          </button>
        )}
      </section>

      {error && (
        <p role="alert" className="text-danger mb-3 rounded-xl bg-red-50 p-3 text-sm font-medium">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="text-ok mb-3 rounded-xl bg-green-50 p-3 text-sm font-medium">
          {notice}
        </p>
      )}

      <section aria-label="Ahora" className="mb-4">
        <h2 className="text-muted text-xs font-semibold uppercase">Ahora</h2>
        {current ? (
          <CurrentCard
            ticket={current}
            graceMinutes={view.business.graceMinutes}
            busy={busyAction}
            run={run}
            now={now}
            onFinished={(id) => {
              setNotice(null);
              setCheckout(id);
            }}
          />
        ) : (
          <p className="text-muted mt-1">Nadie en la silla.</p>
        )}
      </section>

      {view.pendingPayments.length > 0 && (
        <section aria-label="Cobros pendientes" className="mb-4">
          <h2 className="text-warn text-xs font-semibold uppercase">
            Cobro pendiente ({view.pendingPayments.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {view.pendingPayments.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-400 bg-amber-50 p-3"
              >
                <span className="min-w-0 truncate font-semibold">
                  {t.customerName} · {t.serviceName}
                </span>
                <button
                  type="button"
                  className="btn-primary w-auto shrink-0 px-4"
                  onClick={() => {
                    setNotice(null);
                    setCheckout(t.id);
                  }}
                >
                  Cobrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4">
        <NewSaleButton onSaved={() => void reload()} />
      </div>

      <section aria-label="Siguen">
        <h2 className="text-muted text-xs font-semibold uppercase">
          Siguen ({view.waiting.length})
        </h2>
        {view.waiting.length === 0 ? (
          <p className="text-muted mt-1">No hay nadie en la fila.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-2">
            {view.waiting.map((t, i) => (
              <WaitingRow
                key={t.id}
                ticket={t}
                index={i}
                me={b.id}
                now={now}
                view={view}
                appUrl={appUrl}
                busy={busyAction}
                run={run}
              />
            ))}
          </ol>
        )}
      </section>

      <div className="bg-surface fixed inset-x-0 bottom-0 p-4">
        <div className="mx-auto max-w-md">
          <button
            type="button"
            className="btn-primary"
            disabled={!canCall || busyAction !== null}
            onClick={() => run("call", callNext)}
          >
            {busyAction === "call" ? "Llamando…" : "Llamar al siguiente"}
          </button>
          <LastUpdated at={lastUpdated} />
        </div>
      </div>

      {checkout && (
        <CheckoutSheet
          ticketId={checkout}
          onClose={() => {
            setCheckout(null);
            void reload();
          }}
          onDone={(msg) => {
            setCheckout(null);
            setNotice(msg);
            void reload();
          }}
        />
      )}

      {pauseSheet && (
        <PauseSheet
          count={view.mineWaiting}
          onClose={() => setPauseSheet(false)}
          onKeep={() => {
            setPauseSheet(false);
            run("pause", () => setMyStatus("paused", false));
          }}
          onReassign={() => {
            setPauseSheet(false);
            run("pause", () => setMyStatus("paused", true));
          }}
        />
      )}
    </main>
  );
}

function CurrentCard({
  ticket,
  graceMinutes,
  busy,
  run,
  now,
  onFinished,
}: {
  ticket: QueueTicket;
  graceMinutes: number;
  busy: string | null;
  run: (key: string, a: () => Promise<ActionResult>) => void;
  now: Date;
  /** REQ-023.1: al terminar se abre "Registrar cobro". */
  onFinished: (ticketId: string) => void;
}) {
  const sinceCalled = ticket.calledAt ? minutesBetween(new Date(ticket.calledAt), now) : 0;
  const overGrace = ticket.status === "called" && sinceCalled >= graceMinutes;
  const sinceStarted = ticket.startedAt ? minutesBetween(new Date(ticket.startedAt), now) : 0;

  return (
    <article
      className={`mt-1 rounded-2xl border-2 p-4 ${overGrace ? "border-amber-400 bg-amber-50" : "border-accent bg-card"}`}
      aria-label={`Turno actual ${ticket.customerName}`}
    >
      <p className="text-lg font-bold">
        {ticket.customerName}{" "}
        <span className="text-muted text-sm font-normal">· {ticket.serviceName}</span>
      </p>
      {ticket.rewardAvailable && <RewardBadge />}
      {ticket.status === "called" ? (
        <>
          <p className="text-sm">
            Llamado hace {sinceCalled} min{overGrace ? " · se pasó el tiempo de gracia" : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="btn-primary"
              disabled={busy !== null}
              onClick={() => run("start", () => startService(ticket.id))}
            >
              Ya está en la silla
            </button>
            <button
              type="button"
              className={overGrace ? "btn-primary bg-warn" : "btn-secondary"}
              disabled={busy !== null}
              onClick={() => run("noshow", () => markNoShow(ticket.id))}
            >
              No llegó
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm">
            En servicio hace {sinceStarted} min · estimado {ticket.serviceDurationMin} min
          </p>
          <button
            type="button"
            className="btn-primary mt-3"
            disabled={busy !== null}
            onClick={() =>
              run("finish", async () => {
                const r = await finishService(ticket.id);
                if (r.ok) onFinished(ticket.id);
                return r;
              })
            }
          >
            {busy === "finish" ? "Guardando…" : "Terminado"}
          </button>
        </>
      )}
    </article>
  );
}

function WaitingRow({
  ticket,
  index,
  me,
  now,
  view,
  appUrl,
  busy,
  run,
}: {
  ticket: QueueTicket;
  index: number;
  me: string;
  now: Date;
  view: BarberQueueView;
  appUrl: string;
  busy: string | null;
  run: (key: string, a: () => Promise<ActionResult>) => void;
}) {
  const waitedMin = minutesBetween(new Date(ticket.createdAt), now);
  const shouldNotify = ticket.ahead === 2 && !ticket.notifiedAt;
  const canNotify = !!ticket.customerPhone && !ticket.doNotContact; // REQ-020.5

  const link = canNotify
    ? getChannel().buildLink({
        phoneE164: ticket.customerPhone!,
        template: view.template,
        vars: {
          nombre: ticket.customerName.split(" ")[0],
          negocio: view.business.name,
          tiempo:
            ticket.ahead === 0
              ? "ya casi"
              : `faltan ${ticket.ahead} turno${ticket.ahead === 1 ? "" : "s"}`,
          enlace: `${appUrl}/t/${ticket.publicToken}`,
        },
      })
    : null;

  return (
    <li
      className={`border-line bg-card flex items-center justify-between gap-3 rounded-xl border p-3 ${shouldNotify ? "border-amber-400" : ""}`}
    >
      <div className="min-w-0">
        <p className="truncate font-semibold">
          {index + 1}. {ticket.customerName}
        </p>
        {ticket.rewardAvailable && <RewardBadge />}
        <p className="text-muted text-sm">
          {ticket.serviceName} {ticket.serviceDurationMin}&apos; · hace {waitedMin}&apos; ·{" "}
          {ticket.preferredBarberId === me ? "te eligió" : "cualquiera"}
        </p>
      </div>
      {canNotify && link && (
        <a
          href={link}
          target="_blank"
          rel="noopener"
          onClick={() => run(`notify-${ticket.id}`, () => markNotified(ticket.id))}
          aria-disabled={busy !== null}
          className={`flex min-h-12 shrink-0 items-center rounded-full px-3 text-sm font-semibold ${
            ticket.notifiedAt
              ? "text-ok bg-green-50"
              : shouldNotify
                ? "bg-accent text-accent-ink"
                : "border-line border"
          }`}
        >
          {ticket.notifiedAt ? "Avisado ✓" : "📲 Avisar"}
        </a>
      )}
    </li>
  );
}

function PauseSheet({
  count,
  onClose,
  onKeep,
  onReassign,
}: {
  count: number;
  onClose: () => void;
  onKeep: () => void;
  onReassign: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pausar"
      className="fixed inset-0 z-30 flex items-end bg-black/40"
    >
      <div className="bg-card w-full rounded-t-2xl p-5">
        <p className="text-lg font-bold">
          Tienes {count} {count === 1 ? "cliente esperándote" : "clientes esperándote"}. ¿Qué
          hacemos?
        </p>
        <div className="mt-4 flex flex-col gap-2">
          <button type="button" className="btn-secondary" onClick={onKeep}>
            Los dejo esperando
          </button>
          <button type="button" className="btn-primary" onClick={onReassign}>
            Que los atienda el que esté libre
          </button>
          <button type="button" className="text-muted min-h-12 text-sm" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/** REQ-019.3: el cliente tiene el premio de fidelidad disponible. */
function RewardBadge() {
  return (
    <span className="text-ok mt-0.5 inline-block rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold">
      🎁 Premio disponible
    </span>
  );
}
