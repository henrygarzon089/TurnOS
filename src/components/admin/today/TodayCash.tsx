import { getCashDay, type CashDaySummary } from "@/lib/actions/cash";
import { formatCOP } from "@/lib/domain/money";
import { lastWeekLabel, sameDayLastWeek } from "@/lib/domain/time";
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

const METHODS: { key: keyof CashDaySummary["byMethod"]; label: string }[] = [
  { key: "cash", label: "Efectivo" },
  { key: "nequi", label: "Nequi" },
  { key: "daviplata", label: "Daviplata" },
  { key: "transfer", label: "Transferencia" },
  { key: "card", label: "Tarjeta" },
];

/** REQ-076.4 caja de hoy: total, por medio de pago, vitrina y servicios terminados. */
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
  const services = today.barbers.reduce((n, b) => n + b.services, 0);
  return (
    <TodayCard title="Caja de hoy" link={{ href: "/admin/caja", label: "Ver caja" }}>
      <div className="px-4 pt-3 pb-3">
        <p data-testid="today-total" className="text-4xl font-bold tabular-nums">
          {formatCOP(today.total)}
        </p>
        <p className="text-muted mt-1 text-sm">
          {lastWeekLabel(today.day)}:{" "}
          {lastWeek ? <b className="text-ink">{formatCOP(lastWeek.total)}</b> : "sin datos"}
        </p>
        <p className="text-muted mt-1 text-sm">
          {services} {services === 1 ? "servicio terminado" : "servicios terminados"}
        </p>
      </div>
      <dl>
        {METHODS.map((m) => (
          <div
            key={m.key}
            className="border-line flex min-h-12 items-center justify-between border-t px-4"
          >
            <dt>{m.label}</dt>
            <dd data-testid={`today-method-${m.key}`} className="tabular-nums">
              {formatCOP(today.byMethod[m.key] ?? 0)}
            </dd>
          </div>
        ))}
        <div className="border-line text-muted flex min-h-12 items-center justify-between border-t px-4">
          <dt>De eso, vitrina</dt>
          <dd className="tabular-nums">{formatCOP(today.products)}</dd>
        </div>
      </dl>
    </TodayCard>
  );
}
