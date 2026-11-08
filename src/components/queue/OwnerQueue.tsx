"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";
import { CourtesyLine } from "@/components/queue/CourtesyLine";
import { MemberBadge } from "@/components/queue/MemberBadge";
import { AppointmentBadge, TodayAppointments } from "@/components/queue/TodayAppointments";
import { Button } from "@/components/ui/Button";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import { FlashRow } from "@/components/ui/FlashRow";
import { Sheet } from "@/components/ui/Sheet";
import { StatusChip } from "@/components/ui/StatusChip";
import { setBarberPresent } from "@/lib/actions/admin";
import {
  addManualTicket,
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
import { maskPhone } from "@/lib/domain/phone";
import { minutesBetween } from "@/lib/domain/time";
import { withRetry } from "@/lib/net/retry";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

const STATUS = {
  available: "Disponible",
  busy: "En servicio",
  paused: "En pausa",
  off: "No está",
} as const;
/** Carril de "el que esté libre" (tablero Dueno-Fila). */
const FREE = "free";

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
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
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

  function run(action: () => Promise<ActionResult>) {
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
        setOpenTicket(null);
        await reload();
      }
    });
  }

  const now = new Date();
  const waiting = view.active.filter((t) => t.status === "waiting");
  const activeBarbers = view.barbers.filter((b) => b.isActive);
  const laneOf = (t: QueueTicket) => t.assignedBarberId ?? t.preferredBarberId ?? FREE;
  // Un carril por barbero presente (o con turnos) y "El primero libre" al final (tablero Dueno-Fila)
  const lanes = [
    ...activeBarbers
      .filter((b) => b.status !== "off" || view.active.some((t) => laneOf(t) === b.id))
      .map((b) => ({ id: b.id, label: `Carril de ${b.name}`, title: b.name, barber: b })),
    { id: FREE, label: "El primero libre", title: "El primero libre", barber: null },
  ];
  const freeWaiting = waiting.filter((t) => laneOf(t) === FREE).length;

  return (
    <main data-wide className="pb-24">
      <ConnectionBanner online={online} lastSeen={lastUpdated} />
      {top}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <h1 className="text-[28px] leading-tight font-bold">Fila</h1>
        <span
          className={`rounded-xs px-2 py-0.5 text-sm font-semibold ${view.business.isOpen ? "text-ok bg-ok-soft" : "text-danger bg-accent-soft"}`}
        >
          {view.business.isOpen ? "Abierta" : "Cerrada"}
        </span>
        <p className="text-muted w-full text-sm">
          <strong className="text-ink tabular-nums">{waiting.length}</strong> esperando ·{" "}
          <strong className="text-ink tabular-nums">{freeWaiting}</strong> con &quot;el primero
          libre&quot;
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="text-danger bg-accent-soft mt-2 rounded-md p-3 text-sm font-medium"
        >
          {error}
        </p>
      )}

      <section className="mt-3" aria-label="Barberos">
        <div className="flex flex-wrap gap-2">
          {activeBarbers.map((b) => (
            <button
              key={b.id}
              type="button"
              disabled={busy}
              onClick={() =>
                run(() =>
                  setBarberPresent(b.id, b.status === "off").then((r) =>
                    r?.error ? { ok: false, error: r.error } : { ok: true },
                  ),
                )
              }
              className={`min-h-12 rounded-sm border px-3 text-sm font-semibold ${b.status === "off" ? "border-line text-muted bg-card" : b.status === "paused" ? "border-warn bg-warn-soft text-warn" : b.status === "busy" ? "border-brand bg-brand-soft text-ink" : "border-ok bg-ok-soft text-ok"}`}
              title="Tocar para marcar presente / ausente"
            >
              {b.name} · {STATUS[b.status]}
            </button>
          ))}
        </div>
      </section>

      <div className="mt-4">
        <TodayAppointments
          title="Citas de hoy"
          appointments={view.appointments}
          showBarber
          disabled={busy}
          onArrived={(id) => run(() => markAppointmentArrived(id))}
        />
      </div>

      <section className="mt-4" aria-label="Turnos activos">
        {view.active.length === 0 ? (
          <p className="text-muted">No hay turnos activos. Los que lleguen por el QR salen aquí.</p>
        ) : (
          // Celular: una sola lista en el orden de la fila (`order` sobre los carriles con
          // `display: contents`). Escritorio: un carril por barbero, lado a lado (REQ-078.15).
          <div
            className="flex flex-col gap-2 lg:grid lg:grid-cols-[repeat(var(--lanes),minmax(11rem,1fr))] lg:items-start lg:gap-3 lg:overflow-x-auto lg:pb-2"
            style={{ "--lanes": lanes.length } as React.CSSProperties}
          >
            {lanes.map((lane) => {
              const tickets = view.active.filter((t) => laneOf(t) === lane.id);
              const b = lane.barber;
              return (
                <section
                  key={lane.id}
                  aria-label={lane.label}
                  className={`lg:bg-card max-lg:contents lg:min-h-40 lg:rounded-md lg:border ${lane.id === FREE ? "lg:border-line-strong lg:border-dashed" : tickets.some((t) => t.status === "called") ? "lg:border-accent" : "lg:border-line"}`}
                >
                  <header className="border-line hidden border-b px-3 py-2 lg:block">
                    <p className="truncate font-bold">{lane.title}</p>
                    <p className="text-muted text-sm">
                      {b ? `${STATUS[b.status]} · ` : "Va con quien se desocupe · "}
                      <span className="tabular-nums">
                        {tickets.filter((t) => t.status === "waiting").length}
                      </span>{" "}
                      en fila
                    </p>
                  </header>
                  <ol className="max-lg:contents lg:flex lg:flex-col">
                    {tickets.map((t) => (
                      <TicketRow
                        key={t.id}
                        ticket={t}
                        order={view.active.indexOf(t)}
                        flash={fresh.has(t.id)}
                        open={openTicket === t.id}
                        onToggle={() => setOpenTicket(openTicket === t.id ? null : t.id)}
                        view={view}
                        now={now}
                        busy={busy}
                        run={run}
                        waiting={waiting}
                        barbers={canDo(view, t.serviceId, activeBarbers)}
                        onCancel={() => setCancelling(t)}
                      />
                    ))}
                    {tickets.length === 0 && (
                      <li className="text-muted hidden px-3 py-3 text-sm lg:block">Libre</li>
                    )}
                  </ol>
                </section>
              );
            })}
          </div>
        )}
      </section>

      {view.pendingPayments.length > 0 && (
        <section className="mt-4" aria-label="Cobros pendientes">
          <h2 className="text-muted text-xs font-semibold tracking-wide uppercase">
            Cobros pendientes
          </h2>
          <ul className="mt-1 flex flex-col gap-2 lg:grid lg:grid-cols-2">
            {view.pendingPayments.map((t) => (
              <li
                key={t.id}
                className="border-warn bg-warn-soft flex items-center justify-between gap-3 rounded-md border p-3 text-sm"
              >
                <span className="min-w-0 truncate font-semibold">
                  {t.customerName} · {t.serviceName}
                </span>
                <button
                  type="button"
                  className="btn-secondary w-auto shrink-0 px-4"
                  onClick={() => setCheckout(t.id)}
                >
                  Cobrar
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {/* Encima de la barra del menú en el celular (REQ-077.1); en escritorio, a la derecha del lateral */}
      <div className="bg-surface border-line fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t p-4 lg:bottom-0 lg:left-60">
        <div className="mx-auto flex max-w-md gap-2 lg:max-w-6xl lg:justify-end">
          {/* REQ-017.2: cerrada por horario o a mano, el dueño la abre por el resto del día */}
          {!view.business.isOpen ? (
            <button
              type="button"
              className="btn-secondary lg:w-auto"
              disabled={busy}
              onClick={() => run(() => setQueueOverride("open"))}
            >
              Abrir fila hoy
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary lg:w-auto"
              disabled={busy}
              onClick={() => setClosingQueue(true)}
            >
              Cerrar fila por hoy
            </button>
          )}
          <button
            type="button"
            className="btn-primary lg:w-auto"
            disabled={busy}
            onClick={() => setManual(true)}
          >
            Agregar cliente
          </button>
        </div>
        <LastUpdated at={lastUpdated} />
      </div>
    </main>
  );
}

/**
 * Un turno de la fila: número, nombre, estado, servicio y celular enmascarado (REQ-078.6). Tocarlo
 * abre sus acciones debajo. `order` lo deja en su puesto de la fila en el celular.
 */
function TicketRow({
  ticket: t,
  order,
  flash,
  open,
  onToggle,
  view,
  now,
  busy,
  run,
  waiting,
  barbers,
  onCancel,
}: {
  ticket: QueueTicket;
  order: number;
  flash: boolean;
  open: boolean;
  onToggle: () => void;
  view: OwnerQueueView;
  now: Date;
  busy: boolean;
  run: (a: () => Promise<ActionResult>) => void;
  waiting: QueueTicket[];
  barbers: OwnerQueueView["barbers"];
  onCancel: () => void;
}) {
  const barber = view.barbers.find((b) => b.id === (t.assignedBarberId ?? t.preferredBarberId));
  return (
    <li
      style={{ order }}
      className={`border-line bg-card rounded-md border lg:rounded-none lg:border-0 lg:border-b lg:last:border-b-0 ${t.status === "called" ? "max-lg:border-accent" : ""}`}
    >
      <FlashRow flash={flash} className="p-3">
        <button
          type="button"
          className="flex min-h-12 w-full items-start justify-between gap-2 text-left"
          onClick={onToggle}
          aria-expanded={open}
        >
          <div className="min-w-0">
            <p className="font-semibold break-words">
              <span className="tabular-nums">{t.displayNumber}</span>. {t.customerName}
            </p>
            <AppointmentBadge scheduledAt={t.scheduledAt} />
            {t.isMember && <MemberBadge />}
            <p className="text-muted text-sm">
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
          </div>
          <StatusChip status={t.status} />
        </button>
        {t.courtesyName && (
          <CourtesyLine
            name={t.courtesyName}
            served={t.courtesyServed}
            disabled={busy}
            onServe={() => run(() => markCourtesyServed(t.id))}
          />
        )}
        {open && (
          <TicketMenu
            ticket={t}
            waiting={waiting}
            barbers={barbers}
            allBarbers={view.barbers}
            busy={busy}
            run={run}
            onCancel={onCancel}
          />
        )}
      </FlashRow>
    </li>
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

function TicketMenu({
  ticket: t,
  waiting,
  barbers,
  allBarbers,
  busy,
  run,
  onCancel,
}: {
  ticket: QueueTicket;
  waiting: QueueTicket[];
  barbers: OwnerQueueView["barbers"];
  allBarbers: OwnerQueueView["barbers"];
  busy: boolean;
  run: (a: () => Promise<ActionResult>) => void;
  /** Abre la hoja de confirmación (REQ-078.3). */
  onCancel: () => void;
}) {
  const [callWith, setCallWith] = useState<string>(
    barbers.find((b) => b.status === "available")?.id ?? "",
  );
  const wIndex = waiting.findIndex((w) => w.id === t.id);
  return (
    <div
      className="border-line mt-3 flex flex-col gap-2 border-t pt-3"
      role="group"
      aria-label={`Acciones para ${t.customerName}`}
    >
      {t.status === "waiting" && (
        <>
          <div className="flex flex-wrap gap-2">
            <select
              className="input min-w-0 flex-[1_1_8rem]"
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
              className="btn-secondary flex-[1_1_5rem] px-4"
              disabled={busy || !callWith}
              onClick={() => run(() => callTicket(t.id, callWith))}
            >
              Llamar
            </button>
          </div>
          <div className="flex gap-2">
            <select
              className="input"
              aria-label="Reasignar a"
              defaultValue={t.preferredBarberId ?? ""}
              onChange={(e) => run(() => reassignTicket(t.id, e.target.value || null))}
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
                  {allBarbers.find((b) => b.id === t.preferredBarberId)?.name ?? "Barbero"}
                </option>
              )}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 [&>*]:flex-[1_1_6rem]">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || wIndex <= 0}
              onClick={() =>
                run(() => moveTicket(t.id, wIndex >= 2 ? waiting[wIndex - 2].id : null))
              }
            >
              Subir
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || wIndex < 0 || wIndex >= waiting.length - 1}
              onClick={() => run(() => moveTicket(t.id, waiting[wIndex + 1].id))}
            >
              Bajar
            </button>
          </div>
        </>
      )}
      {t.status === "called" && (
        <div className="flex flex-wrap gap-2 [&>*]:flex-[1_1_8rem]">
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => run(() => startService(t.id))}
          >
            En la silla
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => run(() => markNoShow(t.id))}
          >
            No llegó
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() => run(() => uncallTicket(t.id))}
          >
            Devolver a la fila
          </button>
        </div>
      )}
      {t.status === "in_service" && (
        <button
          type="button"
          className="btn-secondary"
          disabled={busy}
          onClick={() => run(() => finishService(t.id))}
        >
          Terminado
        </button>
      )}
      <button type="button" className="btn-danger" disabled={busy} onClick={onCancel}>
        Cancelar turno
      </button>
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
  run: (a: () => Promise<ActionResult>) => void;
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
  run: (a: () => Promise<ActionResult>) => void;
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
