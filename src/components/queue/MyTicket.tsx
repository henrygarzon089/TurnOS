"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { StampCard } from "@/components/loyalty/StampCard";
import { ConnectionBanner, LastUpdated } from "@/components/ui/ConnectionBanner";
import { cancelTicketByToken, getTicketByToken } from "@/lib/actions/public";
import { formatMinutes } from "@/lib/domain/time";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";
import type { MyTicket as Ticket } from "@/lib/queue/public-queue";
import { writePrefs } from "@/lib/storage/customer-prefs";

const CACHE_KEY = (token: string) => `turnos:ticket:${token}`;

/**
 * REQ-004: "Mi turno" en vivo. REQ-005: cancelar. REQ-011.6: último estado conocido sin conexión.
 */
export function MyTicket({
  token,
  initial,
  alreadyHad,
}: {
  token: string;
  initial: Ticket;
  alreadyHad: boolean;
}) {
  const [ticket, setTicket] = useState<Ticket>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const prevStatus = useRef(initial.status);

  const reload = useCallback(async () => {
    const t = await getTicketByToken(token);
    if (t) setTicket(t);
  }, [token]);

  const { online, lastUpdated } = useQueueSubscription(ticket.business.id, reload);

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
    if (!window.confirm("¿Seguro que quieres cancelar tu turno?")) return;
    setError(null);
    startTransition(async () => {
      const r = await cancelTicketByToken(token);
      if (!r.ok) setError(r.error ?? "No se pudo cancelar.");
      await reload();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-28">
      <ConnectionBanner online={online} />
      <header className="py-5">
        <p className="text-muted text-sm">
          {ticket.business.name} · Turno {ticket.displayNumber}
        </p>
        <h1 className="text-2xl font-bold">Hola, {ticket.customerName.split(" ")[0]}</h1>
        {alreadyHad && ticket.status === "waiting" && (
          <p
            role="status"
            className="text-warn mt-2 rounded-xl bg-amber-50 p-3 text-sm font-medium"
          >
            Ya tienes un turno en la fila. Este es.
          </p>
        )}
      </header>

      <StatusCard ticket={ticket} />

      <section className="mt-4 text-sm">
        <p>
          <span className="text-muted">Servicio:</span> {ticket.serviceName} (
          {ticket.serviceDurationMin} min)
        </p>
        <p>
          <span className="text-muted">Barbero:</span>{" "}
          {ticket.assignedBarberName ?? ticket.preferredBarberName ?? "El que esté libre"}
        </p>
      </section>

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

      <div className="bg-surface fixed inset-x-0 bottom-0 p-4">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          {active ? (
            <button type="button" className="btn-danger" onClick={cancel} disabled={pending}>
              {pending ? "Cancelando…" : "Cancelar mi turno"}
            </button>
          ) : (
            <Link href={`/${ticket.business.slug}`} className="btn-primary">
              {ticket.status === "done" ? "Volver al inicio" : "Tomar un turno nuevo"}
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function StatusCard({ ticket }: { ticket: Ticket }) {
  const e = ticket.estimate;
  switch (ticket.status) {
    case "waiting":
      return (
        <section
          aria-live="polite"
          className="bg-card border-line rounded-2xl border p-5 text-center"
        >
          {e ? (
            <>
              <p className="text-4xl font-bold">
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
          className="bg-called rounded-2xl border-2 border-amber-400 p-6 text-center"
        >
          <p className="text-3xl font-bold">¡Es tu turno!</p>
          <p className="mt-2 text-lg">
            Pasa a la silla de <strong>{ticket.assignedBarberName ?? "tu barbero"}</strong>
          </p>
          <p className="text-muted mt-2 text-sm">
            Tienes {ticket.business.graceMinutes} minutos para llegar.
          </p>
        </section>
      );
    case "in_service":
      return (
        <section className="rounded-2xl bg-green-50 p-6 text-center">
          <p className="text-2xl font-bold">Te están atendiendo</p>
          <p className="text-muted mt-1">con {ticket.assignedBarberName}</p>
        </section>
      );
    case "done":
      return (
        <section className="rounded-2xl bg-green-50 p-6 text-center">
          <p className="text-2xl font-bold">¡Gracias por venir!</p>
          <p className="text-muted mt-1">Te esperamos la próxima.</p>
        </section>
      );
    case "no_show":
      return (
        <section className="rounded-2xl bg-amber-50 p-6 text-center">
          <p className="text-2xl font-bold">Te llamamos y no estabas</p>
          <p className="text-muted mt-1">Puedes tomar un turno nuevo cuando llegues.</p>
        </section>
      );
    case "cancelled":
      return (
        <section className="rounded-2xl bg-gray-100 p-6 text-center">
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
