"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchCustomers, type CustomerListItem } from "@/lib/actions/customers";
import { Icon } from "@/components/ui/Icon";
import { agoCO, businessDayBogota, formatDayCO } from "@/lib/domain/time";

/** REQ-018.3 buscador (nombre o últimos dígitos) y REQ-018.4 / REQ-078.16 lista del barbero. */
export function CustomerSearch({
  initial,
  role,
}: {
  initial: CustomerListItem[];
  role: "owner" | "barber";
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(initial);
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    if (id === 1 && q === "") return; // la lista inicial ya viene del servidor
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchCustomers(q);
        if (id === seq.current) setItems(res);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  // Barbero (tablero Barbero-Otros, T-171): buscador con lupa y una sola lista a todo el ancho;
  // los de hoy en su fila van primero (ya vienen en ese orden)
  if (role === "barber") {
    return (
      <div className="-mx-4 mt-3 flex flex-col">
        <label className="relative mx-4 block">
          <span className="sr-only">Buscar cliente</span>
          <Icon
            name="search"
            className="text-muted pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2"
          />
          <input
            className="input !pl-11"
            type="search"
            inputMode="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por nombre o celular"
            autoComplete="off"
          />
        </label>
        <p className="text-muted mx-4 min-h-5 text-xs" aria-live="polite">
          {pending ? "Buscando…" : ""}
        </p>
        {items.length === 0 ? (
          <p className="text-muted mx-4">
            {q.trim()
              ? "No encontramos clientes con esa búsqueda."
              : "Todavía no has atendido clientes."}
          </p>
        ) : (
          <ul aria-label="Clientes" className="border-line bg-card divide-line divide-y border-y">
            {items.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/clientes/${c.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{c.name}</span>
                      {c.hasMembership && (
                        <span className="border-ink rounded-sm border px-1.5 text-xs font-semibold">
                          Familia
                        </span>
                      )}
                    </span>
                    <span className="text-muted block text-sm">
                      *** {c.phoneLast4} ·{" "}
                      {c.inQueueToday
                        ? "hoy"
                        : c.lastVisitAt
                          ? agoCO(c.lastVisitAt)
                          : "sin visitas"}
                    </span>
                  </span>
                  {c.stamps !== null && c.stampsRequired !== null && (
                    <span className="text-muted shrink-0 text-sm tabular-nums">
                      {Math.min(c.stamps, c.stampsRequired)}/{c.stampsRequired}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  return (
    <div className="mt-4 flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        Buscar cliente
        <input
          className="input"
          type="search"
          inputMode="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Nombre o últimos números del celular"
          autoComplete="off"
        />
      </label>
      <p className="text-muted -mt-3 min-h-5 text-xs" aria-live="polite">
        {pending ? "Buscando…" : ""}
      </p>

      {items.length === 0 ? (
        <p className="text-muted">
          {q.trim() ? "No encontramos clientes con esa búsqueda." : "No encontramos clientes."}
        </p>
      ) : (
        <CustomerList items={items} label="Clientes" />
      )}
    </div>
  );
}
function CustomerList({ items, label }: { items: CustomerListItem[]; label: string }) {
  return (
    <ul aria-label={label} className="border-line bg-card divide-line divide-y rounded-md border">
      {items.map((c) => (
        <li key={c.id}>
          <Link
            href={`/app/clientes/${c.id}`}
            className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{c.name}</span>
              <span className="text-muted block text-xs">
                ···{c.phoneLast4} · {c.visitsCount} {c.visitsCount === 1 ? "visita" : "visitas"}
              </span>
            </span>
            <span className="text-muted shrink-0 text-xs">
              {c.lastVisitAt
                ? formatDayCO(businessDayBogota(new Date(c.lastVisitAt)))
                : "Sin visitas"}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
