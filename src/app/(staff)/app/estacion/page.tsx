import type { Metadata } from "next";
import { getMyStation } from "@/lib/actions/inventory";
import { businessDayBogota, formatDayCO, formatTimeBogota } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mi estación" };

const COUNT_KIND_LABELS: Record<string, string> = {
  initial: "conteo inicial",
  weekly: "conteo semanal",
  closing: "cierre de estación",
};

const dayOf = (iso: string) => businessDayBogota(new Date(iso));

const ROW = "flex min-h-14 items-center justify-between gap-3 px-4 py-2";
const LABEL = "text-muted px-4 pt-5 pb-2 text-xs font-semibold tracking-wide uppercase";

/**
 * REQ-074.4 "Mi estación": dotación, stock, reposiciones y último conteo. Solo lectura, sin precios.
 * T-171 filas a todo el ancho como el tablero Barbero-Otros; la reposición es por envase vacío en la
 * caja (REQ-071.4).
 */
export default async function MyStationPage() {
  const s = await getMyStation();
  if (!s || s.status === null) {
    return (
      <main className="py-6">
        <h1 className="text-2xl font-bold">Mi estación</h1>
        <p className="text-muted mt-2">Tu cuenta no tiene una estación asignada.</p>
      </main>
    );
  }
  return (
    <main className="-mx-4 flex flex-col pb-4">
      <header className="border-line border-b px-4 pt-4 pb-3">
        <h1 className="text-2xl font-bold">Mi estación</h1>
        <p className="text-muted text-sm">
          Lo que tienes asignado.
          {s.status === "closing" && " Tu estación está por cerrar: entrega lo que tienes."}
        </p>
      </header>

      <section aria-label="Dotación">
        {s.items.length === 0 ? (
          <p className="text-muted px-4 py-4 text-sm">Todavía no tienes insumos asignados.</p>
        ) : (
          <ul className="divide-line border-line divide-y border-b">
            {s.items.map((i) => {
              const low = i.stock < i.allowance;
              return (
                <li key={i.itemId} className={`${ROW} ${low ? "bg-warn-soft" : ""}`}>
                  <span className="min-w-0">
                    <span className="block font-medium">{i.name}</span>
                    <span className={`block text-sm ${low ? "text-warn" : "text-muted"}`}>
                      {i.stock} de {i.allowance} {i.unitLabel}
                    </span>
                  </span>
                  {low && (
                    <span className="text-warn shrink-0 text-sm font-semibold">Por reponer</span>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-muted px-4 pt-3 text-sm">
          Cuando se te acabe algo, entrega el envase vacío en la caja. Te dan uno nuevo.
        </p>
      </section>

      <section aria-label="Reposiciones">
        <h2 className={LABEL}>Reposiciones · 30 días</h2>
        {s.refills.length === 0 ? (
          <p className="text-muted border-line border-y px-4 py-4 text-sm">
            Sin reposiciones en los últimos 30 días.
          </p>
        ) : (
          <ul className="divide-line border-line divide-y border-y text-sm">
            {s.refills.map((r, idx) => (
              <li key={`${r.at}-${idx}`} className={ROW}>
                <span>
                  {r.itemName} · {r.qty}
                </span>
                <span className="text-muted shrink-0">
                  {formatDayCO(dayOf(r.at))} · {formatTimeBogota(new Date(r.at))}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Último conteo">
        <h2 className={LABEL}>
          Último conteo
          {s.lastCount &&
            ` · ${formatDayCO(dayOf(s.lastCount.countedAt))} · ${
              COUNT_KIND_LABELS[s.lastCount.kind] ?? "conteo"
            }`}
        </h2>
        {!s.lastCount ? (
          <p className="text-muted border-line border-y px-4 py-4 text-sm">
            Todavía no te han contado la estación.
          </p>
        ) : (
          <ul className="divide-line border-line divide-y border-y text-sm">
            {s.lastCount.lines.map((l) => (
              <li key={l.itemId} className={`${ROW}`}>
                <span className="min-w-0">
                  <span className={`block font-medium ${l.alert ? "text-danger" : ""}`}>
                    {l.name}: {l.countedQty}
                  </span>
                  {l.realUse !== null && (
                    <span className={`block ${l.alert ? "text-danger" : "text-muted"}`}>
                      {l.services ?? 0} servicios · gastaste {l.realUse}
                      {l.measuring ? " · Midiendo" : ` · se esperaba ${l.expectedUse ?? 0}`}
                      {l.alert && " · Revisar con el dueño"}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
