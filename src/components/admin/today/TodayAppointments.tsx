import { getAppointmentAgenda, getAppointmentSettings } from "@/lib/actions/appointments";
import { todayAppointments, type TodayAppointments as Data } from "@/lib/domain/owner-alerts";
import { formatTimeBogota } from "@/lib/domain/time";
import { TodayBlockError } from "./TodayBlockError";
import { TodayCard } from "./TodayCard";

/** "off" = módulo de citas apagado: el bloque no aparece (REQ-076.5). */
async function loadTodayAppointments(): Promise<Data | "off"> {
  const settings = await getAppointmentSettings();
  if (!settings) throw new Error("sin sesión");
  if (!settings.enabled) return "off";
  const agenda = await getAppointmentAgenda();
  if (!agenda) throw new Error("sin agenda");
  return todayAppointments(agenda.items, agenda.today, new Date());
}

/**
 * REQ-076.5 citas de hoy: cuántas quedan (junto al título) y las próximas 3 como el tablero: hora,
 * cliente · barbero (servicio en suave) y "Llegó" en negrita o "Pendiente" en suave. "Atendido" no
 * se construye: la cita no sabe si el turno terminó (ADR-053).
 */
export async function TodayAppointments({
  load = loadTodayAppointments,
}: { load?: () => Promise<Data | "off"> } = {}) {
  let data: Data | "off" | null = null;
  try {
    data = await load();
  } catch {
    data = null;
  }
  if (data === "off") return null;
  return (
    <TodayCard
      title="Citas de hoy"
      link={{ href: "/admin/citas", label: "Agenda" }}
      aside={
        // Cuántas quedan (REQ-076.5); si no se ve ninguna cita, lo dice el cuerpo del bloque
        data &&
        (data.remaining > 0 || data.next.length > 0) && (
          <p className="text-muted text-sm">
            {data.remaining === 0
              ? "No quedan por llegar"
              : `${data.remaining} ${data.remaining === 1 ? "queda" : "quedan"}`}
          </p>
        )
      }
    >
      {!data ? (
        <TodayBlockError />
      ) : (
        <>
          {data.next.length === 0 ? (
            <p className="text-muted px-4 py-4">No quedan citas hoy.</p>
          ) : (
            <ul>
              {data.next.map((a) => (
                <li
                  key={a.id}
                  className="border-line flex min-h-13 items-center gap-3 border-t px-4 py-2 first:border-t-0"
                >
                  <b className="w-20 shrink-0 tabular-nums">
                    {formatTimeBogota(new Date(a.startsAt))}
                  </b>
                  <span className="min-w-0 flex-1 truncate">
                    {a.customer} · {a.barber}
                    <span className="text-muted"> · {a.service}</span>
                  </span>
                  <span
                    className={`shrink-0 text-sm ${a.arrived ? "text-ink font-bold" : "text-muted"}`}
                  >
                    {a.arrived ? "Llegó" : "Pendiente"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </TodayCard>
  );
}
