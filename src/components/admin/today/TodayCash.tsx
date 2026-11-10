import { getCashDay, type CashDaySummary } from "@/lib/actions/cash";
import { formatCOP } from "@/lib/domain/money";
import { lastWeekLabel, sameDayLastWeek } from "@/lib/domain/time";
import { cashMethodRows } from "@/lib/domain/today";
import { TodayBlockError } from "./TodayBlockError";
import { TodayCard } from "./TodayCard";

type Data = { today: CashDaySummary; lastWeek: CashDaySummary | null };

/** Las mismas cifras de la Caja de hoy (`cash_day_summary`) y el mismo día de la semana pasada. */
async function loadTodayCash(): Promise<Data | null> {
  const today = await getCashDay();
  if (!today) return null;
  const lastWeek = await getCashDay(sameDayLastWeek(today.day));
  return { today, lastWeek };
}

const SHOW = { all: "", wide: "max-lg:hidden", compact: "lg:hidden" } as const;

/**
 * REQ-076.4, REQ-078.28 caja de hoy como el tablero: total grande, el mismo día de la semana pasada
 * y los medios de pago (Transferencia y tarjeta sumadas; en el celular, también Daviplata), con
 * "De eso, vitrina" en texto suave.
 */
export async function TodayCash({
  load = loadTodayCash,
}: { load?: () => Promise<Data | null> } = {}) {
  let data: Data | null = null;
  try {
    data = await load();
  } catch {
    data = null;
  }
  if (!data) {
    return (
      <TodayCard title="Caja de hoy" link={{ href: "/admin/caja", label: "Ver caja" }}>
        <TodayBlockError />
      </TodayCard>
    );
  }
  const { today, lastWeek } = data;
  return (
    <TodayCard title="Caja de hoy" link={{ href: "/admin/caja", label: "Ver caja" }}>
      <div className="px-4 pt-4 pb-3">
        <p
          data-testid="today-total"
          className="text-[44px] leading-none font-bold tracking-tight tabular-nums"
        >
          {formatCOP(today.total)}
        </p>
        <p className="text-muted mt-2 text-sm">
          {lastWeekLabel(today.day)}:{" "}
          {lastWeek ? <b className="text-ink">{formatCOP(lastWeek.total)}</b> : "sin datos"}
        </p>
      </div>
      <dl>
        {cashMethodRows(today.byMethod).map((m) => (
          <div
            key={m.key}
            className={`border-line flex min-h-12 items-center justify-between border-t px-4 lg:min-h-10 ${SHOW[m.show]}`}
          >
            <dt>{m.label}</dt>
            <dd data-testid={`today-method-${m.key}`} className="tabular-nums">
              {formatCOP(m.amount)}
            </dd>
          </div>
        ))}
        <div className="border-line text-muted flex min-h-12 items-center justify-between border-t px-4 lg:min-h-10">
          <dt>De eso, vitrina</dt>
          <dd className="tabular-nums">{formatCOP(today.products)}</dd>
        </div>
      </dl>
    </TodayCard>
  );
}
