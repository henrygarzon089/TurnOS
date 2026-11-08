import { GiftCardTotals } from "@/components/cash/GiftCardTotals";
import { MembershipTotals } from "@/components/cash/MembershipTotals";
import type { WeekSummary as Week } from "@/lib/actions/cash";
import { staffPurchasesLine } from "@/lib/domain/cash-closure";
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
    <div className="bg-card min-w-0 px-4 py-3" data-testid={testId}>
      <p className="text-muted text-sm">{label}</p>
      <p className="text-[28px] leading-tight font-bold tabular-nums">{value}</p>
      <p className="text-muted text-xs">vs. semana anterior: {change}</p>
    </div>
  );
}

/**
 * REQ-028.1–28.4 resumen semanal con ocupación y comparación con la semana anterior. Tablero
 * Dueno-Operacion (T-166): cifras en una franja, tabla por barbero desde 1024 px y lista "A pagar"
 * en el celular. "Marcar pagado" y "Descargar PDF" del tablero no existen en la app: no se pintan.
 */
export function WeekSummary({ current: w, previous: p }: { current: Week; previous: Week }) {
  return (
    <div className="mt-4 flex flex-col gap-4">
      <section
        aria-label="Resumen"
        className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-md border lg:grid-cols-4"
      >
        <Stat
          label="Vendido"
          value={formatCOP(w.sold)}
          change={variation(w.sold, p.sold)}
          testId="sold"
        />
        <Stat
          label="Servicios"
          value={String(w.services)}
          change={variation(w.services, p.services)}
          testId="services"
        />
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
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="bg-brand text-brand-ink rounded-md p-4" data-testid="occupancy">
          <p className="text-sm">Ocupación de sillas</p>
          <p className="text-[40px] leading-tight font-bold tabular-nums">{pct(w.occupancyPct)}</p>
          <p className="text-sm">
            {formatMinutesHours(w.busyMinutes)} en servicio de{" "}
            {formatMinutesHours(w.openMinutes * w.chairs)} de silla disponibles ({w.chairs} sillas)
            · semana anterior {pct(p.occupancyPct)}
          </p>
        </div>

        <section
          aria-label="Por día"
          className="border-line bg-card rounded-md border p-4 lg:col-span-2"
        >
          <h2 className="mb-2 font-bold">Ocupación por día</h2>
          <ul className="grid grid-cols-7 gap-1 text-center text-xs">
            {w.days.map((d) => (
              <li key={d.day} className="bg-surface rounded-xs px-0.5 py-2">
                <p className="font-bold">{WEEKDAYS[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</p>
                <p className="tabular-nums">{d.openMinutes ? pct(d.occupancyPct) : "cerrado"}</p>
              </li>
            ))}
          </ul>
          <p className="text-muted mt-2 text-xs">
            Del {formatDayCO(w.weekStart)} al {formatDayCO(w.weekEnd)}
          </p>
        </section>
      </div>

      <section
        aria-label="Por barbero"
        className="border-line bg-card overflow-hidden rounded-md border"
      >
        <h2 className="border-line border-b px-4 py-3 text-lg font-bold">Por barbero</h2>
        {w.barbers.length === 0 ? (
          <p className="text-muted px-4 py-6 text-center">
            Esta semana no hay servicios cobrados. Cuando los barberos cobren, aquí sale lo que hay
            que pagarle a cada uno.
          </p>
        ) : (
          <>
            {/* Escritorio: tabla como el tablero */}
            <table className="hidden w-full text-sm lg:table">
              <thead className="bg-brand text-brand-ink text-left text-xs">
                <tr>
                  <th className="px-4 py-2 font-bold">Barbero</th>
                  <th className="px-3 py-2 text-right font-bold">Ocupación</th>
                  <th className="px-3 py-2 text-right font-bold">Servicios</th>
                  <th className="px-3 py-2 text-right font-bold">Vendido</th>
                  <th className="px-3 py-2 text-right font-bold">Comisión serv.</th>
                  <th className="px-3 py-2 text-right font-bold">Productos</th>
                  <th className="px-4 py-2 text-right font-bold">A pagar</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y tabular-nums">
                {w.barbers.map((b) => (
                  <tr key={b.barberId}>
                    <td className="px-4 py-3 font-bold">{b.name}</td>
                    <td className="px-3 py-3 text-right">{pct(b.occupancyPct)}</td>
                    <td className="px-3 py-3 text-right">{b.services}</td>
                    <td className="px-3 py-3 text-right">{formatCOP(b.sold)}</td>
                    <td className="px-3 py-3 text-right">{formatCOP(b.commission)}</td>
                    <td className="px-3 py-3 text-right">{formatCOP(b.productCommission)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCOP(b.toPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Celular: "A pagar" */}
            <p className="bg-surface text-muted px-4 py-2 text-xs font-bold tracking-wide uppercase lg:hidden">
              A pagar
            </p>
            <ul className="divide-line divide-y lg:hidden">
              {w.barbers.map((b) => (
                <li key={b.barberId} className="flex items-start justify-between gap-3 px-4 py-3">
                  <div className="min-w-0 text-sm">
                    <p className="text-base font-bold">{b.name}</p>
                    <p className="text-muted">
                      {b.services} servicios · ocupación {pct(b.occupancyPct)} · vendido{" "}
                      {formatCOP(b.sold)} · comisión {formatCOP(b.commission)}
                    </p>
                    {b.productCommission > 0 && (
                      <p className="text-muted" data-testid={`week-products-${b.barberId}`}>
                        comisión de productos {formatCOP(b.productCommission)} · total a pagar{" "}
                        {formatCOP(b.toPay)}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 font-bold tabular-nums">{formatCOP(b.toPay)}</p>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      {staffPurchasesLine(w) && (
        <p className="border-line bg-card rounded-md border p-3 text-sm">{staffPurchasesLine(w)}</p>
      )}

      <p className="bg-warn-soft text-warn rounded-md p-3 text-sm font-semibold" data-testid="lost">
        {w.lostTickets} {w.lostTickets === 1 ? "turno perdido" : "turnos perdidos"} (no llegó o
        cancelado)
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        <MembershipTotals totals={w} />
        <GiftCardTotals totals={w} />
      </div>
    </div>
  );
}
