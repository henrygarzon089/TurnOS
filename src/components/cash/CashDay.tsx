"use client";

import { useCallback, useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { CloseCash } from "@/components/cash/CloseCashSheet";
import { NewSaleButton } from "@/components/cash/NewSaleSheet";
import { ConnectionBanner } from "@/components/ui/ConnectionBanner";
import { getCashDay, voidSale, type CashDaySummary } from "@/lib/actions/cash";
import { formatCOP } from "@/lib/domain/money";
import { formatTimeBogota } from "@/lib/domain/time";
import { useQueueSubscription } from "@/lib/realtime/use-queue-subscription";

const METHODS: { key: keyof CashDaySummary["byMethod"]; label: string }[] = [
  { key: "cash", label: "Efectivo" },
  { key: "nequi", label: "Nequi" },
  { key: "transfer", label: "Transferencia" },
  { key: "card", label: "Tarjeta" },
];

/**
 * REQ-027.1 Caja del día en vivo (se relee con cada venta, ADR-008) · REQ-026.1 anular con motivo ·
 * REQ-027.2–27.4 cierre, reapertura y compartir. Un día pasado se ve igual, sin "Nueva venta".
 */
export function CashDay({
  businessId,
  businessName,
  initial,
  isToday,
}: {
  businessId: string;
  businessName: string;
  initial: CashDaySummary;
  isToday: boolean;
}) {
  const [summary, setSummary] = useState(initial);
  const [voiding, setVoiding] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const reload = useCallback(async () => {
    try {
      const s = await getCashDay(initial.day);
      if (s) setSummary(s);
    } catch {
      // sin conexión: se conserva lo último (la franja avisa)
    }
  }, [initial.day]);
  const { online } = useQueueSubscription(businessId, reload);
  const closed = !!summary.closure;

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
    <div className="mt-4 flex flex-col gap-4">
      <ConnectionBanner online={online} />

      <section aria-label="Totales por medio de pago" className="grid grid-cols-2 gap-2">
        {METHODS.map((m) => (
          <div key={m.key} className="border-line bg-card rounded-xl border p-3">
            <p className="text-muted text-xs">{m.label}</p>
            <p className="text-lg font-bold" data-testid={`method-${m.key}`}>
              {formatCOP(summary.byMethod[m.key])}
            </p>
          </div>
        ))}
        <div className="bg-ink text-card col-span-2 rounded-xl p-3">
          <p className="text-xs opacity-80">Total vendido</p>
          <p className="text-2xl font-bold" data-testid="cash-total">
            {formatCOP(summary.total)}
          </p>
          <p className="text-xs opacity-80">
            Servicios {formatCOP(summary.services)} · Productos {formatCOP(summary.products)}
            {summary.rewards > 0 ? ` · Premios de fidelidad ${formatCOP(summary.rewards)}` : ""}
          </p>
        </div>
      </section>

      <section aria-label="Por barbero">
        <h2 className="mb-2 font-semibold">Por barbero</h2>
        {summary.barbers.length === 0 ? (
          <p className="text-muted text-sm">Todavía no hay servicios cobrados hoy.</p>
        ) : (
          <ul className="border-line bg-card divide-line divide-y rounded-xl border">
            {summary.barbers.map((b) => (
              <li key={b.barberId} className="px-4 py-3 text-sm">
                <p className="font-semibold">{b.name}</p>
                <p className="text-muted">
                  {b.services} {b.services === 1 ? "servicio" : "servicios"} · vendido{" "}
                  {formatCOP(b.sold)} · comisión {formatCOP(b.commission)} · negocio{" "}
                  {formatCOP(b.business)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {!closed && isToday && <NewSaleButton onSaved={() => void reload()} />}

      <section aria-label="Ventas del día">
        <h2 className="mb-2 font-semibold">Ventas del día ({summary.sales.length})</h2>
        {summary.sales.length === 0 ? (
          <p className="text-muted text-sm">Todavía no hay ventas.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {summary.sales.map((s) => {
              const voided = s.status === "voided";
              return (
                <li
                  key={s.id}
                  data-testid={`sale-${s.id}`}
                  className={`border-line bg-card rounded-xl border p-3 text-sm ${voided ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className={`min-w-0 ${voided ? "line-through" : ""}`}>
                      <p className="font-semibold">{s.items}</p>
                      <p className="text-muted text-xs">
                        {formatTimeBogota(new Date(s.at))}
                        {s.barberName ? ` · ${s.barberName}` : ""}
                        {s.customerName ? ` · ${s.customerName}` : ""} · {s.methods}
                      </p>
                    </div>
                    <p className={`shrink-0 font-bold ${voided ? "line-through" : ""}`}>
                      {formatCOP(s.total)}
                    </p>
                  </div>
                  {voided ? (
                    <p className="text-danger mt-1 text-xs font-semibold">
                      Anulada: {s.voidedReason}
                    </p>
                  ) : (
                    !closed &&
                    isToday && (
                      <button
                        type="button"
                        className="text-danger mt-1 min-h-10 text-xs font-semibold underline"
                        onClick={() => {
                          setVoiding(s.id);
                          setReason("");
                          setError(null);
                        }}
                      >
                        Anular
                      </button>
                    )
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <CloseCash summary={summary} businessName={businessName} onChanged={reload} />

      {voiding && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Anular venta"
          className="fixed inset-0 z-30 flex items-end bg-black/40"
        >
          <div className="bg-card flex w-full flex-col gap-3 rounded-t-2xl p-5">
            <p className="text-lg font-bold">Anular venta</p>
            <p className="text-sm">
              La venta queda visible como anulada y sale de los totales y comisiones. Si era de un
              turno, el turno vuelve a &quot;Cobro pendiente&quot;.
            </p>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Motivo
              <input
                className="input"
                maxLength={120}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setVoiding(null)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger flex-1"
                disabled={pending}
                onClick={confirmVoid}
              >
                {pending ? "Anulando…" : "Anular venta"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
