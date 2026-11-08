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

/** REQ-074.4 "Mi estación": dotación, stock, reposiciones y último conteo. Solo lectura, sin precios. */
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
    <main className="flex flex-col gap-5 py-6">
      <header>
        <h1 className="text-2xl font-bold">Mi estación</h1>
        <p className="text-muted text-sm">
          Lo que te entregó la barbería. Para reponer, lleva el envase vacío.
          {s.status === "closing" && " Tu estación está por cerrar: entrega lo que tienes."}
        </p>
      </header>

      <section aria-labelledby="station-items">
        <h2 id="station-items" className="mb-2 font-semibold">
          Dotación
        </h2>
        {s.items.length === 0 ? (
          <p className="text-muted text-sm">Todavía no tienes insumos asignados.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {s.items.map((i) => (
              <li
                key={i.itemId}
                className="border-line bg-card flex min-h-12 items-center justify-between gap-3 rounded-md border px-4 py-2 text-sm"
              >
                <span className="font-semibold">{i.name}</span>
                <span
                  className={`shrink-0 tabular-nums ${i.stock < i.allowance ? "text-danger" : "text-muted"}`}
                >
                  {i.stock} de {i.allowance} {i.unitLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="station-refills">
        <h2 id="station-refills" className="mb-2 font-semibold">
          Reposiciones (30 días)
        </h2>
        {s.refills.length === 0 ? (
          <p className="text-muted text-sm">Sin reposiciones en los últimos 30 días.</p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm">
            {s.refills.map((r, idx) => (
              <li key={`${r.at}-${idx}`} className="flex justify-between gap-3">
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

      <section aria-labelledby="station-count">
        <h2 id="station-count" className="mb-2 font-semibold">
          Último conteo
        </h2>
        {!s.lastCount ? (
          <p className="text-muted text-sm">Todavía no te han contado la estación.</p>
        ) : (
          <>
            <p className="text-muted text-sm">
              {formatDayCO(dayOf(s.lastCount.countedAt))} ·{" "}
              {COUNT_KIND_LABELS[s.lastCount.kind] ?? "conteo"}
            </p>
            <ul className="mt-2 flex flex-col gap-2">
              {s.lastCount.lines.map((l) => (
                <li
                  key={l.itemId}
                  className={`rounded-md border p-3 text-sm ${l.alert ? "border-danger text-danger" : "border-line bg-card"}`}
                >
                  <p className="font-semibold">
                    {l.name}: {l.countedQty}
                  </p>
                  {l.realUse !== null && (
                    <p>
                      {l.services ?? 0} servicios · gastaste {l.realUse}
                      {l.measuring ? " · Midiendo" : ` · se esperaba ${l.expectedUse ?? 0}`}
                      {l.alert && " · Revisar con el dueño"}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </main>
  );
}
