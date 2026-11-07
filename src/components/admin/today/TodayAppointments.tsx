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

/** REQ-076.5 citas de hoy: cuántas quedan y las próximas 3 (hora, cliente, barbero, servicio). */
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
    <TodayCard title="Citas de hoy" link={{ href: "/admin/citas", label: "Agenda" }}>
      {!data ? (
        <TodayBlockError />
      ) : (
        <>
          <p className="text-muted px-4 pt-3 pb-2">
            {data.remaining === 0
              ? "No quedan citas hoy."
              : `${data.remaining} ${data.remaining === 1 ? "queda" : "quedan"} por llegar.`}
          </p>
          {data.next.length > 0 && (
            <ul>
              {data.next.map((a) => (
                <li
                  key={a.id}
                  className="border-line flex min-h-12 items-center gap-3 border-t px-4 py-2"
                >
                  <b className="w-20 shrink-0 tabular-nums">
                    {formatTimeBogota(new Date(a.startsAt))}
                  </b>
                  <span className="min-w-0 flex-1 truncate">
                    {a.customer} · {a.barber}
                    <span className="text-muted"> · {a.service}</span>
                  </span>
                  <span
                    className={`shrink-0 text-sm ${a.arrived ? "text-ok font-semibold" : "text-muted"}`}
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
