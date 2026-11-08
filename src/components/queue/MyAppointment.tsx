"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { cancelAppointmentByToken } from "@/lib/actions/public-appointments";
import {
  APPOINTMENT_TOLERANCE_MIN,
  appointmentStatusText,
  formatAppointmentWhen,
} from "@/lib/domain/appointments";
import { formatCOP } from "@/lib/domain/money";
import type { PublicAppointment } from "@/lib/queue/appointments";

/** REQ-051: la cita reservada. Sin celular (REQ-051.6). */
export function MyAppointment({
  token,
  appointment: a,
  alreadyHad,
}: {
  token: string;
  appointment: PublicAppointment;
  alreadyHad: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const pendingAppt = a.status === "booked" && !a.lapsed;

  function cancel() {
    if (!window.confirm("¿Seguro que quieres cancelar tu cita?")) return;
    setError(null);
    startTransition(async () => {
      const r = await cancelAppointmentByToken(token);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 pb-44">
      <header className="py-5">
        <p className="text-muted text-sm">{a.business.name} · Mi cita</p>
        <h1 className="text-2xl font-bold">Hola, {a.customerName.split(" ")[0]}</h1>
        {alreadyHad && pendingAppt && (
          <p
            role="status"
            className="text-warn bg-warn-soft mt-2 rounded-md p-3 text-sm font-medium"
          >
            Ya tienes una cita. Esta es.
          </p>
        )}
      </header>

      <section
        aria-label="Estado de la cita"
        className={`rounded-md p-5 ${pendingAppt ? "bg-card border-brand border" : "bg-card border-line border"}`}
      >
        <p className="text-lg font-bold" data-testid="appointment-status">
          {appointmentStatusText(a.status, a.lapsed)}
        </p>
        <p className="mt-1 text-xl font-semibold first-letter:uppercase">
          {formatAppointmentWhen(a.startsAt)}
        </p>
        {pendingAppt && (
          <p className="text-muted mt-2 text-sm">
            Llega a tu hora: te esperamos hasta {APPOINTMENT_TOLERANCE_MIN} minutos.
          </p>
        )}
        {a.status === "cancelled" && a.cancelReason === "business" && (
          <p className="text-muted mt-2 text-sm">El negocio canceló la cita.</p>
        )}
      </section>

      <section className="mt-4 text-sm" aria-label="Tu cita">
        <p>
          <span className="text-muted">Servicio:</span> {a.serviceName} ({a.durationMin} min) ·{" "}
          {formatCOP(a.price)}
        </p>
        <p>
          <span className="text-muted">Barbero:</span> {a.barberName}
        </p>
        {a.business.address && (
          <p>
            <span className="text-muted">Dirección:</span> {a.business.address}
          </p>
        )}
      </section>

      {error && (
        <p role="alert" className="text-danger mt-3 text-sm font-medium">
          {error}
        </p>
      )}

      <div className="bg-surface fixed inset-x-0 bottom-0 p-4">
        <div className="mx-auto flex max-w-md flex-col gap-2">
          {pendingAppt ? (
            <>
              <a href={`/c/${token}/calendario`} className="btn-secondary" download>
                Agregar al calendario
              </a>
              <button type="button" className="btn-danger" onClick={cancel} disabled={pending}>
                {pending ? "Cancelando…" : "Cancelar mi cita"}
              </button>
            </>
          ) : (
            <Link href={`/${a.business.slug}/cita`} className="btn-primary">
              Reservar otra
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
