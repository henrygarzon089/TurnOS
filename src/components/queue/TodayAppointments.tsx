import { appointmentTag } from "@/lib/domain/appointments";
import { formatTimeBogota } from "@/lib/domain/time";
import type { TodayAppointment } from "@/lib/actions/queue";

/**
 * REQ-052.1: citas pendientes de hoy con "Llegó". El barbero ve las suyas; el dueño, todas con el
 * barbero y el aviso de barbero en pausa o ausente (REQ-054.4).
 */
export function TodayAppointments({
  title,
  appointments,
  showBarber,
  disabled,
  onArrived,
}: {
  title: string;
  appointments: TodayAppointment[];
  showBarber: boolean;
  disabled: boolean;
  onArrived: (id: string) => void;
}) {
  if (appointments.length === 0) return null;
  return (
    <section aria-label={title} className="mb-4">
      <h2 className="text-muted text-xs font-semibold uppercase">
        {title} ({appointments.length})
      </h2>
      <ul className="mt-2 flex flex-col gap-2">
        {appointments.map((a) => (
          <li
            key={a.id}
            className={`bg-card rounded-md border p-3 ${a.barberUnavailable ? "border-warn" : "border-line"}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {formatTimeBogota(new Date(a.startsAt))} · {a.customerName}
                </p>
                <p className="text-muted text-sm">
                  {a.serviceName}
                  {showBarber ? ` · con ${a.barberName}` : ""}
                </p>
                {a.late && (
                  <p className="text-warn text-sm font-medium">
                    Perdió la hora: si llega, va al final de la fila
                  </p>
                )}
                {showBarber && a.barberUnavailable && (
                  <p className="text-warn text-sm font-medium">
                    {a.barberName} está en pausa o no vino
                  </p>
                )}
              </div>
              <button
                type="button"
                className="btn-secondary w-auto shrink-0 px-4"
                disabled={disabled}
                onClick={() => onArrived(a.id)}
                aria-label={`Llegó ${a.customerName}`}
              >
                Llegó
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** REQ-052.2: etiqueta del turno que viene de una cita a tiempo. */
export function AppointmentBadge({ scheduledAt }: { scheduledAt: string | null }) {
  if (!scheduledAt) return null;
  return (
    <span className="border-ink bg-card text-ink mt-0.5 mr-1 inline-block rounded-xs border px-2 py-0.5 text-xs font-semibold">
      {appointmentTag(scheduledAt)}
    </span>
  );
}
