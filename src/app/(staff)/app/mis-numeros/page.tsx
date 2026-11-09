import type { Metadata } from "next";
import { Segmented } from "@/components/ui/Segmented";
import { getMyNumbers, type MyPeriod } from "@/lib/actions/cash";
import { formatCOP } from "@/lib/domain/money";
import { formatDayCO, formatTimeBogota } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mis números" };

const ROW = "flex min-h-14 items-center justify-between gap-3 px-4";
const LABEL = "text-muted px-4 pt-5 pb-2 text-xs font-semibold tracking-wide uppercase";

/**
 * REQ-078.16 un periodo como el tablero Barbero-Otros: la comisión en grande (servicios + productos,
 * REQ-069.5) y el desglose en filas de 56 px.
 */
function Period({
  p,
  title,
  pct,
  testId,
}: {
  p: MyPeriod;
  title: string;
  pct: number;
  testId: string;
}) {
  const t = p.totals;
  const b = p.breakdown;
  return (
    <section data-testid={testId} aria-label={title}>
      <div className="border-line border-b px-4 pt-5 pb-4">
        <p className="text-muted text-sm">{title}</p>
        <p
          data-testid={`${testId}-total`}
          className="text-[3.375rem] leading-none font-bold tracking-tight tabular-nums"
        >
          {formatCOP(t.total)}
        </p>
        <p className="text-muted mt-1 text-sm">
          de {formatCOP(t.sold)} en servicios · {pct} %
        </p>
      </div>
      <ul className="divide-line border-line divide-y border-b">
        <li className={ROW}>
          <span>Servicios</span>
          <span className="font-semibold tabular-nums">{t.services}</span>
        </li>
        <li className={ROW}>
          <span>Comisión de servicios</span>
          <span className="font-semibold tabular-nums" data-testid={`${testId}-services`}>
            {formatCOP(t.commission)}
          </span>
        </li>
        <li className={ROW}>
          <span>Cortes gratis dados</span>
          <span className="font-semibold tabular-nums">{b.rewards}</span>
        </li>
        <li className={ROW}>
          <span>Productos vendidos</span>
          <span className="font-semibold tabular-nums">
            {b.products.qty} ·{" "}
            <span data-testid={`${testId}-products`}>{formatCOP(t.productCommission)}</span>
          </span>
        </li>
        {p.staffPurchases > 0 && (
          <li className={ROW}>
            <span>Compras tuyas con descuento</span>
            <span className="text-danger font-semibold tabular-nums">
              − {formatCOP(p.staffPurchases)}
            </span>
          </li>
        )}
      </ul>
      {b.byService.length > 0 && (
        <>
          <h2 className={LABEL}>Por servicio</h2>
          <ul className="divide-line border-line divide-y border-y">
            {b.byService.map((s) => (
              <li key={s.name} className={ROW}>
                <span className="min-w-0 flex-1 truncate">{s.name}</span>
                <span className="text-muted w-8 text-right text-sm tabular-nums">{s.qty}</span>
                <span className="w-24 text-right font-semibold tabular-nums">
                  {formatCOP(s.amount)}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** REQ-025.5 / REQ-029.1: lo del barbero, hoy, semana y mes. Nunca totales del negocio. */
export default async function MyNumbersPage() {
  const n = await getMyNumbers();
  if (!n) {
    return (
      <main className="py-6">
        <h1 className="text-2xl font-bold">Mis números</h1>
        <p className="text-muted mt-2">Tu cuenta no tiene una silla asignada.</p>
      </main>
    );
  }
  const pct = n.commissionPct;
  return (
    <main className="-mx-4 flex flex-col pb-4">
      <h1 className="px-4 pt-4 pb-3 text-2xl font-bold">Mis números</h1>
      <Segmented
        label="Periodo"
        tabs={[
          {
            name: "Hoy",
            panel: <Period p={n.periods.today} title="Tu comisión hoy" pct={pct} testId="today" />,
          },
          {
            name: "Semana",
            panel: (
              <Period p={n.periods.week} title="Tu comisión de la semana" pct={pct} testId="week" />
            ),
          },
          {
            name: "Mes",
            panel: (
              <Period p={n.periods.month} title="Tu comisión del mes" pct={pct} testId="month" />
            ),
          },
        ]}
      />
      <section aria-label="Mis ventas">
        <h2 className={LABEL}>Ventas de la semana · desde el {formatDayCO(n.weekStart)}</h2>
        {n.detail.length === 0 ? (
          <p className="text-muted border-line border-y px-4 py-4 text-sm">
            Todavía no tienes ventas esta semana.
          </p>
        ) : (
          <ul className="divide-line border-line divide-y border-y">
            {n.detail.map((s) => {
              const voided = s.status === "voided";
              return (
                <li
                  key={s.id}
                  data-testid={`my-sale-${s.id}`}
                  className="flex min-h-14 items-start justify-between gap-3 px-4 py-3 text-sm"
                >
                  <div className={`min-w-0 ${voided ? "line-through" : ""}`}>
                    <p className="font-semibold">{s.items}</p>
                    <p className="text-muted text-xs">
                      {formatDayCO(s.business_day)} · {formatTimeBogota(new Date(s.created_at))}
                      {voided ? " · anulada" : ""}
                    </p>
                  </div>
                  <div className={`shrink-0 text-right ${voided ? "line-through" : ""}`}>
                    <p className="font-bold tabular-nums">
                      {formatCOP(s.commission_amount + s.product_commission_amount)}
                    </p>
                    {s.product_commission_amount > 0 && (
                      <p className="text-muted text-xs">
                        productos {formatCOP(s.product_commission_amount)}
                      </p>
                    )}
                    <p className="text-muted text-xs">de {formatCOP(s.total)}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
