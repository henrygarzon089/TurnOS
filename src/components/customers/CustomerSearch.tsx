"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchCustomers, type CustomerListItem } from "@/lib/actions/customers";
import { businessDayBogota, formatDayCO } from "@/lib/domain/time";

/** REQ-018.3 buscador (nombre o últimos dígitos) y REQ-018.4 secciones del barbero. */
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

  const inQueue = items.filter((c) => c.inQueueToday);
  const served = items.filter((c) => !c.inQueueToday);

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
      ) : role === "owner" ? (
        <CustomerList items={items} label="Clientes" />
      ) : (
        <>
          {inQueue.length > 0 && (
            <section>
              <h2 className="mb-2 font-semibold">Hoy en tu fila</h2>
              <CustomerList items={inQueue} label="Hoy en tu fila" />
            </section>
          )}
          <section>
            <h2 className="mb-2 font-semibold">Atendidos por ti</h2>
            {served.length ? (
              <CustomerList items={served} label="Atendidos por ti" />
            ) : (
              <p className="text-muted text-sm">Todavía no has atendido clientes.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
}

function CustomerList({ items, label }: { items: CustomerListItem[]; label: string }) {
  return (
    <ul aria-label={label} className="border-line bg-card divide-line divide-y rounded-xl border">
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
