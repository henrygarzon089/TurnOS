import type { Metadata } from "next";
import { getMyNumbers } from "@/lib/actions/cash";
import { formatCOP } from "@/lib/domain/money";
import { formatDayCO, formatTimeBogota } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mis números" };

function Card({
  title,
  t,
  testId,
}: {
  title: string;
  t: { services: number; sold: number; commission: number };
  testId: string;
}) {
  return (
    <div className="border-line bg-card rounded-xl border p-4" data-testid={testId}>
      <p className="text-muted text-xs font-semibold uppercase">{title}</p>
      <p className="mt-1 text-2xl font-bold">{formatCOP(t.commission)}</p>
      <p className="text-muted text-sm">
        mi comisión · {t.services} {t.services === 1 ? "servicio" : "servicios"} · vendido{" "}
        {formatCOP(t.sold)}
      </p>
    </div>
  );
}

/** REQ-025.5 / REQ-029.1: lo del barbero, hoy y esta semana. Nunca totales del negocio. */
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
  return (
    <main className="flex flex-col gap-4 py-6">
      <header>
        <h1 className="text-2xl font-bold">Mis números</h1>
        <p className="text-muted text-sm">
          {n.barberName} · tu comisión es {n.commissionPct} % de los servicios
        </p>
      </header>
      <div className="grid gap-3">
        <Card title="Hoy" t={n.today} testId="today" />
        <Card
          title={`Esta semana (desde el ${formatDayCO(n.weekStart)})`}
          t={n.week}
          testId="week"
        />
      </div>
      <section aria-label="Mis ventas">
        <h2 className="mb-2 font-semibold">Mis ventas de la semana</h2>
        {n.detail.length === 0 ? (
          <p className="text-muted text-sm">Todavía no tienes ventas esta semana.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {n.detail.map((s) => {
              const voided = s.status === "voided";
              return (
                <li
                  key={s.id}
                  data-testid={`my-sale-${s.id}`}
                  className={`border-line bg-card flex items-start justify-between gap-3 rounded-xl border p-3 text-sm ${voided ? "opacity-70" : ""}`}
                >
                  <div className={`min-w-0 ${voided ? "line-through" : ""}`}>
                    <p className="font-semibold">{s.items}</p>
                    <p className="text-muted text-xs">
                      {formatDayCO(s.business_day)} · {formatTimeBogota(new Date(s.created_at))}
                      {voided ? " · anulada" : ""}
                    </p>
                  </div>
                  <div className={`shrink-0 text-right ${voided ? "line-through" : ""}`}>
                    <p className="font-bold">{formatCOP(s.commission_amount)}</p>
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
