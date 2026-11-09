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
import { setBarberPresent } from "@/lib/actions/admin";
import {
  addManualTicket,
  callNextFor,
  callTicket,
  cancelTicket,
  finishService,
  getBusinessQueue,
  markAppointmentArrived,
  markCourtesyServed,
  markNoShow,
  moveTicket,
  reassignTicket,
  setQueueOverride,
  startService,
  uncallTicket,
  type ActionResult,
  type OwnerQueueView,
  type QueueTicket,
} from "@/lib/actions/queue";
import {
  buildLanes,
  FREE_LANE,
  laneNow,
  laneOf,
  type Lane,
  type LaneNowTone,
} from "@/lib/domain/owner-queue";
import { maskPhone } from "@/lib/domain/phone";
import { minutesBetween } from "@/lib/domain/time";
import { shortName } from "@/lib/domain/today";
import { withRetry } from "@/lib/net/retry";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

const STATUS = {
  available: "Disponible",
  busy: "En servicio",
  paused: "En pausa",
  off: "No está",
} as const;

/** Bloque fijo de 40 px bajo el encabezado del carril (tablero Dueno-Fila). */
const TONE: Record<LaneNowTone, string> = {
  serving: "bg-surface text-ink",
  called: "bg-accent-soft text-danger font-semibold",
  paused: "bg-warn-soft text-warn",
  free: "bg-ok-soft text-ok",
  off: "bg-surface text-muted",
};

type Run = (a: () => Promise<ActionResult>) => void;

/**
 * REQ-012 fila del dueño con la estructura del tablero Dueno-Fila (REQ-078.30, design §22.8).
 * Escritorio: un carril de igual ancho por barbero presente y "El primero libre", cada uno con su
 * estado en el encabezado, el bloque fijo de lo que pasa ahora y los turnos en espera con "⋯".
 * Celular: pestañas Todos / <barbero> N sobre una sola lista (los carriles con `display: contents`
 * y `order`), con "Agregar cliente" o "Llamar al siguiente de <barbero>" fijo abajo.
 */
export function OwnerQueue({
  initial,
  top,
}: {
  initial: OwnerQueueView;
  /** Lo que va entre el menú y la fila (la tarjeta de limpieza, REQ-062). */
  top?: React.ReactNode;
}) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** REQ-023.6: el dueño cobra cualquier turno pendiente (REQ-023.7). */
  const [checkout, setCheckout] = useState<string | null>(null);
  const [pendingOpen, setPendingOpen] = useState(false);
  const [manual, setManual] = useState(false);
  /** Pestaña del celular: "all" o el id del barbero. */
  const [tab, setTab] = useState<string>("all");
  /** REQ-078.3: cancelar un turno y cerrar la fila se confirman en una hoja. */
  const [cancelling, setCancelling] = useState<QueueTicket | null>(null);
  const [closingQueue, setClosingQueue] = useState(false);
  const [, startTransition] = useTransition();
  /** REQ-078.12: turnos que ya estaban en pantalla; los demás entran resaltados. */
  const known = useRef(new Set(initial.active.map((t) => t.id)));
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  // Sin red, la relectura también falla: se conserva el último estado (REQ-011.6) en vez de
  // dejar que el error tumbe la página justo después de mostrar "Revisa tu conexión" (REQ-011.3).
  const reload = useCallback(async () => {
    try {
      const v = await getBusinessQueue();
      if (!v) return;
      const arrived = v.active.filter((t) => !known.current.has(t.id)).map((t) => t.id);
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
  const { online, lastUpdated } = useQueueSubscription(view.business.id, reload);

  const run: Run = (action) => {
    setError(null);
    setBusy(true);
    startTransition(async () => {
      try {
        const r = await withRetry(action);
        if (!r.ok) setError(r.error);
      } catch {
        setError("No se pudo guardar. Revisa tu conexión.");
      } finally {
        setBusy(false);
        await reload();
      }
    });
  };
  const presence = (barberId: string, present: boolean) =>
    run(() =>
      setBarberPresent(barberId, present).then((r) =>
        r?.error ? { ok: false, error: r.error } : { ok: true },
      ),
    );

  const now = new Date();
  const waiting = view.active.filter((t) => t.status === "waiting");
  const activeBarbers = view.barbers.filter((b) => b.isActive);
  const lanes = buildLanes(view.barbers, view.active);
  const absent = activeBarbers.filter((b) => !lanes.some((l) => l.id === b.id));
  const waitingIn = (id: string) => waiting.filter((t) => laneOf(t) === id).length;
  // Si el barbero de la pestaña se fue (sin turnos y ausente), vuelve a "Todos"
  const tabLane = lanes.find((l) => l.id === tab && l.barber);
  const current = tabLane ? tabLane.id : "all";
  const shown = view.active.filter((t) => current === "all" || laneOf(t) === current);
  const pending = view.pendingPayments.length;
  const menu = { view, now, busy, run, waiting, onCancel: setCancelling };

  return (
    <main data-wide className="pb-24">
      <ConnectionBanner online={online} lastSeen={lastUpdated} />
      {top}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="text-[28px] leading-tight font-bold">Fila</h1>
        <p className="text-muted text-sm">
          <strong className="text-ink tabular-nums">{waiting.length}</strong> esperando ·{" "}
          <strong className="text-ink tabular-nums">{waitingIn(FREE_LANE)}</strong> con &quot;el
          primero libre&quot;
        </p>
        <span
          className={`rounded-xs px-2 py-0.5 text-sm font-semibold ${view.business.isOpen ? "text-ok bg-ok-soft" : "text-danger bg-accent-soft"}`}
        >
          {view.business.isOpen ? "Abierta" : "Cerrada"}
        </span>
        <div className="ml-auto hidden flex-wrap gap-2 lg:flex">
          <PageActions view={view} busy={busy} run={run} onClose={() => setClosingQueue(true)} />
          <button
            type="button"
            className="btn-primary w-auto px-5"
            disabled={busy}
            onClick={() => setManual(true)}
          >
            Agregar cliente
          </button>
        </div>
      </div>

      {error && (
        <p
          role="alert"
          className="text-danger bg-accent-soft mt-2 rounded-md p-3 text-sm font-medium"
        >
          {error}
        </p>
      )}

      {/* REQ-078.30: una sola fila que abre la lista; no empuja los carriles */}
      {pending > 0 && (
        <button
          type="button"
          className="border-warn bg-warn-soft text-ink mt-3 flex min-h-[60px] w-full items-center justify-between gap-3 rounded-md border px-4 text-left font-semibold"
          onClick={() => setPendingOpen(true)}
        >
          <span>
            <span className="tabular-nums">{pending}</span>{" "}
            {pending === 1 ? "cobro pendiente" : "cobros pendientes"}
          </span>
          <Icon name="next" className="size-5 shrink-0" />
        </button>
      )}

      <div
        role="tablist"
        aria-label="Barberos"
        className="border-line mt-3 flex [scrollbar-width:none] overflow-x-auto border-b lg:hidden"
      >
        {[{ id: "all", label: "Todos" }, ...lanes.filter((l) => l.barber)].map((l) => {
          const label = "title" in l ? `${l.title} ${waitingIn(l.id)}` : l.label;
          const selected = current === l.id;
          return (
            <button
              key={l.id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setTab(l.id)}
              className={`min-h-12 shrink-0 px-3 text-sm whitespace-nowrap ${selected ? "border-brand text-ink border-b-2 font-bold" : "text-muted font-medium"}`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <section className="mt-3 lg:mt-4" aria-label="Turnos activos">
        {shown.length === 0 && (
          <p className="text-muted py-4 lg:hidden">
            No hay turnos activos. Los que lleguen por el QR salen aquí.
          </p>
        )}
        <div
          className={`max-lg:border-line max-lg:bg-card flex flex-col max-lg:overflow-visible max-lg:rounded-md max-lg:border ${shown.length === 0 && current === "all" ? "max-lg:hidden" : ""} lg:grid lg:grid-cols-[repeat(var(--lanes),minmax(0,1fr))] lg:gap-3`}
          style={{ "--lanes": lanes.length } as React.CSSProperties}
        >
          {lanes.map((lane) => (
            <LaneColumn
              key={lane.id}
              lane={lane}
              tab={current}
              tickets={view.active.filter((t) => laneOf(t) === lane.id)}
              fresh={fresh}
              allBarbers={activeBarbers}
              presence={presence}
              {...menu}
            />
          ))}
        </div>
      </section>

      {absent.length > 0 && (
        <p className="text-muted mt-3 flex flex-wrap items-center gap-x-1 text-sm">
          No están hoy:
          {absent.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() => presence(b.id, true)}
              aria-label={`Marcar a ${b.name} presente`}
              className="text-brand min-h-12 px-1 font-semibold underline underline-offset-4"
            >
              {b.name}
            </button>
          ))}
        </p>
      )}

      <div className="mt-4">
        <TodayAppointments
          title="Citas de hoy"
          appointments={view.appointments}
          showBarber
          disabled={busy}
          onArrived={(id) => run(() => markAppointmentArrived(id))}
        />
      </div>

      <div className="mt-4 hidden lg:block">
        <LastUpdated at={lastUpdated} />
      </div>

      {/* Celular: lo que en escritorio va junto al título, al final y en contorno */}
      <div className="mt-6 flex flex-col gap-2 lg:hidden">
        <PageActions view={view} busy={busy} run={run} onClose={() => setClosingQueue(true)} />
      </div>

      <Sheet open={pendingOpen} onClose={() => setPendingOpen(false)} title="Cobros pendientes">
        <section aria-label="Cobros pendientes">
          <ul className="divide-line divide-y">
            {view.pendingPayments.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-3 py-2 text-base">
                <span className="min-w-0 truncate font-semibold">
                  {t.customerName} · {t.serviceName}
                </span>
                <button
                  type="button"
                  className="btn-secondary w-auto shrink-0 px-4"
                  onClick={() => {
                    setPendingOpen(false);
                    setCheckout(t.id);
                  }}
                >
                  Cobrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      </Sheet>

      {checkout && (
        <CheckoutSheet
          ticketId={checkout}
          onClose={() => {
            setCheckout(null);
            void reload();
          }}
          onDone={() => {
            setCheckout(null);
            void reload();
          }}
        />
      )}

      <ManualTicketSheet
        open={manual}
        view={view}
        busy={busy}
        onClose={() => setManual(false)}
        run={run}
      />

      <Sheet
        open={cancelling !== null}
        onClose={() => setCancelling(null)}
        title={
          cancelling
            ? `¿Cancelar el turno ${cancelling.displayNumber} de ${cancelling.customerName}?`
            : ""
        }
        description="Sale de la fila. Esto no se puede deshacer."
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            onClick={() => {
              const t = cancelling;
              setCancelling(null);
              if (t) run(() => cancelTicket(t.id));
            }}
          >
            Sí, cancelar turno
          </Button>
          <Button variant="secondary" onClick={() => setCancelling(null)}>
            No, dejarlo
          </Button>
        </div>
      </Sheet>

      <Sheet
        open={closingQueue}
        onClose={() => setClosingQueue(false)}
        title="¿Cerrar la fila por hoy?"
        description="Se cancelan los turnos en espera y nadie más puede tomar turno hoy."
      >
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            onClick={() => {
              setClosingQueue(false);
              run(() => setQueueOverride("closed"));
            }}
          >
            Sí, cerrar la fila
          </Button>
          <Button variant="secondary" onClick={() => setClosingQueue(false)}>
            No, dejarla abierta
          </Button>
        </div>
      </Sheet>

      {/* Celular: encima de la barra del menú (REQ-077.1) */}
      <div className="bg-surface border-line fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t p-4 lg:hidden">
        <div className="mx-auto max-w-md">
          {tabLane?.barber ? (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => run(() => callNextFor(tabLane.id))}
            >
              Llamar al siguiente de {tabLane.title}
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary"
              disabled={busy}
              onClick={() => setManual(true)}
            >
              Agregar cliente
            </button>
          )}
        </div>
        <LastUpdated at={lastUpdated} />
      </div>
    </main>
  );
}

/** "Ver pantalla del televisor" y "Cerrar fila por hoy" / "Abrir fila hoy", en contorno. */
function PageActions({
  view,
  busy,
  run,
  onClose,
}: {
  view: OwnerQueueView;
  busy: boolean;
  run: Run;
  onClose: () => void;
}) {
  return (
    <>
      <a
        href={`/${view.business.slug}/pantalla`}
        target="_blank"
        rel="noreferrer"
        className="btn-secondary lg:w-auto lg:px-4"
      >
        Ver pantalla del televisor
      </a>
      {/* REQ-017.2: cerrada por horario o a mano, el dueño la abre por el resto del día */}
      {!view.business.isOpen ? (
        <button
          type="button"
          className="btn-secondary lg:w-auto lg:px-4"
          disabled={busy}
          onClick={() => run(() => setQueueOverride("open"))}
        >
          Abrir fila hoy
        </button>
      ) : (
        <button
          type="button"
          className="btn-secondary lg:w-auto lg:px-4"
          disabled={busy}
          onClick={onClose}
        >
          Cerrar fila por hoy
        </button>
      )}
    </>
  );
}

type MenuProps = {
  view: OwnerQueueView;
  now: Date;
  busy: boolean;
  run: Run;
  waiting: QueueTicket[];
  /** Abre la hoja de confirmación (REQ-078.3). */
  onCancel: (t: QueueTicket) => void;
};

/**
 * Un carril. En escritorio es una columna (`min-width: 0` para que todas midan lo mismo y ningún
 * nombre se parta, REQ-078.30); en el celular sus filas se mezclan en la lista con `order`.
 */
function LaneColumn({
  lane,
  tab,
  tickets,
  fresh,
  allBarbers,
  presence,
  ...menu
}: MenuProps & {
  lane: Lane;
  tab: string;
  tickets: QueueTicket[];
  fresh: ReadonlySet<string>;
  allBarbers: OwnerQueueView["barbers"];
  presence: (barberId: string, present: boolean) => void;
}) {
  const b = lane.barber;
  const free = lane.id === FREE_LANE;
  const inTab = tab === "all" || tab === lane.id;
  const now = laneNow(b, tickets, menu.now, allBarbers);
  const serving = tickets.filter((t) => t.status === "called" || t.status === "in_service");
  const queued = tickets.filter((t) => t.status === "waiting");
  const called = serving.some((t) => t.status === "called");
  return (
    <section
      aria-label={free ? "El primero libre" : `Carril de ${lane.title}`}
      className={`${inTab ? "max-lg:contents" : "max-lg:hidden"} lg:bg-card lg:flex lg:min-h-80 lg:min-w-0 lg:flex-col lg:rounded-md lg:border ${free ? "lg:border-line-strong lg:border-dashed" : called ? "lg:border-accent" : "lg:border-line"}`}
    >
      <header className="hidden min-h-14 items-center gap-1 py-1 pr-1 pl-3 lg:flex">
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold">{lane.title}</p>
          <p className="text-muted truncate text-xs">
            {b ? (
              <>
                <span className="tabular-nums">{queued.length}</span> en fila
                {b.status === "paused" && (
                  <span className="text-warn font-semibold"> · en pausa</span>
                )}
                {b.status === "off" && " · no está hoy"}
              </>
            ) : (
              "Va con quien se desocupe"
            )}
          </p>
        </div>
        {b && (
          <Kebab label={`Acciones de ${b.name}`}>
            {(close) => (
              <>
                {serving.map((t) => (
                  <TicketActions key={t.id} ticket={t} close={close} withTitle {...menu} />
                ))}
                <MenuItem
                  disabled={menu.busy}
                  onClick={() => {
                    close();
                    presence(b.id, b.status === "off");
                  }}
                >
                  {b.status === "off" ? `Marcar a ${b.name} presente` : `${b.name} no vino hoy`}
                </MenuItem>
              </>
            )}
          </Kebab>
        )}
      </header>
      <ol className="max-lg:contents lg:flex lg:flex-col">
        {now.map((line, i) => {
          const t = serving[i];
          // Celular: en "Todos" solo el llamado, arriba en rojo suave; en la pestaña, siempre
          const mobile = tab === lane.id || line.tone === "called" ? "" : "max-lg:hidden";
          return (
            <li
              key={t?.id ?? line.text}
              style={{ order: -1 }}
              className={`border-line flex items-center gap-2 border-b text-sm max-lg:min-h-12 max-lg:pl-4 lg:h-10 lg:px-3 ${TONE[line.tone]} ${mobile}`}
            >
              <span className="min-w-0 flex-1 truncate">{line.text}</span>
              {t && (
                <span className="lg:hidden">
                  <Kebab label={`Acciones para ${t.customerName}`}>
                    {(close) => <TicketActions ticket={t} close={close} {...menu} />}
                  </Kebab>
                </span>
              )}
            </li>
          );
        })}
        {/* Celular: en la pestaña del barbero, marcarlo ausente (en escritorio va en el "⋯") */}
        {b && b.status !== "off" && tab === lane.id && (
          <li style={{ order: 100000 }} className="lg:hidden">
            <button
              type="button"
              disabled={menu.busy}
              onClick={() => presence(b.id, false)}
              className="text-brand min-h-12 px-4 text-sm font-semibold underline underline-offset-4"
            >
              {b.name} no vino hoy
            </button>
          </li>
        )}
        {queued.map((t) => (
          <li
            key={t.id}
            style={{ order: menu.view.active.indexOf(t) }}
            className="border-line border-b lg:last:border-b-0"
          >
            <FlashRow
              flash={fresh.has(t.id)}
              className="flex items-center gap-2 pl-4 max-lg:min-h-[60px] lg:h-[52px] lg:gap-1.5 lg:pl-3"
            >
              <span className="shrink-0 font-bold tabular-nums">{t.displayNumber}</span>
              {/* Escritorio: nombre corto como el tablero ("Ana M."); celular: completo */}
              <span className="min-w-0 flex-1 truncate" title={t.customerName}>
                <span className="lg:hidden">{t.customerName}</span>
                <span className="hidden lg:inline">{shortName(t.customerName)}</span>
              </span>
              {/* REQ-048.2 la marca "Membresía" sigue en la fila */}
              {t.isMember && (
                <span className="shrink-0 [&>span]:m-0">
                  <MemberBadge />
                </span>
              )}
              {t.scheduledAt ? (
                <span className="shrink-0">
                  <AppointmentBadge scheduledAt={t.scheduledAt} />
                </span>
              ) : (
                <span className="text-muted max-w-[40%] shrink-0 truncate text-sm lg:hidden">
                  {t.serviceName}
                </span>
              )}
              {t.courtesyName && !t.courtesyServed && (
                <span aria-label={`Cortesía: ${t.courtesyName}`} className="shrink-0">
                  🥤
                </span>
              )}
              <Kebab label={`Acciones para ${t.customerName}`}>
                {(close) => <TicketActions ticket={t} close={close} {...menu} />}
              </Kebab>
            </FlashRow>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** "⋯": menú flotante encima de la fila; no la empuja (tablero Dueno-Fila). */
function Kebab({
  label,
  children,
}: {
  label: string;
  children: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
        className={`text-muted grid h-12 w-12 place-items-center rounded-sm lg:w-8 ${open ? "bg-brand-soft text-ink" : ""}`}
      >
        <Icon name="more" className="size-6" />
      </button>
      {open && (
        <div
          role="group"
          aria-label={label}
          className="bg-card border-line shadow-overlay text-ink absolute top-full right-0 z-30 mt-1 flex w-72 max-w-[calc(100vw-2rem)] flex-col rounded-md border p-1 text-base font-normal"
        >
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  danger = false,
  disabled,
  onClick,
  children,
}: {
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`hover:bg-surface flex min-h-12 w-full items-center rounded-sm px-3 text-left disabled:opacity-50 ${danger ? "text-danger font-semibold" : ""}`}
    >
      {children}
    </button>
  );
}

/** REQ-035.11: solo los barberos que hacen el servicio (si el servicio ya no está, todos). */
function canDo<B extends { id: string }>(
  view: OwnerQueueView,
  serviceId: string,
  barbers: B[],
): B[] {
  const s = view.services.find((x) => x.id === serviceId);
  return s ? barbers.filter((b) => s.barberIds.includes(b.id)) : barbers;
}

/**
 * Las acciones que ya existían sobre un turno (REQ-012.2): llamar con, subir/bajar, pasar a otro
 * barbero, en la silla, no llegó, devolver, terminado y cancelar. Arriba, el detalle del turno con
 * el celular enmascarado (REQ-078.6) y la bebida de cortesía (REQ-038.5).
 */
function TicketActions({
  ticket: t,
  view,
  now,
  busy,
  run,
  waiting,
  onCancel,
  close,
  withTitle = false,
}: MenuProps & { ticket: QueueTicket; close: () => void; withTitle?: boolean }) {
  const activeBarbers = view.barbers.filter((b) => b.isActive);
  const barbers = canDo(view, t.serviceId, activeBarbers);
  const [callWith, setCallWith] = useState<string>(
    barbers.find((b) => b.status === "available")?.id ?? "",
  );
  const wIndex = waiting.findIndex((w) => w.id === t.id);
  const barber = view.barbers.find((b) => b.id === (t.assignedBarberId ?? t.preferredBarberId));
  const act = (a: () => Promise<ActionResult>) => {
    close();
    run(a);
  };
  return (
    <div className="border-line flex flex-col border-b pb-1 last:border-b-0 last:pb-0">
      <div className="px-3 py-2 text-sm">
        {withTitle && (
          <p className="text-base font-semibold">
            <span className="tabular-nums">{t.displayNumber}</span> · {t.customerName}
          </p>
        )}
        <p className="text-muted">
          {t.serviceName} ·{" "}
          {t.assignedBarberId
            ? `con ${barber?.name}`
            : t.preferredBarberId
              ? `prefiere ${barber?.name}`
              : "el que esté libre"}{" "}
          · hace {minutesBetween(new Date(t.createdAt), now)}&apos;
          {t.customerPhone && (
            <>
              {" "}
              · <span className="tabular-nums">{maskPhone(t.customerPhone)}</span>
            </>
          )}
        </p>
        {t.isMember && <MemberBadge />}
        {t.courtesyName && (
          <CourtesyLine
            name={t.courtesyName}
            served={t.courtesyServed}
            disabled={busy}
            onServe={() => act(() => markCourtesyServed(t.id))}
          />
        )}
      </div>
      {t.status === "waiting" && (
        <>
          <div className="flex gap-2 px-1 pb-1">
            <select
              className="input min-w-0 flex-1"
              value={callWith}
              onChange={(e) => setCallWith(e.target.value)}
              aria-label="Llamar con"
            >
              <option value="">Llamar con…</option>
              {barbers
                .filter((b) => b.status !== "off")
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({STATUS[b.status]})
                  </option>
                ))}
            </select>
            <button
              type="button"
              className="btn-secondary w-auto shrink-0 px-4"
              disabled={busy || !callWith}
              onClick={() => act(() => callTicket(t.id, callWith))}
            >
              Llamar
            </button>
          </div>
          <MenuItem
            disabled={busy || wIndex <= 0}
            onClick={() => act(() => moveTicket(t.id, wIndex >= 2 ? waiting[wIndex - 2].id : null))}
          >
            Subir un puesto
          </MenuItem>
          <MenuItem
            disabled={busy || wIndex < 0 || wIndex >= waiting.length - 1}
            onClick={() => act(() => moveTicket(t.id, waiting[wIndex + 1].id))}
          >
            Bajar un puesto
          </MenuItem>
          <label className="text-muted flex flex-col gap-1 px-1 py-1 text-sm">
            <span className="px-2">Pasar a otro barbero</span>
            <select
              className="input text-ink"
              aria-label="Pasar a otro barbero"
              defaultValue={t.preferredBarberId ?? ""}
              onChange={(e) => act(() => reassignTicket(t.id, e.target.value || null))}
              disabled={busy}
            >
              <option value="">El que esté libre</option>
              {barbers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
              {/* REQ-035.12: el preferido que ya tenía se ve aunque ya no haga el servicio */}
              {t.preferredBarberId && !barbers.some((b) => b.id === t.preferredBarberId) && (
                <option value={t.preferredBarberId} disabled>
                  {view.barbers.find((b) => b.id === t.preferredBarberId)?.name ?? "Barbero"}
                </option>
              )}
            </select>
          </label>
        </>
      )}
      {t.status === "called" && (
        <>
          <MenuItem disabled={busy} onClick={() => act(() => startService(t.id))}>
            En la silla
          </MenuItem>
          <MenuItem disabled={busy} onClick={() => act(() => markNoShow(t.id))}>
            No llegó
          </MenuItem>
          <MenuItem disabled={busy} onClick={() => act(() => uncallTicket(t.id))}>
            Devolver a la fila
          </MenuItem>
        </>
      )}
      {t.status === "in_service" && (
        <MenuItem disabled={busy} onClick={() => act(() => finishService(t.id))}>
          Terminado
        </MenuItem>
      )}
      <MenuItem
        danger
        disabled={busy}
        onClick={() => {
          close();
          onCancel(t);
        }}
      >
        Cancelar turno…
      </MenuItem>
    </div>
  );
}

function ManualTicketSheet({
  open,
  view,
  busy,
  onClose,
  run,
}: {
  open: boolean;
  view: OwnerQueueView;
  busy: boolean;
  onClose: () => void;
  run: Run;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Agregar cliente a la fila">
      <ManualTicketForm view={view} busy={busy} onClose={onClose} run={run} />
    </Sheet>
  );
}

/** Se monta al abrir la hoja: cada vez empieza vacío. */
function ManualTicketForm({
  view,
  busy,
  onClose,
  run,
}: {
  view: OwnerQueueView;
  busy: boolean;
  onClose: () => void;
  run: Run;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(view.services[0]?.id ?? "");
  const [barberId, setBarberId] = useState("");
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addManualTicket({ name, phone, serviceId, preferredBarberId: barberId || null }));
        onClose();
      }}
    >
      <label className="flex flex-col gap-1 text-base font-medium">
        Nombre
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          maxLength={60}
        />
      </label>
      <label className="flex flex-col gap-1 text-base font-medium">
        Celular (opcional)
        <input
          className="input"
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Sin celular no se crea ficha"
        />
      </label>
      <label className="flex flex-col gap-1 text-base font-medium">
        Servicio
        <select
          className="input"
          value={serviceId}
          onChange={(e) => {
            setServiceId(e.target.value);
            // REQ-035.11: si el barbero escogido no hace el servicio nuevo, vuelve "El que esté libre"
            const s = view.services.find((x) => x.id === e.target.value);
            if (s && barberId && !s.barberIds.includes(barberId)) setBarberId("");
          }}
        >
          {view.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} · {s.durationMin} min
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-base font-medium">
        Barbero
        <select className="input" value={barberId} onChange={(e) => setBarberId(e.target.value)}>
          <option value="">El que esté libre</option>
          {canDo(
            view,
            serviceId,
            view.barbers.filter((b) => b.isActive && b.status !== "off"),
          ).map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-col gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>
          Agregar
        </button>
        <button type="button" className="btn-secondary" onClick={onClose}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
