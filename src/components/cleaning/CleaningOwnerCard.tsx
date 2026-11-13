"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ackMissedClosing, type OwnerSummary } from "@/lib/actions/cleaning";
import { formatHour, KIND_LABEL } from "@/lib/domain/cleaning";
import { formatDayCO } from "@/lib/domain/time";

/**
 * REQ-062.1/062.3–062.5, REQ-064.4: la tarjeta "Limpieza" en el panel del dueño (/admin/fila).
 * Solo sale lo que pide atención; si no hay nada, una línea "Todo al día".
 */
export function CleaningOwnerCard({
  summary,
}: {
  summary: Extract<OwnerSummary, { enabled: true }>;
}) {
  const router = useRouter();
  const [acking, setAcking] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const nothing =
    !summary.openingPending &&
    summary.missedClosings.length === 0 &&
    !summary.deepPending &&
    summary.deepMissedWeeks.length === 0 &&
    summary.flagged.length === 0 &&
    summary.tasksDue.length === 0;

  async function ack(day: string) {
    setError(null);
    const res = await ackMissedClosing(day, note);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setAcking(null);
    setNote("");
    router.refresh();
  }

  return (
    <section aria-label="Limpieza" className="border-line bg-card mb-3 rounded-md border p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Limpieza</h2>
        <Link
          href="/admin/limpieza"
          className="text-brand min-h-12 px-2 py-2 text-sm font-semibold"
        >
          Abrir
        </Link>
      </div>
      {nothing && <p className="text-muted text-sm">Todo al día.</p>}
      <ul className="mt-1 space-y-2 text-sm">
        {summary.openingPending && <li className="text-warn font-semibold">Apertura pendiente</li>}
        {summary.missedClosings.map(({ day }) => (
          <li key={day}>
            <div className="flex items-center justify-between gap-2">
              <span className="text-warn font-semibold">
                Cierre sin registrar · {formatDayCO(day)}
              </span>
              {acking !== day && (
                <button type="button" className="btn-secondary px-3" onClick={() => setAcking(day)}>
                  Visto
                </button>
              )}
            </div>
            {acking === day && (
              <form
                className="mt-1 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void ack(day);
                }}
              >
                <input
                  className="input flex-1"
                  aria-label="Nota (opcional)"
                  placeholder="Nota (opcional)"
                  maxLength={200}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                <button type="submit" className="btn-primary px-3">
                  Marcar visto
                </button>
              </form>
            )}
          </li>
        ))}
        {summary.deepPending && <li>Profunda pendiente esta semana</li>}
        {summary.deepMissedWeeks.map((w) => (
          <li key={w} className="text-warn">
            Semana del {formatDayCO(w)}: sin profunda
          </li>
        ))}
        {summary.flagged.map((r) => (
          <li key={r.id}>
            <p>
              <span className="font-semibold">
                {KIND_LABEL[r.kind]} · {formatDayCO(r.day)}
              </span>{" "}
              · {r.doneBy} · {formatHour(r.at.slice(11, 16))}
              {!r.isComplete && <span className="text-warn"> · Incompleta</span>}
              {r.isLate && <span className="text-warn"> · Tarde</span>}
            </p>
            {r.notes.map((n) => (
              <p key={n.label} className="text-muted">
                {n.label}: {n.note}
              </p>
            ))}
          </li>
        ))}
        {summary.tasksDue.map((t) => (
          <li key={t.id} className={t.overdue ? "text-warn" : undefined}>
            {t.name}: {t.overdue ? "vencida" : `vence el ${formatDayCO(t.nextDue!)}`}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="text-danger mt-1 text-sm">
          {error}
        </p>
      )}
    </section>
  );
}
