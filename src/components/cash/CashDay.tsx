"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { ClosureCard, CloseCashButton } from "@/components/cash/CloseCashSheet";
import { GiftCardTotals } from "@/components/cash/GiftCardTotals";
import { MembershipTotals } from "@/components/cash/MembershipTotals";
import { NewSaleButton } from "@/components/cash/NewSaleSheet";
import { Button } from "@/components/ui/Button";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { FlashRow } from "@/components/ui/FlashRow";
import { Sheet } from "@/components/ui/Sheet";
import { getCashDay, voidSale, type CashDaySummary } from "@/lib/actions/cash";
import { productSettlement, staffPurchasesLine } from "@/lib/domain/cash-closure";
import { formatCOP } from "@/lib/domain/money";
import { formatTimeBogota } from "@/lib/domain/time";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

const METHODS: { key: keyof CashDaySummary["byMethod"]; label: string }[] = [
  { key: "cash", label: "Efectivo" },
  { key: "nequi", label: "Nequi" },
  { key: "daviplata", label: "Daviplata" },
  { key: "transfer", label: "Transferencia" },
  { key: "card", label: "Tarjeta" },
];

/**
 * REQ-027.1 Caja del día en vivo (se relee con cada venta, ADR-008) · REQ-026.1 anular con motivo ·
 * REQ-027.2–27.4 cierre, reapertura y compartir. Un día pasado se ve igual, sin "Nueva venta".
 * Disposición (tableros Dueno-Caja y Dueno-Caja-Movil, REQ-078.15): en el celular todo en una
 * columna con "Cerrar caja" y "Nueva venta" fijos abajo; en 768 px el resumen y los barberos a la
 * izquierda y las ventas a la derecha; desde 1024 px el resumen arriba en una franja, las ventas a
 * la izquierda y los barberos a la derecha, con las acciones junto al título.
 */
export function CashDay({
  businessId,
  businessName,
  initial,
  isToday,
  heading,
}: {
  businessId: string;
  businessName: string;
  initial: CashDaySummary;
  isToday: boolean;
  /** Título y fecha de la página; las acciones van a su lado en escritorio. */
  heading: React.ReactNode;
}) {
  const [summary, setSummary] = useState(initial);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  /** REQ-078.12: ventas que ya estaban en pantalla; las demás entran resaltadas. */
  const known = useRef(new Set(initial.sales.map((s) => s.id)));
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set());

  const reload = useCallback(async () => {
    try {
      const s = await getCashDay(initial.day);
      if (!s) return;
      const arrived = s.sales.filter((x) => !known.current.has(x.id)).map((x) => x.id);
      for (const id of arrived) known.current.add(id);
      setSummary(s);
      if (arrived.length > 0) {
        setFresh(new Set(arrived));
        setTimeout(() => setFresh(new Set()), 1300); // el resaltado dura 1,2 s
      }
    } catch {
      // sin conexión: se conserva lo último (la franja avisa)
    }
  }, [initial.day]);
  const { online, lastUpdated } = useQueueSubscription(businessId, reload);
  const closed = !!summary.closure;
  const open = isToday && !closed;
  const activeSales = summary.sales.filter((s) => s.status === "active").length;
  const voidedSales = summary.sales.length - activeSales;

  function confirmVoid() {
    if (!voiding) return;
    setError(null);
    startTransition(async () => {
      const r = await voidSale(voiding, reason);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setVoiding(null);
      setReason("");
      await reload();
    });
  }

  return (
    <>
      <ConnectionBanner online={online} lastSeen={lastUpdated} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0">{heading}</div>
        {open && (
          // Encima de la barra del menú en el celular (REQ-077.1); junto al título en escritorio
          <div className="bg-surface border-line fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t p-4 lg:static lg:ml-auto lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-md gap-2 md:max-w-3xl md:justify-end lg:max-w-none">
              <CloseCashButton summary={summary} onChanged={reload} />
              <NewSaleButton
                className="btn-primary lg:w-auto"
                toast
                onSaved={() => void reload()}
              />
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:grid-rows-[auto_auto_1fr] md:[grid-template-areas:'sum_sales''bar_sales''ext_sales'] lg:grid-cols-[minmax(0,1fr)_20rem] lg:[grid-template-areas:'sum_sum''sales_bar''sales_ext']">
        <section
          aria-label="Totales por medio de pago"
          className="border-line bg-card rounded-md border md:[grid-area:sum] lg:flex"
        >
          <div className="p-4 lg:flex-[1.4]">
            <p className="text-muted text-sm font-semibold">
              Total del día · {activeSales} {activeSales === 1 ? "venta" : "ventas"}
            </p>
            <p
              className="text-[40px] leading-tight font-bold tabular-nums"
              data-testid="cash-total"
            >
              {formatCOP(summary.total)}
            </p>
            <p className="text-muted text-sm">
              Servicios {formatCOP(summary.services)} · Productos {formatCOP(summary.products)}
              {summary.rewards > 0 ? ` · Premios de fidelidad ${formatCOP(summary.rewards)}` : ""}
            </p>
          </div>
          <dl className="divide-line border-line divide-y border-t lg:flex lg:flex-[3] lg:divide-x lg:divide-y-0 lg:border-t-0 lg:border-l">
            {METHODS.map((m) => (
              <div
                key={m.key}
                className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 lg:flex-1 lg:flex-col lg:items-start lg:justify-center lg:gap-0"
              >
                <dt className="text-base lg:text-sm lg:font-semibold">{m.label}</dt>
                <dd
                  className="font-semibold tabular-nums lg:text-xl"
                  data-testid={`method-${m.key}`}
                >
                  {formatCOP(summary.byMethod[m.key] ?? 0)}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section aria-label="Ventas del día" className="md:[grid-area:sales]">
          <div className="border-line bg-card overflow-hidden rounded-md border">
            <h2 className="border-line flex items-baseline justify-between gap-3 border-b px-4 py-3">
              <span className="font-bold">Ventas del día ({summary.sales.length})</span>
              {voidedSales > 0 && (
                <span className="text-muted text-sm">
                  {voidedSales} {voidedSales === 1 ? "anulada" : "anuladas"}
                </span>
              )}
            </h2>
            {summary.sales.length === 0 ? (
              <p className="text-muted px-4 py-6 text-base">
                Todavía no hay ventas. Los cobros de los barberos y las ventas nuevas salen aquí.
              </p>
            ) : (
              <ul className="divide-line divide-y">
                {summary.sales.map((s) => {
                  const voided = s.status === "voided";
                  return (
                    <li key={s.id} data-testid={`sale-${s.id}`}>
                      <FlashRow
                        flash={fresh.has(s.id)}
                        className="flex items-start justify-between gap-3 px-4 py-3"
                      >
                        <div className={`min-w-0 ${voided ? "text-muted" : ""}`}>
                          <p
                            className={`font-semibold break-words ${voided ? "line-through" : ""}`}
                          >
                            {s.items}
                          </p>
                          <p className="text-muted text-sm">
                            {formatTimeBogota(new Date(s.at))}
                            {s.customerName ? ` · ${s.customerName}` : ""}
                            {s.barberName ? ` · ${s.barberName}` : ""}
                            {s.staffBuyerName ? ` · compra de ${s.staffBuyerName}` : ""} ·{" "}
                            {s.methods}
                          </p>
                          {voided && (
                            <p className="text-danger text-sm font-semibold">
                              Anulada: {s.voidedReason}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end">
                          <p
                            className={`font-bold tabular-nums ${voided ? "text-muted line-through" : ""}`}
                          >
                            {formatCOP(s.total)}
                          </p>
                          {!voided && open && (
                            <button
                              type="button"
                              className="text-danger -mr-1 min-h-12 px-1 text-base font-semibold underline underline-offset-4"
                              onClick={() => {
                                setVoiding(s.id);
                                setReason("");
                                setError(null);
                              }}
                            >
                              Anular
                            </button>
                          )}
                        </div>
                      </FlashRow>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <section
          aria-label="Por barbero"
          className="border-line bg-card overflow-hidden rounded-md border md:[grid-area:bar]"
        >
          <h2 className="border-line flex items-center justify-between gap-3 border-b px-4 py-2">
            <span className="font-bold">Por barbero</span>
            <Link
              href="/admin/semana"
              className="text-brand flex min-h-12 items-center text-sm font-semibold underline underline-offset-4"
            >
              Liquidación semanal
            </Link>
          </h2>
          {summary.barbers.length === 0 ? (
            <p className="text-muted px-4 py-3 text-base">Todavía no hay servicios cobrados hoy.</p>
          ) : (
            <ul className="divide-line divide-y">
              {summary.barbers.map((b) => (
                <li key={b.barberId} className="px-4 py-3 text-sm">
                  <p className="flex items-baseline justify-between gap-3 text-base">
                    <span className="font-semibold">{b.name}</span>
                    <span className="font-semibold tabular-nums">{formatCOP(b.commission)}</span>
                  </p>
                  <p className="text-muted">
                    {b.services} {b.services === 1 ? "servicio" : "servicios"} · vendido{" "}
                    {formatCOP(b.sold)} · comisión {formatCOP(b.commission)} · negocio{" "}
                    {formatCOP(b.business)}
                  </p>
                  {productSettlement(b) && (
                    <p className="text-muted" data-testid={`products-${b.barberId}`}>
                      {productSettlement(b)}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4 md:[grid-area:ext]">
          <MembershipTotals totals={summary} />
          <GiftCardTotals totals={summary} />
          {staffPurchasesLine(summary) && (
            <p
              className="border-line bg-card rounded-md border p-3 text-sm"
              data-testid="staff-purchases"
            >
              {staffPurchasesLine(summary)}
            </p>
          )}
          <ClosureCard summary={summary} businessName={businessName} onChanged={reload} />
        </div>
      </div>

      <Sheet
        open={voiding !== null}
        onClose={() => setVoiding(null)}
        title="Anular venta"
        description='La venta queda visible como anulada y sale de los totales y comisiones. Si era de un turno, el turno vuelve a "Cobro pendiente".'
      >
        <label className="flex flex-col gap-1 text-base font-medium">
          Motivo
          <input
            className="input"
            maxLength={120}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-col gap-2">
          <Button variant="danger" pending={pending} onClick={confirmVoid}>
            Anular venta
          </Button>
          <Button variant="secondary" onClick={() => setVoiding(null)}>
            No, dejarla
          </Button>
        </div>
      </Sheet>
    </>
  );
}
