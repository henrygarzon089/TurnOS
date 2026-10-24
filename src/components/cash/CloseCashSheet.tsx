"use client";

import { useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { closeCashDay, reopenCashDay, type CashDaySummary } from "@/lib/actions/cash";
import { closureShareLink, type ClosureTotals } from "@/lib/domain/cash-closure";
import { formatCOP, parseCOP } from "@/lib/domain/money";
import { formatTimeBogota } from "@/lib/domain/time";

/**
 * REQ-027.2 "Cerrar caja" (efectivo contado → diferencia → confirmar) · REQ-027.3 modo lectura y
 * "Reabrir" con motivo · REQ-027.4 / REQ-027.6 "Compartir por WhatsApp" con la liquidación.
 */
export function CloseCash({
  summary,
  businessName,
  onChanged,
}: {
  summary: CashDaySummary;
  businessName: string;
  onChanged: () => Promise<void>;
}) {
  const [mode, setMode] = useState<"idle" | "close" | "reopen">("idle");
  const [counted, setCounted] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const closure = summary.closure;
  const countedValue = parseCOP(counted);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar.");
        return;
      }
      setMode("idle");
      setCounted("");
      setReason("");
      await onChanged();
    });
  }

  if (closure) {
    const totals = closure.totals as ClosureTotals;
    return (
      <section
        aria-label="Cierre de caja"
        className="rounded-xl border-2 border-green-700 bg-green-50 p-4"
      >
        <p className="font-bold">
          Caja cerrada a las {formatTimeBogota(new Date(closure.closedAt))}
        </p>
        <p className="text-sm">
          Efectivo contado {formatCOP(closure.cashCounted)} · esperado{" "}
          {formatCOP(closure.cashExpected)} · diferencia{" "}
          <span className="font-semibold" data-testid="closure-difference">
            {formatCOP(closure.difference)}
          </span>
        </p>
        <a
          className="btn-primary mt-3"
          href={closureShareLink(businessName, totals, closure.cashCounted)}
          target="_blank"
          rel="noopener"
        >
          📲 Compartir por WhatsApp
        </a>
        {mode === "reopen" ? (
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm font-medium">
              ¿Por qué reabres la caja?
              <input
                className="input"
                maxLength={120}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            {error && <ErrorText>{error}</ErrorText>}
            <button
              type="button"
              className="btn-danger"
              disabled={pending}
              onClick={() => act(() => reopenCashDay(summary.day, reason))}
            >
              Reabrir caja
            </button>
          </div>
        ) : (
          <button type="button" className="btn-secondary mt-2" onClick={() => setMode("reopen")}>
            Reabrir
          </button>
        )}
      </section>
    );
  }

  return (
    <section aria-label="Cierre de caja">
      {mode === "close" ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Cerrar caja"
          className="fixed inset-0 z-30 flex items-end bg-black/40"
        >
          <div className="bg-card flex w-full flex-col gap-3 rounded-t-2xl p-5">
            <p className="text-lg font-bold">Cerrar caja</p>
            <p className="text-sm">
              Cuenta el efectivo de la caja. Al cerrar, no se pueden registrar ni anular ventas de
              hoy (el dueño puede reabrir con motivo).
            </p>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Efectivo contado
              <input
                className="input"
                inputMode="numeric"
                placeholder="0"
                value={counted}
                onChange={(e) => setCounted(e.target.value)}
                autoFocus
              />
            </label>
            <p className="text-sm">
              Esperado {formatCOP(summary.cashExpected)}
              {countedValue !== null && (
                <>
                  {" "}
                  · diferencia{" "}
                  <span className="font-semibold" data-testid="close-difference">
                    {formatCOP(countedValue - summary.cashExpected)}
                  </span>
                </>
              )}
            </p>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => setMode("idle")}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-primary flex-1"
                disabled={pending || countedValue === null}
                onClick={() => act(() => closeCashDay(summary.day, countedValue ?? -1))}
              >
                {pending ? "Cerrando…" : "Confirmar cierre"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button type="button" className="btn-primary" onClick={() => setMode("close")}>
          Cerrar caja
        </button>
      )}
    </section>
  );
}
