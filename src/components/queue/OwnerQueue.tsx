"use client";

import { useCallback, useState, useTransition } from "react";
import { AdminNav } from "@/components/admin/AdminNav";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";
import { CourtesyLine } from "@/components/queue/CourtesyLine";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import { setBarberPresent } from "@/lib/actions/admin";
import {
  addManualTicket,
  callTicket,
  cancelTicket,
  finishService,
  getBusinessQueue,
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
import { minutesBetween } from "@/lib/domain/time";
import { withRetry } from "@/lib/net/retry";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

const STATUS = {
  available: "Disponible",
  busy: "En servicio",
  paused: "En pausa",
  off: "No está",
} as const;
const TSTATUS = {
  waiting: "Esperando",
  called: "Llamado",
  in_service: "En servicio",
  done: "Terminado",
  cancelled: "Cancelado",
  no_show: "No llegó",
} as const;

export function OwnerQueue({ initial }: { initial: OwnerQueueView }) {
  const [view, setView] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** REQ-023.6: el dueño cobra cualquier turno pendiente (REQ-023.7). */
  const [checkout, setCheckout] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const [, startTransition] = useTransition();

  // Sin red, la relectura también falla: se conserva el último estado (REQ-011.6) en vez de
  // dejar que el error tumbe la página justo después de mostrar "Revisa tu conexión" (REQ-011.3).
  const reload = useCallback(async () => {
    try {
      const v = await getBusinessQueue();
      if (v) setView(v);
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

  return (
    <main className="pb-24">
      <ConnectionBanner online={online} />
      <AdminNav current="/admin/fila" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Fila</h1>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${view.business.isOpen ? "text-ok bg-green-50" : "text-danger bg-red-50"}`}
        >
          {view.business.isOpen ? "Abierta" : "Cerrada"}
        </span>
      </div>

      {error && (
        <p role="alert" className="text-danger mt-2 rounded-xl bg-red-50 p-3 text-sm font-medium">
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
              className={`min-h-10 rounded-full border px-3 text-sm font-medium ${b.status === "off" ? "border-line text-muted" : b.status === "paused" ? "border-amber-400 bg-amber-50" : b.status === "busy" ? "border-accent bg-blue-50" : "border-ok bg-green-50"}`}
              title="Tocar para marcar presente / ausente"
            >
              {b.name} · {STATUS[b.status]}
            </button>
          ))}
        </div>
      </section>

      <section className="mt-4" aria-label="Turnos activos">
        {view.active.length === 0 ? (
          <p className="text-muted">No hay turnos activos.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {view.active.map((t, i) => {
              const barber = view.barbers.find(
                (b) => b.id === (t.assignedBarberId ?? t.preferredBarberId),
              );
              const open = openTicket === t.id;
              return (
                <li key={t.id} className="border-line bg-card rounded-xl border p-3">
                  <button
                    type="button"
                    className="flex w-full items-start justify-between gap-2 text-left"
                    onClick={() => setOpenTicket(open ? null : t.id)}
                    aria-expanded={open}
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {t.displayNumber}. {t.customerName}
                      </p>
                      <p className="text-muted text-sm">
                        {t.serviceName} ·{" "}
                        {t.assignedBarberId
                          ? `con ${barber?.name}`
                          : t.preferredBarberId
                            ? `prefiere ${barber?.name}`
                            : "el que esté libre"}{" "}
                        · hace {minutesBetween(new Date(t.createdAt), now)}&apos;
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-semibold ${t.status === "waiting" ? "bg-gray-100" : t.status === "called" ? "bg-amber-100" : "bg-blue-100"}`}
                    >
                      {TSTATUS[t.status]}
                    </span>
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
                      index={i}
                      waiting={waiting}
                      barbers={canDo(view, t.serviceId, activeBarbers)}
                      allBarbers={view.barbers}
                      busy={busy}
                      run={run}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {view.pendingPayments.length > 0 && (
        <section className="mt-4" aria-label="Cobros pendientes">
          <h2 className="text-muted text-xs font-semibold uppercase">Cobros pendientes</h2>
          <ul className="mt-1 flex flex-col gap-2">
            {view.pendingPayments.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-amber-400 bg-amber-50 p-3 text-sm"
              >
                <span className="min-w-0 truncate font-semibold">
                  {t.customerName} · {t.serviceName}
                </span>
                <button
                  type="button"
                  className="btn-primary w-auto shrink-0 px-4"
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

      {manual && (
        <ManualTicketSheet view={view} busy={busy} onClose={() => setManual(false)} run={run} />
      )}

      <div className="bg-surface fixed inset-x-0 bottom-0 p-4">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy}
            onClick={() => setManual(true)}
          >
            Agregar cliente
          </button>
          {/* REQ-017.2: cerrada por horario o a mano, el dueño la abre por el resto del día */}
          {!view.business.isOpen ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => run(() => setQueueOverride("open"))}
            >
              Abrir fila hoy
            </button>
          ) : (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy}
              onClick={() => {
                if (window.confirm("¿Cerrar la fila por hoy? Se cancelan los turnos en espera."))
                  run(() => setQueueOverride("closed"));
              }}
            >
              Cerrar fila por hoy
            </button>
          )}
        </div>
        <LastUpdated at={lastUpdated} />
      </div>
    </main>
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
  index,
  waiting,
  barbers,
  allBarbers,
  busy,
  run,
}: {
  ticket: QueueTicket;
  index: number;
  waiting: QueueTicket[];
  barbers: OwnerQueueView["barbers"];
  allBarbers: OwnerQueueView["barbers"];
  busy: boolean;
  run: (a: () => Promise<ActionResult>) => void;
}) {
  const [callWith, setCallWith] = useState<string>(
    barbers.find((b) => b.status === "available")?.id ?? "",
  );
  const wIndex = waiting.findIndex((w) => w.id === t.id);
  void index;
  return (
    <div
      className="border-line mt-3 flex flex-col gap-2 border-t pt-3"
      role="group"
      aria-label={`Acciones para ${t.customerName}`}
    >
      {t.status === "waiting" && (
        <>
          <div className="flex gap-2">
            <select
              className="input"
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
              className="btn-secondary w-auto px-4"
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
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || wIndex <= 0}
              onClick={() =>
                run(() => moveTicket(t.id, wIndex >= 2 ? waiting[wIndex - 2].id : null))
              }
            >
              ↑ Subir
            </button>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy || wIndex < 0 || wIndex >= waiting.length - 1}
              onClick={() => run(() => moveTicket(t.id, waiting[wIndex + 1].id))}
            >
              ↓ Bajar
            </button>
          </div>
        </>
      )}
      {t.status === "called" && (
        <div className="flex gap-2">
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
      <button
        type="button"
        className="btn-danger"
        disabled={busy}
        onClick={() => {
          if (window.confirm(`¿Cancelar el turno de ${t.customerName}?`))
            run(() => cancelTicket(t.id));
        }}
      >
        Cancelar turno
      </button>
    </div>
  );
}

function ManualTicketSheet({
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
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Agregar cliente"
      className="fixed inset-0 z-30 flex items-end bg-black/40"
    >
      <form
        className="bg-card flex w-full flex-col gap-3 rounded-t-2xl p-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(() =>
            addManualTicket({ name, phone, serviceId, preferredBarberId: barberId || null }),
          );
          onClose();
        }}
      >
        <p className="text-lg font-bold">Agregar cliente a la fila</p>
        <label className="flex flex-col text-sm">
          Nombre
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={60}
          />
        </label>
        <label className="flex flex-col text-sm">
          Celular (opcional)
          <input
            className="input"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="Sin celular no se crea ficha"
          />
        </label>
        <label className="flex flex-col text-sm">
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
        <label className="flex flex-col text-sm">
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
        <div className="flex gap-2">
          <button type="submit" className="btn-primary" disabled={busy}>
            Agregar
          </button>
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}
