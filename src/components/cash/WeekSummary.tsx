import Link from "next/link";
import { GroupLabel } from "@/components/admin/ModulePage";
import { GiftCardTotals } from "@/components/cash/GiftCardTotals";
import { MembershipTotals } from "@/components/cash/MembershipTotals";
import { Icon } from "@/components/ui/Icon";
import type { WeekSummary as Week } from "@/lib/actions/cash";
import { staffPurchasesLine } from "@/lib/domain/cash-closure";
import { formatCOP } from "@/lib/domain/money";
import {
  formatMinutesHours,
  settlementRows,
  shiftWeek,
  variation,
  weekFigures,
  weekRangeLabel,
  weekRangeShort,
} from "@/lib/domain/week";

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
  change?: string;
  testId: string;
}) {
  return (
    <div className="bg-card min-w-0 px-4 py-3" data-testid={testId}>
      <p className="text-muted text-xs font-semibold">{label}</p>
      <p className="text-[28px] leading-tight font-bold tabular-nums">{value}</p>
      {change && <p className="text-muted text-xs">vs. semana anterior: {change}</p>}
    </div>
  );
}

const arrow =
  "border-line-strong text-ink inline-flex size-12 shrink-0 items-center justify-center rounded-md border";

/**
 * REQ-078.32 (T-180, design §22.8) Semana como el tablero Dueno-Operacion: rango con flechas;
 * franja Ingresos · Servicios · Comisiones · Queda al negocio; tabla Barbero · % · Servicios ·
 * Comisión serv. · Productos · Compras suyas · A pagar (en el celular, "A PAGAR"). Debajo, lo de
 * REQ-028: ocupación (total, por día y por barbero), clientes nuevos y que repiten, turnos perdidos.
 * "Marcar pagado" y "Descargar PDF" no existen en la app: no se pintan (ADR-053).
 */
export function WeekSummary({
  current: w,
  previous: p,
  pcts,
  purchases,
  thisWeek,
}: {
  current: Week;
  previous: Week;
  pcts: Record<string, number>;
  purchases: Record<string, number>;
  /** Lunes de la semana actual: no se navega al futuro. */
  thisWeek: string;
}) {
  const f = weekFigures(w);
  const fp = weekFigures(p);
  const rows = settlementRows(w, pcts, purchases);
  return (
    <div className="mt-4 flex flex-col gap-4">
      <section
        aria-label="Liquidación de la semana"
        className="border-line bg-card overflow-hidden rounded-md border"
      >
        <nav
          aria-label="Elegir semana"
          className="border-line flex items-center justify-between gap-2 border-b p-3 sm:justify-start"
        >
          <Link
            href={`/admin/semana?semana=${shiftWeek(w.weekStart, -1)}`}
            aria-label="Semana anterior"
            className={arrow}
          >
            <Icon name="back" />
          </Link>
          <p className="text-center text-lg font-bold" data-testid="week-label">
            <span className="hidden sm:inline">{weekRangeLabel(w.weekStart)}</span>
            <span className="sm:hidden">{weekRangeShort(w.weekStart)}</span>
          </p>
          {w.weekStart < thisWeek ? (
            <Link
              href={`/admin/semana?semana=${shiftWeek(w.weekStart, 1)}`}
              aria-label="Semana siguiente"
              className={arrow}
            >
              <Icon name="next" />
            </Link>
          ) : (
            <span className="size-12 shrink-0" aria-hidden />
          )}
        </nav>

        <div
          aria-label="Resumen"
          role="group"
          className="bg-line border-line grid grid-cols-2 gap-px border-b lg:grid-cols-4"
        >
          <div className="bg-card col-span-2 lg:col-span-1">
            <Stat
              label="Ingresos"
              value={formatCOP(f.income)}
              change={variation(f.income, fp.income)}
              testId="sold"
            />
          </div>
          <Stat
            label="Servicios"
            value={String(f.services)}
            change={variation(f.services, fp.services)}
            testId="services"
          />
          <Stat label="Comisiones" value={formatCOP(f.commissions)} testId="commissions" />
          <div className="bg-card col-span-2 lg:col-span-1">
            <Stat label="Queda al negocio" value={formatCOP(f.business)} testId="business" />
          </div>
        </div>

        {rows.length === 0 ? (
          <p className="text-muted px-4 py-6 text-center">
            Esta semana no hay servicios cobrados. Cuando los barberos cobren, aquí sale lo que hay
            que pagarle a cada uno.
          </p>
        ) : (
          <>
            {/* Escritorio: tabla como el tablero */}
            <table className="hidden w-full text-sm lg:table" aria-label="Por barbero">
              <thead className="bg-brand text-brand-ink text-xs">
                <tr>
                  <th className="px-4 py-2 text-left font-bold">Barbero</th>
                  <th className="px-3 py-2 text-right font-bold">%</th>
                  <th className="px-3 py-2 text-right font-bold">Servicios</th>
                  <th className="px-3 py-2 text-right font-bold">Comisión serv.</th>
                  <th className="px-3 py-2 text-right font-bold">Productos</th>
                  <th className="px-3 py-2 text-right font-bold">Compras suyas</th>
                  <th className="px-4 py-2 text-right font-bold">A pagar</th>
                </tr>
              </thead>
              <tbody className="divide-line divide-y tabular-nums">
                {rows.map((b) => (
                  <tr key={b.barberId} data-testid={`week-row-${b.barberId}`}>
                    <td className="px-4 py-3 font-bold">{b.name}</td>
                    <td className="px-3 py-3 text-right">{b.pct ?? "—"}</td>
                    <td className="px-3 py-3 text-right">{b.services}</td>
                    <td className="px-3 py-3 text-right">{formatCOP(b.commission)}</td>
                    <td className="px-3 py-3 text-right">{formatCOP(b.products)}</td>
                    <td className="text-muted px-3 py-3 text-right">{formatCOP(b.purchases)}</td>
                    <td className="px-4 py-3 text-right font-bold">{formatCOP(b.toPay)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.some((b) => b.purchases > 0) && (
              <p className="text-muted border-line hidden border-t px-4 py-2 text-xs lg:block">
                Las compras suyas se pagaron en la caja con descuento: no se restan de lo que hay
                que pagarle.
              </p>
            )}

            {/* Celular: "A PAGAR" por barbero */}
            <div className="lg:hidden">
              <GroupLabel>A pagar</GroupLabel>
              <ul className="divide-line divide-y">
                {rows.map((b) => (
                  <li
                    key={b.barberId}
                    className="flex items-start justify-between gap-3 px-4 py-3"
                    data-testid={`week-pay-${b.barberId}`}
                  >
                    <div className="min-w-0 text-sm">
                      <p className="text-base font-bold">{b.name}</p>
                      <p className="text-muted">
                        {b.services} serv.{b.pct !== null ? ` · ${b.pct} %` : ""}
                        {b.products > 0 ? ` · productos ${formatCOP(b.products)}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-bold tabular-nums">{formatCOP(b.toPay)}</p>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </section>

      {staffPurchasesLine(w) && (
        <p className="border-line bg-card rounded-md border p-3 text-sm lg:hidden">
          {staffPurchasesLine(w)}
        </p>
      )}

      {/* REQ-028: la ocupación y los clientes se conservan debajo */}
      <section aria-label="Ocupación" className="grid gap-4 lg:grid-cols-3">
        <div className="border-line bg-card rounded-md border p-4" data-testid="occupancy">
          <p className="text-muted text-sm font-semibold">Ocupación de sillas</p>
          <p className="text-[28px] leading-tight font-bold tabular-nums">{pct(w.occupancyPct)}</p>
          <p className="text-muted text-sm">
            {formatMinutesHours(w.busyMinutes)} en servicio de{" "}
            {formatMinutesHours(w.openMinutes * w.chairs)} de silla disponibles ({w.chairs} sillas)
            · semana anterior {pct(p.occupancyPct)}
          </p>
        </div>

        <div className="border-line bg-card rounded-md border p-4 lg:col-span-2">
          <h2 className="mb-2 font-bold">Ocupación por día</h2>
          <ul className="grid grid-cols-7 gap-1 text-center text-xs">
            {w.days.map((d) => (
              <li key={d.day} className="bg-surface rounded-xs px-0.5 py-2">
                <p className="font-bold">{WEEKDAYS[new Date(`${d.day}T12:00:00Z`).getUTCDay()]}</p>
                <p className="tabular-nums">{d.openMinutes ? pct(d.occupancyPct) : "cerrado"}</p>
              </li>
            ))}
          </ul>
          {w.barbers.length > 0 && (
            <p className="text-muted mt-2 text-xs" data-testid="occupancy-barbers">
              Por barbero: {w.barbers.map((b) => `${b.name} ${pct(b.occupancyPct)}`).join(" · ")}
            </p>
          )}
        </div>
      </section>

      <section
        aria-label="Clientes de la semana"
        className="border-line bg-line grid grid-cols-2 gap-px overflow-hidden rounded-md border"
      >
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
