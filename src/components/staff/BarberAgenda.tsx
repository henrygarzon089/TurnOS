import { GroupLabel, Tag } from "@/components/admin/ModulePage";
import { EmptyState } from "@/components/ui/States";
import { barberAgendaGroups } from "@/lib/domain/appointments";
import { formatTimeBogota } from "@/lib/domain/time";

export type BarberAgendaItem = {
  id: string;
  day: string;
  startsAt: string;
  endsAt: string;
  customerName: string;
  serviceName: string;
  durationMin: number;
  late: boolean;
};

/**
 * REQ-099.2–099.6 "Mi agenda" del barbero (ADR-073, design §31.2): sus citas pendientes de hoy a
 * +7 por día, solo de lectura. Sin celular ni enlace de "Mi cita" (REQ-099.3).
 */
export function BarberAgenda({
  today,
  acceptsAppointments,
  items,
}: {
  today: string;
  acceptsAppointments: boolean;
  items: BarberAgendaItem[];
}) {
  const groups = barberAgendaGroups(items, today);
  return (
    <>
      {!acceptsAppointments && (
        <p className="bg-warn-soft mx-4 mt-2 rounded-sm px-3 py-2 text-sm">
          Hoy no recibes citas. El dueño lo activa en Citas.
        </p>
      )}
      {groups.length === 0 ? (
        <EmptyState
          icon="calendar"
          title="Sin citas"
          text="No tienes citas reservadas en los próximos días."
        />
      ) : (
        groups.map((g) => (
          <section key={g.day} aria-label={g.title} data-testid="agenda-day">
            <GroupLabel>
              {g.title} · {g.items.length}
            </GroupLabel>
            <ul>
              {g.items.map((a) => (
                <li
                  key={a.id}
                  data-testid="agenda-item"
                  className="border-line flex min-h-14 items-center gap-3 border-b px-4 py-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold tabular-nums">
                      {formatTimeBogota(new Date(a.startsAt))} –{" "}
                      {formatTimeBogota(new Date(a.endsAt))}
                    </p>
                    <p className="truncate">{a.customerName}</p>
                    <p className="text-muted truncate text-sm">
                      {a.serviceName} · {a.durationMin} min
                    </p>
                  </div>
                  {a.late && <Tag tone="warn">Atrasada</Tag>}
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
      <p className="text-muted px-4 pt-4 text-sm">
        Para cambiar o cancelar una cita, habla con el dueño.
      </p>
    </>
  );
}
