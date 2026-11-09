"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";
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
import { formatTimeBogota, minutesBetween } from "@/lib/domain/time";
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
 * REQ-006…REQ-010: la fila del barbero como el tablero Barbero-Fila (T-169, ADR-051, design
 * §22.6): franja azul con nombre, estado y Pausar; bloque del turno (Sigue / Llamaste a /
 * Atendiendo / Vacío); cobros pendientes en una fila; "Después" con el resto. El botón de lo que
 * sigue mide 80 px y queda fijo sobre el menú (REQ-078.5); "Llamar a <número>" llama a ese turno o
 * a nadie (REQ-078.17); sin red se deshabilita diciendo por qué (REQ-078.10); el turno que llega
 * por tiempo real entra al final resaltado, sin mover lo de arriba (REQ-078.12).
 */
export function BarberQueue({
  initial,
  appUrl,
  cleaning,
}: {
  initial: BarberQueueView;
  appUrl: string;
  /** Aviso de limpieza de apertura (REQ-062.1), bajo la franja. */
  cleaning?: React.ReactNode;
}) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [pauseSheet, setPauseSheet] = useState(false);
  const [pendingSheet, setPendingSheet] = useState(false);
  /** Turno de "Después" cuya hoja está abierta. */
  const [rowSheet, setRowSheet] = useState<string | null>(null);
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
  // REQ-078.17: "Sigue" es el que "Llamar" llamaría; si una cita lo impide, el primero de la lista
  const next = current
    ? null
    : (view.waiting.find((t) => t.id === view.nextId) ?? view.waiting[0] ?? null);
  const after = view.waiting.filter((t) => t.id !== next?.id);
  const canCall = b.status === "available" && !current;
  const now = new Date();
  const sinceCalled = current?.calledAt ? minutesBetween(new Date(current.calledAt), now) : 0;
  const overGrace = current?.status === "called" && sinceCalled >= view.business.graceMinutes;
  const rowTicket = view.waiting.find((t) => t.id === rowSheet) ?? null;
  const pending = view.pendingPayments.length;

  return (
    <>
      <header className="bg-brand text-brand-ink sticky top-0 z-10 -mx-4 flex min-h-14 items-center justify-between gap-3 px-4">
        <p className="min-w-0 truncate">
          <span className="font-bold">{b.name}</span>{" "}
          <span className="text-sm opacity-80">{STATUS_LABEL[b.status]}</span>
        </p>
        {b.status === "off" || b.status === "paused" ? (
          <button
            type="button"
            className={BAND_BUTTON}
            disabled={busyAction !== null || !online}
            onClick={() => run("resume", () => setMyStatus("available"))}
          >
            {b.status === "off" ? "Estoy aquí" : "Volver"}
          </button>
        ) : (
          <button
            type="button"
            className={BAND_BUTTON}
            disabled={busyAction !== null || !!current || !online}
            onClick={() =>
              view.mineWaiting > 0 ? setPauseSheet(true) : run("pause", () => setMyStatus("paused"))
            }
          >
            Pausar
          </button>
        )}
      </header>

      <main className={current?.status === "called" ? "pb-72" : "pb-56"}>
        <h1 className="sr-only">Mi fila</h1>
        <div className="-mx-4">
          <ConnectionBanner online={online} lastSeen={lastUpdated ?? loadedAt} />
        </div>
        {cleaning}

        {error && (
          <div
            role="alert"
            className="border-danger mt-3 flex gap-2 rounded-md border-2 p-3 text-sm font-medium"
          >
            <Icon name="error" className="text-danger mt-0.5 size-5 shrink-0" />
            <p className="text-danger">{error}</p>
          </div>
        )}
        {notice && (
          <p role="status" className="text-ok bg-ok-soft mt-3 rounded-md p-3 text-sm font-medium">
            {notice}
          </p>
        )}

        <section aria-label="Turno" className="-mx-4">
          {current ? (
            <>
              <BlockLabel>{current.status === "called" ? "Llamaste a" : "Atendiendo"}</BlockLabel>
              <CurrentBlock
                ticket={current}
                overGrace={overGrace}
                sinceCalled={sinceCalled}
                busy={busyAction}
                run={run}
                now={now}
              />
            </>
          ) : next ? (
            <>
              <BlockLabel>Sigue</BlockLabel>
              <div className="bg-card border-line min-h-[110px] border-y px-4 py-3">
                {/* Tocarlo abre la hoja del turno, con "Avisar por WhatsApp" (REQ-009.4) */}
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setRowSheet(next.id)}
                  className="block w-full text-left"
                >
                  <TicketTitle ticket={next} />
                  <span className="text-muted mt-1 block text-sm">
                    {next.serviceName} · esperando hace{" "}
                    {minutesBetween(new Date(next.createdAt), now)} min
                  </span>
                </button>
                <TicketBadges ticket={next} busy={busyAction} run={run} />
              </div>
            </>
          ) : (
            <div className="min-h-[110px] px-4 pt-6 pb-3">
              <h2 className="text-xl font-bold">Nadie en tu fila por ahora</h2>
              <p className="text-muted mt-2">
                Cuando alguien tome turno contigo o con “el primero libre”, aparece aquí
                solo.
              </p>
              <p className="text-muted mt-3">
                ¿Hay alguien en el local sin turno? Que escanee el QR de la entrada.
              </p>
            </div>
          )}
        </section>

        {pending > 0 && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setPendingSheet(true);
            }}
            className="bg-card border-line text-warn -mx-4 mt-3 flex min-h-15 w-[calc(100%+2rem)] items-center gap-3 border-y px-4 text-left font-semibold"
          >
            <Icon name="cash" className="size-5" />
            <span className="flex-1">
              {pending} {pending === 1 ? "cobro pendiente" : "cobros pendientes"}
            </span>
            <Icon name="next" className="text-muted size-5" />
          </button>
        )}

        {after.length > 0 && (
          <section aria-label="Después" className="-mx-4">
            <BlockLabel>Después · {after.length} más</BlockLabel>
            <ol className="divide-line border-line bg-card divide-y border-y">
              {after.map((t, i) => (
                <WaitingRow
                  key={t.id}
                  ticket={t}
                  index={i + (next ? 1 : 0)}
                  now={now}
                  onOpen={() => setRowSheet(t.id)}
                  flash={fresh.has(t.id)}
                />
              ))}
            </ol>
          </section>
        )}

        <div className="mt-4">
          <TodayAppointments
            title="Mis citas de hoy"
            appointments={view.appointments}
            showBarber={false}
            disabled={busyAction !== null}
            onArrived={(id) => run(`arrived-${id}`, () => markAppointmentArrived(id))}
          />
        </div>

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
                  Empezar corte
                </Button>
                <Button
                  variant="secondary"
                  className={`w-full ${overGrace ? "border-warn bg-warn-soft border-2" : ""}`}
                  disabled={busyAction !== null || !online}
                  pending={busyAction === "noshow"}
                  onClick={() => run("noshow", () => markNoShow(current.id))}
                >
                  No vino
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
                      setCheckout(current.id); // REQ-023.1: al terminar se abre el cobro
                    }
                    return r;
                  })
                }
              >
                Terminar y cobrar
              </Button>
            ) : next ? (
              <Button
                size="giant"
                disabled={!canCall || busyAction !== null || !online}
                pending={busyAction === "call"}
                pendingText="Llamando…"
                onClick={() => run("call", () => callNext(next.id))}
              >
                Llamar a {next.displayNumber}
              </Button>
            ) : (
              <Button size="giant" disabled>
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
      </main>

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
        open={pendingSheet}
        onClose={() => setPendingSheet(false)}
        title="Cobros pendientes"
        description="Turnos que atendiste y no quedaron cobrados."
      >
        <ul className="divide-line divide-y">
          {view.pendingPayments.map((t) => (
            <li key={t.id} className="flex min-h-15 items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="block truncate font-semibold">
                  {t.displayNumber} · {t.customerName}
                </span>
                <span className="text-muted block truncate text-sm">{t.serviceName}</span>
              </span>
              <Button
                variant="secondary"
                className="shrink-0"
                onClick={() => {
                  setPendingSheet(false);
                  setNotice(null);
                  setCheckout(t.id);
                }}
              >
                Cobrar
              </Button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={!!rowTicket}
        onClose={() => setRowSheet(null)}
        title={rowTicket ? `${rowTicket.displayNumber} · ${rowTicket.customerName}` : ""}
        description={
          rowTicket
            ? `${rowTicket.serviceName} ${rowTicket.serviceDurationMin} min · esperando hace ${minutesBetween(new Date(rowTicket.createdAt), now)} min · ${rowTicket.preferredBarberId === b.id ? "te eligió" : "el primero libre"}`
            : undefined
        }
      >
        {rowTicket && (
          <RowDetail
            ticket={rowTicket}
            view={view}
            appUrl={appUrl}
            busy={busyAction}
            run={run}
            onClose={() => setRowSheet(null)}
          />
        )}
      </Sheet>

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
    </>
  );
}

/** "Pausar"/"Volver" en contorno claro sobre la franja azul (tablero Barbero-Fila). */
const BAND_BUTTON =
  "min-h-12 shrink-0 rounded-md border border-current/40 px-3 text-sm font-semibold disabled:opacity-50";

function BlockLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-muted px-4 pt-4 pb-2 text-xs font-bold tracking-wider uppercase">
      {children}
    </h2>
  );
}

/** Número (48 px) y nombre (20 px), como el tablero. */
function TicketTitle({ ticket }: { ticket: QueueTicket }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="text-5xl leading-none font-bold tabular-nums">{ticket.displayNumber}</span>
      <span className="min-w-0 text-xl font-bold break-words">{ticket.customerName}</span>
    </span>
  );
}

/** Cita, premio, membresía y bebida de cortesía del turno. */
function TicketBadges({
  ticket,
  busy,
  run,
}: {
  ticket: QueueTicket;
  busy: string | null;
  run: (key: string, a: () => Promise<ActionResult>) => void;
}) {
  return (
    <>
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
    </>
  );
}

/** El turno en la silla: llamado (borde rojo) o en servicio; los botones van abajo. */
function CurrentBlock({
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
      className={`border-line min-h-[110px] border-y px-4 py-3 ${called ? "border-l-called border-l-4" : ""} ${overGrace ? "bg-warn-soft" : "bg-card"}`}
      aria-label={`Turno actual ${ticket.customerName}`}
    >
      <TicketTitle ticket={ticket} />
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <StatusChip status={called ? "called" : "in_service"} />
        <span className="text-muted">
          {called
            ? `hace ${sinceCalled} min${overGrace ? " · se pasó el tiempo de gracia" : ""}`
            : `desde ${ticket.startedAt ? formatTimeBogota(new Date(ticket.startedAt)) : "ahora"} · ${sinceStarted} min`}
        </span>
      </p>
      <p className="text-muted mt-1 text-sm">
        {ticket.serviceName}
        {called ? "" : ` · estimado ${ticket.serviceDurationMin} min`}
      </p>
      <TicketBadges ticket={ticket} busy={busy} run={run} />
    </article>
  );
}

/** Fila de "Después" (60 px): tocarla abre la hoja del turno. */
function WaitingRow({
  ticket,
  index,
  now,
  onOpen,
  flash,
}: {
  ticket: QueueTicket;
  index: number;
  now: Date;
  onOpen: () => void;
  /** REQ-078.12: llegó por tiempo real y entra resaltado. */
  flash: boolean;
}) {
  const shouldNotify = ticket.ahead === 2 && !ticket.notifiedAt;
  const waitedMin = minutesBetween(new Date(ticket.createdAt), now);
  return (
    <li data-testid="waiting-row">
      <FlashRow
        flash={flash}
        className={shouldNotify ? "shadow-[inset_3px_0_0_var(--color-warn)]" : ""}
      >
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          className="flex min-h-15 w-full items-center gap-3 px-4 text-left"
        >
          <span className="w-12 shrink-0 font-bold tabular-nums">{ticket.displayNumber}</span>
          <span className="min-w-0 flex-1 truncate">
            <span className="sr-only">{index + 1}. </span>
            {ticket.customerName}
            {ticket.rewardAvailable && <span className="sr-only"> · Premio disponible</span>}
          </span>
          {ticket.scheduledAt ? (
            <AppointmentBadge scheduledAt={ticket.scheduledAt} />
          ) : (
            <span className="text-muted shrink-0 text-sm">
              {ticket.serviceName}
              <span className="sr-only"> · hace {waitedMin} min</span>
            </span>
          )}
        </button>
      </FlashRow>
    </li>
  );
}

/** Hoja de un turno de "Después": sus etiquetas y "Avisar por WhatsApp" (REQ-009, REQ-020.5). */
function RowDetail({
  ticket,
  view,
  appUrl,
  busy,
  run,
  onClose,
}: {
  ticket: QueueTicket;
  view: BarberQueueView;
  appUrl: string;
  busy: string | null;
  run: (key: string, a: () => Promise<ActionResult>) => void;
  onClose: () => void;
}) {
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
    <div className="flex flex-col gap-3">
      <div>
        <TicketBadges ticket={ticket} busy={busy} run={run} />
      </div>
      {ticket.notifiedAt && (
        <p className="text-ok bg-ok-soft flex min-h-12 items-center justify-center gap-2 rounded-md font-semibold">
          <Icon name="check" className="size-5" />
          Avisado ✓
        </p>
      )}
      {/* REQ-040.8: el botón manual sigue aunque ya esté avisado */}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener"
          onClick={() => run(`notify-${ticket.id}`, () => markNotified(ticket.id))}
          aria-disabled={busy !== null}
          className="btn-secondary"
        >
          Avisar por WhatsApp
        </a>
      )}
      <Button variant="text" className="mx-auto" onClick={onClose}>
        Cerrar
      </Button>
    </div>
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
