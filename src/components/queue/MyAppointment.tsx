"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PublicHeader } from "@/components/public/PublicHeader";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { StatusChip } from "@/components/ui/StatusChip";
import { cancelAppointmentByToken } from "@/lib/actions/public-appointments";
import {
  APPOINTMENT_TOLERANCE_MIN,
  appointmentClock,
  appointmentDayTitle,
  appointmentStatusText,
} from "@/lib/domain/appointments";
import { formatCOP } from "@/lib/domain/money";
import type { PublicAppointment } from "@/lib/queue/appointments";

/**
 * REQ-051 y REQ-078.24 (tablero Cliente-Cita): "TU CITA", el día y la hora en grande y las filas
 * Barbero, Servicio y Dónde. Sin celular (REQ-051.6). "Cancelar la cita" abre la hoja de
 * confirmación (REQ-078.3). No se construye "Ya llegué" (REQ-052.2: lo marca el negocio).
 */
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
  const [confirming, setConfirming] = useState(false);
  const clock = appointmentClock(a.startsAt);

  function cancel() {
    setConfirming(false);
    setError(null);
    startTransition(async () => {
      const r = await cancelAppointmentByToken(token);
      if (!r.ok) setError(r.error);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <PublicHeader name={a.business.name} />
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-40">
        {alreadyHad && pendingAppt && (
          <p
            role="status"
            className="text-warn bg-warn-soft mx-4 mt-4 rounded-md p-3 text-sm font-medium"
          >
            Ya tienes una cita. Esta es.
          </p>
        )}

        <section aria-label="Tu cita" className="border-line border-b px-4 pt-6 pb-5">
          <p className="text-muted text-xs font-semibold tracking-wider uppercase">Tu cita</p>
          <p
            data-testid="appointment-day"
            className={`mt-1 text-[28px] leading-tight font-bold ${pendingAppt ? "" : "text-muted"}`}
          >
            {appointmentDayTitle(a.startsAt)}
          </p>
          <p
            data-testid="appointment-time"
            className={`leading-none font-bold tabular-nums ${pendingAppt ? "" : "text-muted line-through"}`}
          >
            <span className="text-[56px] tracking-tight">{clock.time}</span>{" "}
            <span className="text-2xl">{clock.period}</span>
          </p>
          {!pendingAppt && (
            <p className="mt-3" data-testid="appointment-status">
              <StatusChip
                status={a.status === "cancelled" ? "cancelled" : "no_show"}
                label={appointmentStatusText(a.status, a.lapsed)}
              />
            </p>
          )}
          {a.status === "cancelled" && a.cancelReason === "business" && (
            <p className="text-muted mt-2 text-sm">El negocio canceló la cita.</p>
          )}
        </section>

        <dl className="bg-card border-line border-b">
          <Row testId="row-barbero" label="Barbero">
            {a.barberName}
          </Row>
          <Row
            testId="row-servicio"
            label="Servicio"
            aside={<span className="text-muted tabular-nums">{formatCOP(a.price)}</span>}
          >
            {a.serviceName}
          </Row>
          {a.business.address && (
            <Row testId="row-donde" label="Dónde">
              <span className="font-normal">{a.business.address}</span>
            </Row>
          )}
        </dl>

        {pendingAppt && (
          <p className="text-muted px-4 pt-4 text-sm">
            Llega a tu hora: te esperamos hasta {APPOINTMENT_TOLERANCE_MIN} minutos.
          </p>
        )}

        {error && (
          <p role="alert" className="text-danger mx-4 mt-3 text-sm font-medium">
            {error}
          </p>
        )}
      </main>

      <div className="border-line bg-card fixed inset-x-0 bottom-0 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md flex-col items-stretch gap-1">
          {pendingAppt ? (
            <>
              <a href={`/c/${token}/calendario`} className="btn-primary" download>
                Agregar al calendario
              </a>
              <Button
                variant="text"
                className="text-danger mx-auto underline"
                onClick={() => setConfirming(true)}
                pending={pending}
                pendingText="Cancelando…"
              >
                Cancelar la cita
              </Button>
            </>
          ) : (
            <Link href={`/${a.business.slug}/cita`} className="btn-primary">
              Reservar otra
            </Link>
          )}
        </div>
      </div>

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="¿Seguro que quieres cancelar tu cita?"
        description="La hora queda libre para otra persona."
      >
        <Button variant="danger" className="w-full" onClick={cancel}>
          Sí, cancelar mi cita
        </Button>
        <Button variant="text" className="mx-auto" onClick={() => setConfirming(false)}>
          No, mantener la cita
        </Button>
      </Sheet>
    </div>
  );
}

function Row({
  testId,
  label,
  aside,
  children,
}: {
  testId: string;
  label: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      data-testid={testId}
      className="border-line flex min-h-14 items-center gap-3 border-b px-4 py-3 last:border-b-0"
    >
      <dt className="text-muted w-20 shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 font-semibold">{children}</dd>
      {aside}
    </div>
  );
}
