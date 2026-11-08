"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { StampCard } from "@/components/loyalty/StampCard";
import { Button } from "@/components/ui/Button";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import { Sheet } from "@/components/ui/Sheet";
import {
  cancelTicketByToken,
  getPublicBusiness,
  getTicketByToken,
  optOutWhatsapp,
  setTicketCourtesy,
} from "@/lib/actions/public";
import { appointmentTag } from "@/lib/domain/appointments";
import { membershipTicketLine } from "@/lib/domain/membership";
import { formatMinutes } from "@/lib/domain/time";
import { useBrowserOnline } from "@/lib/realtime/use-browser-online";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";
import type { CourtesyOption, MyTicket as Ticket } from "@/lib/queue/public-queue";
import { writePrefs } from "@/lib/storage/customer-prefs";

const CACHE_KEY = (token: string) => `turnos:ticket:${token}`;

/**
 * REQ-004: "Mi turno" en vivo. REQ-005: cancelar. REQ-011.6: último estado conocido sin conexión.
 * Sistema visual de T-162 (tablero Mi turno): el número grande, cancelar en contorno rojo con
 * hoja de confirmación (REQ-078.3) y, sin señal, la franja con la hora de lo último que vimos y
 * cancelar deshabilitado con el motivo (REQ-078.10).
 */
export function MyTicket({
  token,
  initial,
  alreadyHad,
  courtesies,
}: {
  token: string;
  initial: Ticket;
  alreadyHad: boolean;
  courtesies: CourtesyOption[];
}) {
  const [ticket, setTicket] = useState<Ticket>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prevStatus = useRef(initial.status);

  const reload = useCallback(async () => {
    const t = await getTicketByToken(token);
    if (t) setTicket(t);
  }, [token]);

  const { online: live, lastUpdated } = useQueueSubscription(ticket.business.id, reload);
  const browser = useBrowserOnline();
  const online = live && browser.online;
  const [loadedAt] = useState(() => new Date());
  const [confirming, setConfirming] = useState(false);

  // Caché local del último estado (REQ-011.6) y recuerdo del turno (REQ-003.7)
  useEffect(() => {
    try {
      localStorage.setItem(CACHE_KEY(token), JSON.stringify({ ticket, at: Date.now() }));
      writePrefs({ lastTicket: { [ticket.business.slug]: token } });
    } catch {}
  }, [ticket, token]);

  // REQ-004.3: al pasar a "llamado", vibrar
  useEffect(() => {
    if (prevStatus.current !== "called" && ticket.status === "called") {
      try {
        navigator.vibrate?.([200, 100, 200, 100, 400]);
      } catch {}
    }
    prevStatus.current = ticket.status;
  }, [ticket.status]);

  const active = ticket.status === "waiting" || ticket.status === "called";

  function cancel() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const r = await cancelTicketByToken(token);
      if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
      await reload();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28">
      <ConnectionBanner online={online} lastSeen={lastUpdated ?? loadedAt} />
      <header className="pt-5 pb-4">
        <p className="text-muted text-sm">{ticket.business.name}</p>
        <h1 className="text-2xl font-bold">Hola, {ticket.customerName.split(" ")[0]}</h1>
        <p className="mt-3 text-sm font-semibold">Turno</p>
        {/* Alto fijo de una línea: el número no empuja lo de abajo al llegar (REQ-078.8) */}
        <p
          data-testid="ticket-number"
          className="text-[clamp(3rem,30vw,7.5rem)] leading-none font-bold tabular-nums"
        >
          {ticket.displayNumber}
        </p>
        {ticket.scheduledAt && ticket.status === "waiting" && (
          <p className="bg-brand-soft text-brand mt-3 inline-block rounded-sm px-3 py-1 text-sm font-semibold">
            {appointmentTag(ticket.scheduledAt)}
          </p>
        )}
        {alreadyHad && ticket.status === "waiting" && (
          <p
            role="status"
            className="text-warn bg-warn-soft mt-2 rounded-md p-3 text-sm font-medium"
          >
            Ya tienes un turno en la fila. Este es.
          </p>
        )}
      </header>

      <StatusCard ticket={ticket} />

      <section className="mt-4 text-sm" aria-label="Tu turno">
        <p>
          <span className="text-muted">Servicio:</span> {ticket.serviceName} (
          {ticket.serviceDurationMin} min)
        </p>
        <p>
          <span className="text-muted">Barbero:</span>{" "}
          {ticket.assignedBarberName ?? ticket.preferredBarberName ?? "El que esté libre"}
        </p>
        <Courtesy ticket={ticket} token={token} initialOptions={courtesies} onChanged={reload} />
      </section>

      <WhatsappOptOut ticket={ticket} token={token} onChanged={reload} />

      {ticket.membership && (
        <p
          className="bg-brand-soft text-brand mt-4 rounded-md p-3 text-sm font-semibold"
          data-testid="my-membership"
        >
          {membershipTicketLine(ticket.membership)}
        </p>
      )}

      <div className="mt-4">
        <StampCard status={ticket.loyalty} />
      </div>

      <div className="mt-4">
        <LastUpdated at={lastUpdated ?? new Date(initial.createdAt)} />
      </div>

      {error && (
        <p role="alert" className="text-danger mt-3 text-sm font-medium">
          {error}
        </p>
      )}

      <div className="border-line bg-card fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          {active ? (
            <>
              <Button
                variant="danger"
                className="w-full"
                onClick={() => setConfirming(true)}
                disabled={!online}
                pending={pending}
                pendingText="Cancelando…"
              >
                Cancelar mi turno
              </Button>
              {!online && (
                <p className="text-muted text-center text-sm">
                  Para cancelar necesitas señal. Tu turno sigue en la fila.
                </p>
              )}
            </>
          ) : (
            <Link
              href={`/${ticket.business.slug}`}
              className={ticket.googleReviewUrl ? "btn-secondary" : "btn-primary"}
            >
              {ticket.status === "done" ? "Volver al inicio" : "Tomar un turno nuevo"}
            </Link>
          )}
        </div>
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Seguro que quieres cancelar tu turno?"
        description={`Turno ${ticket.displayNumber}. Si vuelves, tomas un turno nuevo al final de la fila.`}
      >
        <Button variant="danger" className="w-full" onClick={cancel}>
          Sí, cancelar mi turno
        </Button>
        <Button variant="text" className="mx-auto" onClick={() => setConfirming(false)}>
          No, seguir en la fila
        </Button>
      </Sheet>
    </main>
  );
}

/**
 * REQ-038.4: en espera se cambia o se quita la bebida. Ya servida tampoco: el barbero la llevó.
 * Las opciones se releen al abrir, para no ofrecer lo que se acabó mientras esperaba (REQ-038.7).
 */
function Courtesy({
  ticket,
  token,
  initialOptions,
  onChanged,
}: {
  ticket: Ticket;
  token: string;
  initialOptions: CourtesyOption[];
  onChanged: () => Promise<void>;
}) {
  const [options, setOptions] = useState(initialOptions);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const { courtesy } = ticket;
  const canChange =
    ticket.status === "waiting" && !courtesy?.served && (options.length > 0 || !!courtesy);
  if (!courtesy && !canChange) return null;

  const refreshOptions = () =>
    getPublicBusiness(ticket.business.slug)
      .then((b) => {
        if (b) setOptions(b.courtesies);
      })
      .catch(() => {}); // sin red se queda con las que ya tenía

  function toggle() {
    setError(null);
    if (!open) void refreshOptions();
    setOpen(!open);
  }

  function pick(productId: string | null) {
    setError(null);
    startSaving(async () => {
      try {
        const r = await setTicketCourtesy(token, productId);
        if (r.ok) setOpen(false);
        else {
          setError(r.error);
          await refreshOptions();
        }
        await onChanged();
      } catch {
        setError("No se pudo guardar. Revisa tu conexión.");
      }
    });
  }

  return (
    <div className="mt-1">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 break-words">
          <span>🥤 {courtesy?.name ?? "Sin bebida"}</span>
          {courtesy?.served && <span className="text-ok font-semibold"> · Servida ✓</span>}
        </p>
        {canChange && (
          <button type="button" className="text-brand min-h-12 shrink-0 underline" onClick={toggle}>
            {courtesy ? "Cambiar bebida" : "Escoger bebida"}
          </button>
        )}
      </div>
      {open && canChange && (
        <fieldset className="mt-1 flex min-w-0 flex-col gap-2" disabled={saving}>
          <legend className="mb-2 font-medium">Bebida de cortesía</legend>
          {[{ id: null, name: "No, gracias" }, ...options].map((o) => (
            <label
              key={o.id ?? "ninguna"}
              className="border-line bg-card flex min-h-12 cursor-pointer items-center gap-2 rounded-md border px-3"
            >
              <input
                type="radio"
                name="courtesy"
                checked={(courtesy?.productId ?? null) === o.id}
                onChange={() => pick(o.id)}
                className="h-5 w-5 shrink-0"
              />
              {o.name}
            </label>
          ))}
        </fieldset>
      )}
      {error && (
        <p role="alert" className="text-danger mt-1 font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

/** REQ-042.1: mientras la ficha tenga permiso vigente y el turno esté activo. */
function WhatsappOptOut({
  ticket,
  token,
  onChanged,
}: {
  ticket: Ticket;
  token: string;
  onChanged: () => Promise<void>;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();
  const active = ["waiting", "called", "in_service"].includes(ticket.status);

  function optOut() {
    if (!window.confirm("¿Seguro que no quieres recibir avisos por WhatsApp?")) return;
    setError(null);
    startSaving(async () => {
      try {
        const r = await optOutWhatsapp(token);
        if (r.ok) setDone(true);
        else setError(r.error);
        await onChanged();
      } catch {
        setError("No se pudo guardar. Revisa tu conexión.");
      }
    });
  }

  if (done) {
    return (
      <p role="status" className="text-muted mt-2 text-sm">
        Listo, ya no te avisamos por WhatsApp.
      </p>
    );
  }
  if (!active || !ticket.whatsappConsent) return null;
  return (
    <div className="mt-2 text-sm">
      <button
        type="button"
        className="text-brand min-h-12 underline"
        onClick={optOut}
        disabled={saving}
      >
        No quiero avisos por WhatsApp
      </button>
      {error && (
        <p role="alert" className="text-danger font-medium">
          {error}
        </p>
      )}
    </div>
  );
}

function StatusCard({ ticket }: { ticket: Ticket }) {
  const e = ticket.estimate;
  switch (ticket.status) {
    case "waiting":
      return (
        <section
          aria-live="polite"
          className="bg-card border-line rounded-md border p-5 text-center"
        >
          {e ? (
            <>
              {/* NFR-008: tamaño según el ancho; "siguiente" no cabía en 36 px con zoom 200 % */}
              <p className="text-[clamp(1.5rem,9vw,2.25rem)] leading-tight font-bold [overflow-wrap:anywhere]">
                {e.position === 1 ? "Eres el siguiente" : `Eres el ${e.position}.º`}
              </p>
              <p className="text-muted mt-1">
                {e.ahead === 0
                  ? "Nadie delante"
                  : e.ahead === 1
                    ? "1 persona delante"
                    : `${e.ahead} personas delante`}
              </p>
              <p className="mt-3 text-2xl font-semibold">
                {e.waitMin === null
                  ? e.reason === "preferred_unavailable"
                    ? "Tu barbero está en pausa"
                    : e.reason === "no_capable"
                      ? "Esperando a que haya quién te atienda"
                      : "Sin barberos atendiendo ahora"
                  : formatMinutes(e.waitMin)}
              </p>
              {e.waitMin !== null && e.waitMin > 0 && (
                <p className="text-muted text-sm">tiempo estimado</p>
              )}
            </>
          ) : (
            <p className="text-2xl font-semibold">En la fila</p>
          )}
        </section>
      );
    case "called":
      return (
        <section
          aria-live="assertive"
          className="bg-called text-accent-ink rounded-md p-6 text-center"
        >
          <p className="text-3xl font-bold">¡Es tu turno!</p>
          <p className="mt-2 text-lg">
            Pasa a la silla de <strong>{ticket.assignedBarberName ?? "tu barbero"}</strong>
          </p>
          <p className="mt-2 text-sm">Tienes {ticket.business.graceMinutes} minutos para llegar.</p>
        </section>
      );
    case "in_service":
      return (
        <section className="bg-ok-soft rounded-md p-6 text-center">
          <p className="text-2xl font-bold">Te están atendiendo</p>
          <p className="text-muted mt-1">con {ticket.assignedBarberName}</p>
        </section>
      );
    case "done":
      return (
        <section className="bg-ok-soft rounded-md p-6 text-center">
          <p className="text-2xl font-bold">¡Gracias por venir!</p>
          <p className="text-muted mt-1">Te esperamos la próxima.</p>
          {ticket.googleReviewUrl && (
            <a
              href={ticket.googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-primary mt-4"
            >
              Déjanos tu reseña en Google
            </a>
          )}
        </section>
      );
    case "no_show":
      return (
        <section className="bg-warn-soft rounded-md p-6 text-center">
          <p className="text-2xl font-bold">Te llamamos y no estabas</p>
          <p className="text-muted mt-1">Puedes tomar un turno nuevo cuando llegues.</p>
        </section>
      );
    case "cancelled":
      return (
        <section className="bg-surface rounded-md p-6 text-center">
          <p className="text-2xl font-bold">Turno cancelado</p>
          <p className="text-muted mt-1">
            {ticket.cancelReason === "closing"
              ? "El negocio cerró hoy; vuelve a tomar turno mañana."
              : ticket.cancelReason === "customer"
                ? "Lo cancelaste tú."
                : ticket.cancelReason === "barber_removed"
                  ? "Tu barbero ya no atiende aquí."
                  : "El negocio canceló el turno."}
          </p>
        </section>
      );
  }
}
