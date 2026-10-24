import type { HistoryRow } from "@/lib/domain/customer-history";
import { formatCOP } from "@/lib/domain/money";
import { formatDayCO } from "@/lib/domain/time";

const STATUS_STYLE: Record<string, string> = {
  Terminado: "text-ok",
  "No llegó": "text-danger",
  Cancelado: "text-muted",
  "En la fila": "text-accent",
};

/** REQ-018.2 historial: fecha, servicio, barbero, valor, medio de pago (H3) y estado. */
export function CustomerHistory({ rows }: { rows: HistoryRow[] }) {
  if (rows.length === 0) {
    return <p className="text-muted text-sm">Todavía no tiene turnos.</p>;
  }
  return (
    <ul
      aria-label="Historial"
      className="border-line bg-card divide-line divide-y rounded-xl border"
    >
      {rows.map((r) => (
        <li key={r.id} className="flex items-start justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <p className="font-medium">
              {r.serviceName}
              {r.barberName ? (
                <span className="text-muted font-normal"> · {r.barberName}</span>
              ) : null}
            </p>
            <p className="text-muted text-xs">
              {formatDayCO(r.date)}
              {r.paymentMethod ? ` · ${r.paymentMethod}` : ""}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {r.amount !== null && <p className="font-semibold">{formatCOP(r.amount)}</p>}
            <p className={`text-xs font-semibold ${STATUS_STYLE[r.statusLabel] ?? ""}`}>
              {r.statusLabel}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
