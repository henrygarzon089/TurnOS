import type { WeekSummary as Week } from "@/lib/actions/cash";
import { formatCOP } from "@/lib/domain/money";
import { formatDayCO } from "@/lib/domain/time";
import { formatMinutesHours, variation } from "@/lib/domain/week";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("es-CO")} %`);

function Stat({
  label,
  value,
  change,
  testId,
}: {
  label: string;
  value: string;
  change: string;
  testId: string;
}) {
  return (
    <div className="border-line bg-card rounded-xl border p-3" data-testid={testId}>
      <p className="text-muted text-xs">{label}</p>
      <p className="text-xl font-bold">{value}</p>
      <p className="text-muted text-xs">vs. semana anterior: {change}</p>
    </div>
  );
}

/** REQ-028.1–28.4 resumen semanal con ocupación y comparación con la semana anterior. */
export function WeekSummary({ current: w, previous: p }: { current: Week; previous: Week }) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <section aria-label="Resumen" className="grid grid-cols-2 gap-2">
        <Stat
          label="Clientes nuevos"
          value={String(w.newCustomers)}
          change={variation(w.newCustomers, p.newCustomers)}
          testId="new"
        />
        <Stat
          label="Clientes que repiten"
          value={String(w.repeatCustomers)}
          change={variation(w.repeatCustomers, p.repeatCustomers)}
          testId="repeat"
        />
        <Stat
          label="Servicios"
          value={String(w.services)}
          change={variation(w.services, p.services)}
          testId="services"
        />
        <Stat
          label="Vendido"
          value={formatCOP(w.sold)}
          change={variation(w.sold, p.sold)}
          testId="sold"
        />
        <div className="bg-ink text-card col-span-2 rounded-xl p-3" data-testid="occupancy">
          <p className="text-xs opacity-80">Ocupación de sillas</p>
          <p className="text-2xl font-bold">{pct(w.occupancyPct)}</p>
          <p className="text-xs opacity-80">
            {formatMinutesHours(w.busyMinutes)} en servicio de{" "}
            {formatMinutesHours(w.openMinutes * w.chairs)} de silla disponibles ({w.chairs} sillas)
            · semana anterior {pct(p.occupancyPct)}
          </p>
        </div>
      </section>

      <p className="rounded-xl bg-amber-50 p-3 text-sm font-semibold" data-testid="lost">
        {w.lostTickets} {w.lostTickets === 1 ? "turno perdido" : "turnos perdidos"} (no llegó o
        cancelado)
      </p>

      <section aria-label="Por barbero">
        <h2 className="mb-2 font-semibold">Por barbero</h2>
        <ul className="border-line bg-card divide-line divide-y rounded-xl border">
          {w.barbers.map((b) => (
            <li key={b.barberId} className="px-4 py-3 text-sm">
              <p className="font-semibold">
                {b.name} · ocupación {pct(b.occupancyPct)}
              </p>
              <p className="text-muted">
                {b.services} servicios · vendido {formatCOP(b.sold)} · comisión{" "}
                {formatCOP(b.commission)}
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Por día">
        <h2 className="mb-2 font-semibold">Ocupación por día</h2>
        <ul className="grid grid-cols-7 gap-1 text-center text-xs">
          {w.days.map((d) => (
            <li key={d.day} className="border-line bg-card rounded-lg border p-1">
              <p className="font-semibold">
                {WEEKDAYS[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}
              </p>
              <p>{d.openMinutes ? pct(d.occupancyPct) : "cerrado"}</p>
            </li>
          ))}
        </ul>
        <p className="text-muted mt-1 text-xs">
          Del {formatDayCO(w.weekStart)} al {formatDayCO(w.weekEnd)}
        </p>
      </section>
    </div>
  );
}
