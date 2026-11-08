"use client";

import { useState, useTransition } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { MoneyField } from "@/components/ui/MoneyField";
import { Sheet } from "@/components/ui/Sheet";
import { closeCashDay, reopenCashDay, type CashDaySummary } from "@/lib/actions/cash";
import { closureShareLink, type ClosureTotals } from "@/lib/domain/cash-closure";
import { formatCOP } from "@/lib/domain/money";
import { formatDayCO, formatTimeBogota } from "@/lib/domain/time";

type Act = (fn: () => Promise<{ ok: boolean; error?: string }>, done: () => void) => void;

function useAct(onChanged: () => Promise<void>) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const act: Act = (fn, done) => {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (!r.ok) {
        setError(r.error ?? "No se pudo guardar.");
        return;
      }
      done();
      await onChanged();
    });
  };
  return { error, setError, pending, act };
}

/** Diferencia del cierre en palabras (tablero Dueno-Caja-Movil): "Cuadra", "Faltan" o "Sobran". */
export function differenceLabel(diff: number): string {
  if (diff === 0) return "Cuadra";
  return diff < 0 ? `Faltan ${formatCOP(-diff)}` : `Sobran ${formatCOP(diff)}`;
}

/**
 * REQ-027.2 "Cerrar caja": hoja con el efectivo que debería haber, lo contado y la diferencia
 * siempre a la vista; se confirma ahí mismo (REQ-078.3). El botón vive en la barra de acciones.
 */
export function CloseCashButton({
  summary,
  onChanged,
}: {
  summary: CashDaySummary;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState<number | null>(null);
  const { error, setError, pending, act } = useAct(onChanged);
  const others = summary.total - summary.cashExpected;
  const diff = counted === null ? null : counted - summary.cashExpected;
  const sales = summary.sales.filter((s) => s.status === "active").length;

  function close() {
    setOpen(false);
    setCounted(null);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        className="btn-secondary lg:w-auto"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Cerrar caja
      </button>
      <Sheet
        open={open}
        onClose={close}
        title="Cerrar caja"
        description={`${formatDayCO(summary.day)} · ${sales} ${sales === 1 ? "venta" : "ventas"}`}
      >
        <dl className="divide-line border-line -mx-5 divide-y border-y">
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <dt>Efectivo que debería haber</dt>
            <dd className="font-bold tabular-nums" data-testid="close-expected">
              {formatCOP(summary.cashExpected)}
            </dd>
          </div>
          <div className="px-5 py-3">
            <MoneyField label="Efectivo contado" value={counted} onChange={setCounted} autoFocus />
          </div>
          <div
            className={`flex min-h-12 items-center justify-between gap-3 px-5 py-2 ${diff === null ? "" : diff === 0 ? "bg-ok-soft text-ok" : "bg-warn-soft text-warn"}`}
          >
            <dt className="font-bold" data-testid="close-difference">
              {diff === null ? "Escribe lo que contaste" : differenceLabel(diff)}
            </dt>
            {diff !== null && diff !== 0 && <dd className="text-sm">queda anotado</dd>}
          </div>
          <div className="flex items-center justify-between gap-3 px-5 py-3">
            <dt>Nequi, Daviplata, transferencia y tarjeta</dt>
            <dd className="tabular-nums">{formatCOP(others)}</dd>
          </div>
        </dl>
        <p className="text-muted text-base">
          Después de cerrar no se pueden registrar ni anular ventas de hoy. Solo tú puedes
          reabrirla, con un motivo.
        </p>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-col gap-2">
          <Button
            pending={pending}
            disabled={counted === null}
            onClick={() => act(() => closeCashDay(summary.day, counted ?? -1), close)}
          >
            Confirmar cierre
          </Button>
          <Button variant="secondary" onClick={close}>
            Todavía no
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/**
 * REQ-027.3 caja cerrada en modo lectura con "Reabrir" (contorno rojo, motivo en una hoja,
 * REQ-078.3) · REQ-027.4 / REQ-027.6 "Compartir por WhatsApp" con la liquidación.
 */
export function ClosureCard({
  summary,
  businessName,
  onChanged,
}: {
  summary: CashDaySummary;
  businessName: string;
  onChanged: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { error, setError, pending, act } = useAct(onChanged);
  const closure = summary.closure;
  if (!closure) return null;
  const totals = closure.totals as ClosureTotals;

  function close() {
    setOpen(false);
    setReason("");
    setError(null);
  }

  return (
    <section
      aria-label="Cierre de caja"
      className="border-line bg-card flex flex-col gap-3 rounded-md border p-4"
    >
      <div>
        <p className="text-lg font-bold">
          Caja cerrada a las {formatTimeBogota(new Date(closure.closedAt))}
        </p>
        <p className="text-muted text-base">
          Efectivo contado {formatCOP(closure.cashCounted)} · esperado{" "}
          {formatCOP(closure.cashExpected)} · diferencia{" "}
          <span
            className={`font-semibold ${closure.difference === 0 ? "text-ok" : "text-warn"}`}
            data-testid="closure-difference"
          >
            {formatCOP(closure.difference)}
          </span>
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <a
          className="btn-primary sm:w-auto"
          href={closureShareLink(businessName, totals, closure.cashCounted)}
          target="_blank"
          rel="noopener"
        >
          Compartir por WhatsApp
        </a>
        <button type="button" className="btn-danger sm:w-auto" onClick={() => setOpen(true)}>
          Reabrir
        </button>
      </div>
      <Sheet
        open={open}
        onClose={close}
        title="Reabrir caja"
        description="El cierre queda anulado con tu motivo y se puede volver a vender hoy."
      >
        <label className="flex flex-col gap-1 text-base font-medium">
          ¿Por qué reabres la caja?
          <input
            className="input"
            maxLength={120}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-col gap-2">
          <Button
            variant="danger"
            pending={pending}
            onClick={() => act(() => reopenCashDay(summary.day, reason), close)}
          >
            Reabrir caja
          </Button>
          <Button variant="secondary" onClick={close}>
            Todavía no
          </Button>
        </div>
      </Sheet>
    </section>
  );
}
