import Link from "next/link";
import { EditCustomerSheet } from "@/components/customers/EditCustomerSheet";
import type { CustomerView } from "@/lib/actions/customers";
import { MONTH_NAMES } from "@/lib/domain/birthday";
import { formatCOP } from "@/lib/domain/money";
import { formatPhoneCO } from "@/lib/domain/phone";
import { formatDayCO } from "@/lib/domain/time";

const ROW = "flex min-h-14 items-center justify-between gap-3 px-4";
const LABEL = "text-muted px-4 pt-5 pb-2 text-xs font-semibold tracking-wide uppercase";

/**
 * T-171 detalle del cliente para el barbero, como el tablero Barbero-Otros (ADR-051, REQ-078.16):
 * datos en filas (fidelidad, cumpleaños, membresía), la nota para el próximo y los últimos cortes.
 */
export function BarberCustomerDetail({ view }: { view: CustomerView }) {
  const c = view.customer;
  const l = view.loyalty;
  const stamps = l?.enabled ? Math.min(l.stamps, l.required) : null;
  // REQ-018.4 todo su historial; los que no se terminaron dicen por qué
  const done = view.history;

  return (
    <main className="-mx-4 flex flex-col pb-4">
      <header className="border-line border-b px-4 pt-3 pb-4">
        <Link href="/app/clientes" className="text-brand inline-flex min-h-10 items-center text-sm">
          ‹ Clientes
        </Link>
        <h1 className="text-2xl font-bold">{c.name}</h1>
        <a href={`tel:${c.phone}`} className="text-muted text-sm">
          +57 {formatPhoneCO(c.phone)}
        </a>
      </header>

      <ul aria-label="Datos del cliente" className="divide-line border-line divide-y border-b">
        {l?.enabled && (
          <li className={ROW}>
            <span>Fidelidad</span>
            <span className="font-semibold tabular-nums">
              {l.available
                ? "Corte gratis listo"
                : `${stamps} de ${l.required} · faltan ${l.required - (stamps ?? 0)}`}
            </span>
          </li>
        )}
        <li className={ROW}>
          <span>Cumpleaños</span>
          <span className={c.birthdayDay ? "" : "text-muted"}>
            {c.birthdayDay && c.birthdayMonth
              ? `${c.birthdayDay} de ${MONTH_NAMES[c.birthdayMonth - 1].toLowerCase()}`
              : "Sin dato"}
          </span>
        </li>
        <li className={ROW}>
          <span>Membresía</span>
          <span className={view.membership ? "font-semibold" : "text-muted"}>
            {view.membership
              ? `Quedan ${view.membership.cutsLeft} de ${view.membership.cutsTotal} cortes`
              : "No tiene"}
          </span>
        </li>
      </ul>

      <h2 className={LABEL}>Nota para el próximo</h2>
      <div className="border-line flex items-start justify-between gap-3 border-y px-4 py-2">
        <p className={`py-2.5 ${c.notes ? "" : "text-muted"}`}>
          {c.notes || "Sin nota. Toca Editar para dejar una."}
        </p>
        <EditCustomerSheet view={view} />
      </div>

      <h2 className={LABEL}>Últimos cortes</h2>
      {done.length === 0 ? (
        <p className="text-muted border-line border-y px-4 py-4 text-sm">
          Todavía no tiene cortes.
        </p>
      ) : (
        <ul aria-label="Últimos cortes" className="divide-line border-line divide-y border-y">
          {done.map((r) => (
            <li key={r.id} className={`${ROW} text-sm`}>
              <span className="text-muted w-20 shrink-0">{formatDayCO(r.date)}</span>
              <span className="min-w-0 flex-1 truncate">
                {r.serviceName}
                {r.barberName ? ` · ${r.barberName}` : ""}
                {r.statusLabel !== "Terminado" && (
                  <span className="text-muted"> · {r.statusLabel}</span>
                )}
              </span>
              {r.amount != null && (
                <span className="shrink-0 tabular-nums">{formatCOP(r.amount)}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
