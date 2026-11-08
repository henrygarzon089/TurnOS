"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";
import { NewSaleButton } from "@/components/cash/NewSaleSheet";
import { CourtesyLine } from "@/components/queue/CourtesyLine";
import { MemberBadge } from "@/components/queue/MemberBadge";
import { AppointmentBadge, TodayAppointments } from "@/components/queue/TodayAppointments";
import { Button } from "@/components/ui/Button";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import { FlashRow } from "@/components/ui/FlashRow";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { StatusChip } from "@/components/ui/StatusChip";
import {
  callNext,
  finishService,
  getMyQueue,
  markAppointmentArrived,
  markCourtesyServed,
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
import { useBrowserOnline } from "@/lib/realtime/use-browser-online";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

const STATUS_LABEL = {
  available: "Disponible",
  busy: "En servicio",
  paused: "En pausa",
  off: "No estás hoy",
} as const;

/**
 * REQ-006…REQ-010: la fila del barbero con el sistema visual de T-163 (tablero Barbero-Fila).
 * El botón de lo que sigue (llamar, ya está en la silla, terminado) mide 80 px y queda fijo sobre
 * el menú (REQ-078.5); sin red se deshabilita diciendo por qué (REQ-078.10); el turno que llega
 * por tiempo real entra al final con fondo resaltado, sin mover lo de arriba (REQ-078.12).
 */
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
  const [loadedAt] = useState(() => new Date());
  /** REQ-078.12: turnos en espera que ya estaban en pantalla; los demás entran resaltados. */
  const known = useRef(new Set(initial.waiting.map((t) => t.id)));
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  // Sin red, la relectura también falla: se conserva el último estado (REQ-011.6) en vez de
  // dejar que el error tumbe la página justo después de mostrar "Revisa tu conexión" (REQ-011.3).
  const reload = useCallback(async () => {
    try {
      const v = await getMyQueue();
      if (!v) return;
      const arrived = v.waiting.filter((t) => !known.current.has(t.id)).map((t) => t.id);
      for (const id of arrived) known.current.add(id);
      setView(v);
      if (arrived.length > 0) {
        setFresh(new Set(arrived));
        setTimeout(() => setFresh(new Set()), 1300); // el resaltado dura 1,2 s
      }
    } catch {
      // la franja de conexión (ConnectionBanner) ya avisa; el canal vuelve a leer al reconectar
    }
  }, []);
  const { online: live, lastUpdated } = useQueueSubscription(view.business.id, reload);
  const browser = useBrowserOnline();
  const online = live && browser.online;

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
  const sinceCalled = current?.calledAt ? minutesBetween(new Date(current.calledAt), now) : 0;
  const overGrace = current?.status === "called" && sinceCalled >= view.business.graceMinutes;

  return (
    <main className="pb-56">
      <ConnectionBanner online={online} lastSeen={lastUpdated ?? loadedAt} />

      <section className="flex items-center justify-between gap-3 py-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold">Mi fila</h1>
          <p className="text-muted text-sm">
            {b.name} · <span className="font-medium">{STATUS_LABEL[b.status]}</span>
          </p>
        </div>
        {b.status === "off" ? (
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={busyAction !== null || !online}
            onClick={() => run("present", () => setMyStatus("available"))}
          >
            Estoy aquí
          </Button>
        ) : b.status === "paused" ? (
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={busyAction !== null || !online}
            onClick={() => run("resume", () => setMyStatus("available"))}
          >
            Volver
          </Button>
        ) : (
          <Button
            variant="secondary"
            className="shrink-0"
            disabled={busyAction !== null || !!current || !online}
            onClick={() =>
              view.mineWaiting > 0 ? setPauseSheet(true) : run("pause", () => setMyStatus("paused"))
            }
          >
            Pausar
          </Button>
        )}
      </section>

      {error && (
        <div
          role="alert"
          className="border-danger mb-3 flex gap-2 rounded-md border-2 p-3 text-sm font-medium"
        >
          <Icon name="error" className="text-danger mt-0.5 size-5 shrink-0" />
          <p className="text-danger">{error}</p>
        </div>
      )}
      {notice && (
        <p role="status" className="text-ok bg-ok-soft mb-3 rounded-md p-3 text-sm font-medium">
          {notice}
        </p>
      )}

      <section aria-label="Ahora" className="mb-4">
        <h2 className="text-muted text-xs font-bold tracking-wider uppercase">
          {current?.status === "called"
            ? "Llamaste a"
            : current?.status === "in_service"
              ? "Atendiendo"
              : "Ahora"}
        </h2>
        {current ? (
          <CurrentCard
            ticket={current}
            overGrace={overGrace}
            sinceCalled={sinceCalled}
            busy={busyAction}
            run={run}
            now={now}
          />
        ) : (
          <p className="text-muted mt-1">Nadie en la silla.</p>
        )}
      </section>

      {view.pendingPayments.length > 0 && (
        <section aria-label="Cobros pendientes" className="mb-4">
          <h2 className="text-warn text-xs font-bold tracking-wider uppercase">
            Cobro pendiente ({view.pendingPayments.length})
          </h2>
          <ul className="mt-2 flex flex-col gap-2">
            {view.pendingPayments.map((t) => (
              <li
                key={t.id}
                className="border-warn bg-warn-soft flex items-center justify-between gap-3 rounded-md border p-3"
              >
                <span className="min-w-0 truncate font-semibold">
                  {t.customerName} · {t.serviceName}
                </span>
                <Button
                  variant="secondary"
                  className="shrink-0"
                  onClick={() => {
                    setNotice(null);
                    setCheckout(t.id);
                  }}
                >
                  Cobrar
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-4">
        <NewSaleButton onSaved={() => void reload()} />
      </div>

      <TodayAppointments
        title="Mis citas de hoy"
        appointments={view.appointments}
        showBarber={false}
        disabled={busyAction !== null}
        onArrived={(id) => run(`arrived-${id}`, () => markAppointmentArrived(id))}
      />

      <section aria-label="Siguen">
        <h2 className="text-muted text-xs font-bold tracking-wider uppercase">
          Siguen ({view.waiting.length})
        </h2>
        {view.waiting.length === 0 ? (
          <div className="mt-1">
            <p className="text-muted">No hay nadie en la fila.</p>
            <p className="text-muted mt-1 text-sm">
              ¿Hay alguien en el local sin turno? Que escanee el QR de la entrada.
            </p>
          </div>
        ) : (
          <ol className="divide-line border-line bg-card mt-2 divide-y rounded-md border">
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
                flash={fresh.has(t.id)}
              />
            ))}
          </ol>
        )}
      </section>

      {/* Fijo sobre el menú del barbero (56 px + borde) */}
      <div className="border-line bg-card fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t px-4 pt-3 pb-2">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          {current?.status === "called" ? (
            <>
              <Button
                size="giant"
                disabled={busyAction !== null || !online}
                pending={busyAction === "start"}
                onClick={() => run("start", () => startService(current.id))}
              >
                Ya está en la silla
              </Button>
              <Button
                variant="secondary"
                className={`w-full ${overGrace ? "border-warn bg-warn-soft border-2" : ""}`}
                disabled={busyAction !== null || !online}
                pending={busyAction === "noshow"}
                onClick={() => run("noshow", () => markNoShow(current.id))}
              >
                No llegó
              </Button>
            </>
          ) : current ? (
            <Button
              size="giant"
              disabled={busyAction !== null || !online}
              pending={busyAction === "finish"}
              onClick={() =>
                run("finish", async () => {
                  const r = await finishService(current.id);
                  if (r.ok) {
                    setNotice(null);
                    setCheckout(current.id); // REQ-023.1: al terminar se abre "Registrar cobro"
                  }
                  return r;
                })
              }
            >
              Terminado
            </Button>
          ) : (
            <Button
              size="giant"
              disabled={!canCall || busyAction !== null || !online}
              pending={busyAction === "call"}
              pendingText="Llamando…"
              onClick={() => run("call", callNext)}
            >
              Llamar al siguiente
            </Button>
          )}
          {!online ? (
            <p className="text-muted text-center text-sm">
              {current
                ? "Sin señal no podemos guardar. Reintentamos solos."
                : "Sin señal no podemos avisarle. Reintentamos solos."}
            </p>
          ) : (
            <LastUpdated at={lastUpdated} />
          )}
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

      <Sheet
        open={pauseSheet}
        onClose={() => setPauseSheet(false)}
        title="Pausar"
        description={`Tienes ${view.mineWaiting} ${view.mineWaiting === 1 ? "cliente esperándote" : "clientes esperándote"}. ¿Qué hacemos?`}
      >
        <Button
          className="w-full"
          onClick={() => {
            setPauseSheet(false);
            run("pause", () => setMyStatus("paused", true));
          }}
        >
          Que los atienda el que esté libre
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={() => {
            setPauseSheet(false);
            run("pause", () => setMyStatus("paused", false));
          }}
        >
          Los dejo esperando
        </Button>
        <Button variant="text" className="mx-auto" onClick={() => setPauseSheet(false)}>
          Cancelar
        </Button>
      </Sheet>
    </main>
  );
}

/** El turno en la silla: número grande y nombre (tablero Barbero-Fila); los botones van abajo. */
function CurrentCard({
  ticket,
  overGrace,
  sinceCalled,
  busy,
  run,
  now,
}: {
  ticket: QueueTicket;
  overGrace: boolean;
  sinceCalled: number;
  busy: string | null;
  run: (key: string, a: () => Promise<ActionResult>) => void;
  now: Date;
}) {
  const sinceStarted = ticket.startedAt ? minutesBetween(new Date(ticket.startedAt), now) : 0;
  const called = ticket.status === "called";

  return (
    <article
      className={`bg-card mt-1 rounded-md border p-4 ${called ? "border-l-called border-line border-l-4" : "border-line"} ${overGrace ? "bg-warn-soft" : ""}`}
      aria-label={`Turno actual ${ticket.customerName}`}
    >
      <StatusChip status={called ? "called" : "in_service"} />
      <p className="mt-2 flex items-baseline gap-3">
        <span className="text-5xl leading-none font-bold tabular-nums">{ticket.displayNumber}</span>
        <span className="min-w-0 text-xl font-bold break-words">{ticket.customerName}</span>
      </p>
      <p className="text-muted mt-1 text-sm">{ticket.serviceName}</p>
      <AppointmentBadge scheduledAt={ticket.scheduledAt} />
      {ticket.rewardAvailable && <RewardBadge />}
      {ticket.isMember && <MemberBadge />}
      {ticket.courtesyName && (
        <CourtesyLine
          name={ticket.courtesyName}
          served={ticket.courtesyServed}
          disabled={busy !== null}
          onServe={() => run(`courtesy-${ticket.id}`, () => markCourtesyServed(ticket.id))}
        />
      )}
      <p className="mt-2 text-sm">
        {called
          ? `Llamado hace ${sinceCalled} min${overGrace ? " · se pasó el tiempo de gracia" : ""}`
          : `En servicio hace ${sinceStarted} min · estimado ${ticket.serviceDurationMin} min`}
      </p>
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
  flash,
}: {
  ticket: QueueTicket;
  index: number;
  me: string;
  now: Date;
  view: BarberQueueView;
  appUrl: string;
  busy: string | null;
  run: (key: string, a: () => Promise<ActionResult>) => void;
  /** REQ-078.12: llegó por tiempo real y entra resaltado. */
  flash: boolean;
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
    <li data-testid="waiting-row">
      <FlashRow
        flash={flash}
        className={`p-3 ${shouldNotify ? "shadow-[inset_3px_0_0_var(--color-warn)]" : ""}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-baseline gap-3">
              <span className="w-10 shrink-0 font-bold tabular-nums">{ticket.displayNumber}</span>
              <span className="min-w-0 truncate font-semibold">
                <span className="sr-only">{index + 1}. </span>
                {ticket.customerName}
              </span>
            </p>
            <AppointmentBadge scheduledAt={ticket.scheduledAt} />
            {ticket.rewardAvailable && <RewardBadge />}
            {ticket.isMember && <MemberBadge />}
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
              className={`flex min-h-12 shrink-0 items-center rounded-md px-3 text-sm font-semibold ${
                ticket.notifiedAt
                  ? "text-ok bg-ok-soft"
                  : shouldNotify
                    ? "border-brand text-brand border-2"
                    : "border-line-strong border"
              }`}
            >
              {ticket.notifiedAt ? "Avisado ✓" : "📲 Avisar"}
            </a>
          )}
        </div>
        {ticket.courtesyName && (
          <CourtesyLine
            name={ticket.courtesyName}
            served={ticket.courtesyServed}
            disabled={busy !== null}
            onServe={() => run(`courtesy-${ticket.id}`, () => markCourtesyServed(ticket.id))}
          />
        )}
      </FlashRow>
    </li>
  );
}

/** REQ-019.3: el cliente tiene el premio de fidelidad disponible. */
function RewardBadge() {
  return (
    <span className="text-ok bg-ok-soft mt-0.5 inline-block rounded-sm px-2 py-0.5 text-xs font-semibold">
      🎁 Premio disponible
    </span>
  );
}
