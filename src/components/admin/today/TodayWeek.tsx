import { getWeekDailyTotals } from "@/lib/actions/cash";
import { formatCOP } from "@/lib/domain/money";
import { barAmount, buildWeekBars } from "@/lib/domain/today";
import { TodayBlockError } from "./TodayBlockError";
import { TodayCard } from "./TodayCard";

type Data = { weekStart: string; today: string; totals: Record<string, number> };

/**
 * REQ-076.9 ingresos de la semana por día, solo desde 1024 px (la página lo oculta en el celular).
 * Cada barra es el total de la Caja de ese día; la suma es el "Vendido" de Semana (ADR-048). Hoy
 * va en azul marino; los días que no han llegado, con una raya.
 */
export async function TodayWeek({
  load = getWeekDailyTotals,
}: { load?: () => Promise<Data | null> } = {}) {
  let data: Data | null = null;
  try {
    data = await load();
  } catch {
    data = null;
  }
  return (
    <TodayCard title="Ingresos de la semana">
      {!data ? (
        <TodayBlockError />
      ) : (
        <WeekBars {...buildWeekBars(data.totals, data.weekStart, data.today)} />
      )}
    </TodayCard>
  );
}

function WeekBars({ bars, sum, max }: ReturnType<typeof buildWeekBars>) {
  return (
    // @container: con la tarjeta angosta (4 columnas, citas encendidas) las cifras van en miles
    <div className="@container px-4 pt-3 pb-4">
      <p className="text-muted">
        <b className="text-ink tabular-nums" data-testid="today-week-sum">
          {formatCOP(sum)}
        </b>{" "}
        hasta hoy
        <span className="text-xs @sm:hidden"> · Cifras en miles</span>
      </p>
      <ol className="mt-3 grid h-40 grid-cols-7 items-end gap-2">
        {bars.map((b) => (
          <li
            key={b.day}
            data-testid={`today-week-${b.day}`}
            data-total={b.total ?? undefined}
            data-today={b.isToday || undefined}
            className="flex h-full flex-col items-center justify-end gap-1"
          >
            {/* Cifra y barra en su propia caja: la barra más alta usa el 85 %, la cifra va encima */}
            <div className="flex w-full flex-1 flex-col items-center justify-end gap-1">
              <span
                className={`text-xs whitespace-nowrap tabular-nums ${b.isToday ? "font-bold" : "text-muted"}`}
              >
                {b.total === null ? "—" : <Amount {...barAmount(b.total)} />}
              </span>
              <span
                aria-hidden="true"
                className={`w-full rounded-t-xs ${b.isToday ? "bg-brand" : "bg-line"}`}
                style={{
                  height: b.total && max ? `${Math.max(3, (b.total / max) * 85)}%` : "2px",
                }}
              />
            </div>
            <span className={`text-xs ${b.isToday ? "font-bold" : "text-muted"}`}>{b.label}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Amount({ value, mil }: { value: string; mil: boolean }) {
  return (
    <>
      {value}
      {mil && <span className="hidden @sm:inline"> mil</span>}
    </>
  );
}
