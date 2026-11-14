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
import {
  filterSales,
  saleBarber,
  saleFilterOptions,
  type SaleFilter,
} from "@/lib/domain/cash-sales";
import { formatCOP } from "@/lib/domain/money";
import { formatTimeBogota } from "@/lib/domain/time";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

/** Franja de la caja (tablero Dueno-Caja): transferencia y tarjeta van sumadas. */
const METHODS: {
  key: string;
  label: string;
  short?: string;
  amount: (s: CashDaySummary) => number;
}[] = [
  { key: "cash", label: "Efectivo", amount: (s) => s.byMethod.cash ?? 0 },
  { key: "nequi", label: "Nequi", amount: (s) => s.byMethod.nequi ?? 0 },
  { key: "daviplata", label: "Daviplata", amount: (s) => s.byMethod.daviplata ?? 0 },
  {
    key: "transfer-card",
    label: "Transferencia y tarjeta",
    short: "Transf. y tarjeta",
    amount: (s) => (s.byMethod.transfer ?? 0) + (s.byMethod.card ?? 0),
  },
];

/** Ventas que se ven de una vez en la tabla de escritorio ("Mostrando 10 de N · Ver más"). */
const PAGE = 10;

/**
 * REQ-027.1 Caja del día en vivo (se relee con cada venta, ADR-008) · REQ-026.1 anular con motivo ·
 * REQ-027.2–27.4 cierre, reapertura y compartir. Un día pasado se ve igual, sin "Nueva venta".
 * Disposición (tableros Dueno-Caja y Dueno-Caja-Movil, REQ-078.15): en el celular todo en una
 * columna con "Cerrar caja" y "Nueva venta" fijos abajo; en 768 px el resumen y los barberos a la
 * izquierda y las ventas a la derecha; desde 1024 px el resumen arriba en una franja, las ventas a
 * la izquierda y los barberos a la derecha, con las acciones junto al título. REQ-078.31: en
 * escritorio las ventas son una tabla con cabecera azul marino, buscador y filtros por barbero y
 * medio (en el navegador, `filterSales`), y "Por barbero" es una tabla Serv. · Comisión con Total.
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
  /** REQ-078.31 filtros de la tabla (en el navegador) y cuántas se ven en escritorio. */
  const [filter, setFilter] = useState<SaleFilter>({});
  const [limit, setLimit] = useState(PAGE);
  const options = saleFilterOptions(summary.sales);
  const shownSales = filterSales(summary.sales, filter);

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
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">{heading}</div>
        {open && (
          // Encima de la barra del menú en el celular (REQ-077.1); junto al título en escritorio
          <div className="bg-surface border-line fixed inset-x-0 bottom-[calc(3.5rem+1px+env(safe-area-inset-bottom))] z-10 border-t p-4 lg:static lg:ml-auto lg:border-0 lg:bg-transparent lg:p-0">
            <div className="mx-auto flex max-w-md flex-wrap gap-2 md:max-w-3xl md:justify-end lg:max-w-none">
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

      <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-[minmax(0,17rem)_minmax(0,1fr)] md:grid-rows-[auto_auto_1fr] md:[grid-template-areas:'sum_sales''bar_sales''ext_sales'] lg:grid-cols-[minmax(0,1fr)_22rem] lg:[grid-template-areas:'sum_sum''sales_bar''sales_ext']">
        <section
          aria-label="Totales por medio de pago"
          className="border-line bg-card rounded-md border md:[grid-area:sum] lg:flex"
        >
          <div className="p-4 lg:flex-[1.6]">
            <p className="text-muted text-sm font-semibold">
              Total del día
              <span className="lg:hidden">
                {" "}
                · {activeSales} {activeSales === 1 ? "venta" : "ventas"}
              </span>
            </p>
            <p
              className="text-[clamp(1.75rem,11vw,2.5rem)] leading-tight font-bold tabular-nums"
              data-testid="cash-total"
            >
              {formatCOP(summary.total)}
            </p>
            {summary.rewards > 0 && (
              <p className="text-muted text-sm">
                Premios de fidelidad {formatCOP(summary.rewards)}
              </p>
            )}
          </div>
          <dl className="divide-line border-line divide-y border-t lg:flex lg:flex-[5] lg:divide-x lg:divide-y-0 lg:border-t-0 lg:border-l">
            {METHODS.map((m) => (
              <div
                key={m.key}
                className="flex min-h-12 items-center justify-between gap-3 px-4 py-2 lg:flex-1 lg:flex-col lg:items-start lg:justify-center lg:gap-0"
              >
                <dt className="text-base lg:text-sm lg:font-semibold">
                  {m.short ? (
                    <>
                      <span className="md:hidden">{m.label}</span>
                      <span className="hidden md:inline">{m.short}</span>
                    </>
                  ) : (
                    m.label
                  )}
                </dt>
                <dd
                  className="font-semibold tabular-nums lg:text-xl"
                  data-testid={`method-${m.key}`}
                >
                  {formatCOP(m.amount(summary))}
                </dd>
              </div>
            ))}
            {/* De eso, lo que se vendió de la vitrina (no es un medio de pago) */}
            <div className="text-muted flex min-h-12 items-center justify-between gap-3 px-4 py-2 lg:flex-1 lg:flex-col lg:items-start lg:justify-center lg:gap-0">
              <dt className="text-base lg:text-sm lg:font-semibold">Vitrina</dt>
              <dd className="font-semibold tabular-nums lg:text-xl" data-testid="cash-products">
                {formatCOP(summary.products)}
              </dd>
            </div>
          </dl>
        </section>

        <section aria-label="Ventas del día" className="min-w-0 md:[grid-area:sales]">
          <div className="border-line bg-card rounded-md border">
            <h2 className="border-line flex items-baseline justify-between gap-3 border-b px-4 py-3 lg:hidden">
              <span className="font-bold">Ventas del día ({summary.sales.length})</span>
              {voidedSales > 0 && (
                <span className="text-muted text-sm">
                  {voidedSales} {voidedSales === 1 ? "anulada" : "anuladas"}
                </span>
              )}
            </h2>
            {summary.sales.length > 0 && (
              // REQ-078.31: buscador y filtros sobre las ventas ya cargadas, sin consultar de nuevo
              <div className="border-line hidden flex-wrap items-center gap-2 border-b p-3 md:flex">
                <input
                  type="search"
                  className="input w-auto! min-w-0 flex-[1_1_10rem]"
                  placeholder="Buscar cliente o concepto"
                  aria-label="Buscar cliente o concepto"
                  value={filter.query ?? ""}
                  onChange={(e) => setFilter({ ...filter, query: e.target.value })}
                />
                <select
                  className="input hidden h-12 w-auto! flex-none lg:block"
                  aria-label="Barbero"
                  value={filter.barber ?? ""}
                  onChange={(e) => setFilter({ ...filter, barber: e.target.value || undefined })}
                >
                  <option value="">Todos los barberos</option>
                  {options.barbers.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                <select
                  className="input desk:h-10 h-12 w-auto! flex-none"
                  aria-label="Medio de pago"
                  value={filter.method ?? ""}
                  onChange={(e) => setFilter({ ...filter, method: e.target.value || undefined })}
                >
                  <option value="">Todos los medios</option>
                  {options.methods.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                <p className="text-muted hidden text-sm whitespace-nowrap lg:block">
                  <strong className="text-ink tabular-nums">{activeSales}</strong>{" "}
                  {activeSales === 1 ? "venta" : "ventas"}
                  {voidedSales > 0 &&
                    ` · ${voidedSales} ${voidedSales === 1 ? "anulada" : "anuladas"}`}
                </p>
              </div>
            )}
            {summary.sales.length === 0 ? (
              <p className="text-muted px-4 py-6 text-base">
                Todavía no hay ventas. Los cobros de los barberos y las ventas nuevas salen aquí.
              </p>
            ) : shownSales.length === 0 ? (
              <p className="text-muted px-4 py-6 text-base">Ninguna venta coincide.</p>
            ) : (
              // Escritorio: tabla Hora · Concepto · Cliente · Barbero · Medio · Valor (tablero
              // Dueno-Caja). Celular y tablet: cada fila es la lista de siempre (una celda propia).
              <table className="w-full border-collapse text-left max-lg:block">
                <thead className="bg-brand text-brand-ink max-lg:hidden">
                  <tr className="text-sm">
                    <th className="px-4 py-2.5 font-semibold">Hora</th>
                    <th className="px-2 py-2.5 font-semibold">Concepto</th>
                    <th className="px-2 py-2.5 font-semibold">Cliente</th>
                    <th className="px-2 py-2.5 font-semibold">Barbero</th>
                    <th className="px-2 py-2.5 font-semibold">Medio</th>
                    <th className="px-2 py-2.5 text-right font-semibold">Valor</th>
                    <th className="w-24 px-4 py-2.5">
                      <span className="sr-only">Anular</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="max-lg:block">
                  {shownSales.map((s, i) => {
                    const voided = s.status === "voided";
                    const flash = fresh.has(s.id);
                    const concept = `${s.items}${s.staffBuyerName ? ` (compra de ${s.staffBuyerName})` : ""}`;
                    const voidButton = !voided && open && (
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
                    );
                    const cell = `px-2 py-2 align-middle max-lg:hidden ${voided ? "text-muted" : ""}`;
                    return (
                      <tr
                        key={s.id}
                        data-testid={`sale-${s.id}`}
                        className={`border-line border-b last:border-b-0 max-lg:block ${flash ? "lg:animate-flash" : ""} ${i >= limit ? "lg:hidden" : ""}`}
                      >
                        <td className={`${cell} pl-4 whitespace-nowrap tabular-nums`}>
                          {formatTimeBogota(new Date(s.at))}
                        </td>
                        <td className={cell}>
                          <span className={voided ? "line-through" : ""}>{concept}</span>
                          {voided && ` · anulada: ${s.voidedReason}`}
                        </td>
                        <td className={cell}>{s.customerName ?? "—"}</td>
                        <td className={cell}>{saleBarber(s) ?? "—"}</td>
                        <td className={cell}>{s.methods}</td>
                        <td
                          className={`${cell} text-right font-semibold whitespace-nowrap tabular-nums ${voided ? "line-through" : ""}`}
                        >
                          {formatCOP(s.total)}
                        </td>
                        <td className={`${cell} pr-4 text-right`}>{voidButton}</td>
                        <td className="block lg:hidden">
                          <FlashRow
                            flash={flash}
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
                              {voidButton}
                            </div>
                          </FlashRow>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {shownSales.length > PAGE && (
              <p className="border-line text-muted hidden items-center justify-between gap-3 border-t px-4 text-sm lg:flex">
                Mostrando {Math.min(limit, shownSales.length)} de {shownSales.length}
                {limit < shownSales.length && (
                  <button
                    type="button"
                    className="text-brand min-h-12 font-semibold underline underline-offset-4"
                    onClick={() => setLimit(limit + PAGE)}
                  >
                    Ver más
                  </button>
                )}
              </p>
            )}
          </div>
        </section>

        <section
          aria-label="Por barbero"
          className="border-line bg-card overflow-hidden rounded-md border md:[grid-area:bar]"
        >
          <h2 className="border-line flex flex-wrap items-center justify-between gap-x-3 border-b px-4 py-2">
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
            <table className="w-full border-collapse text-left">
              <thead className="bg-brand text-brand-ink text-sm">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Barbero</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Serv.</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Comisión</th>
                </tr>
              </thead>
              <tbody>
                {summary.barbers.map((b) => (
                  <tr key={b.barberId} className="border-line border-b align-top">
                    <td className="px-4 py-3">
                      <p className="font-semibold">{b.name}</p>
                      {/* En 768 px la columna es angosta: el detalle queda en el celular y escritorio */}
                      <p className="text-muted text-sm md:max-lg:hidden">
                        vendido {formatCOP(b.sold)} · negocio {formatCOP(b.business)}
                      </p>
                      {productSettlement(b) && (
                        <p className="text-muted text-sm" data-testid={`products-${b.barberId}`}>
                          {productSettlement(b)}
                        </p>
                      )}
                    </td>
                    <td className="px-2 py-3 text-right tabular-nums">{b.services}</td>
                    <td className="px-4 py-3 text-right font-semibold whitespace-nowrap tabular-nums">
                      {formatCOP(b.commission)}
                    </td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td className="px-4 py-3">Total</td>
                  <td className="px-2 py-3 text-right tabular-nums">
                    {summary.barbers.reduce((n, b) => n + b.services, 0)}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                    {formatCOP(summary.barbers.reduce((n, b) => n + b.commission, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          {summary.barbers.length > 0 && (
            <p className="border-line text-muted border-t px-4 py-3 text-sm">
              Comisión de servicios.
              {summary.productCommission > 0 &&
                ` La de productos va aparte: ${formatCOP(summary.productCommission)}.`}{" "}
              Cortes gratis: comisión sobre precio de lista.
            </p>
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
