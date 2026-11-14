"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { searchOwnerCustomers, type OwnerCustomerRow } from "@/lib/actions/customers";
import { Tag } from "@/components/admin/ModulePage";
import { lastSeen } from "@/lib/domain/owner-tables";

type Meta = {
  total: number;
  inactiveDays: number;
  today: string;
  barbers: { id: string; name: string }[];
};

/**
 * REQ-078.33 (T-180) clientes del dueño como el tablero Dueno-Clientes: buscador "Nombre o
 * celular", "Todos ▾", "Barbero: todos ▾" y "N clientes"; en escritorio tabla Nombre · Celular
 * (enmascarado) · Última vez (ámbar si pasa de los días de Recordar) · Barbero habitual · Cortes;
 * Fidelidad (X/10) · Membresía (familia o "Vence en N días" en ámbar); en el celular, lista con lo
 * mismo en una línea. La búsqueda va al servidor (REQ-018.3); los
 * filtros, sobre lo ya cargado. La ficha (nombre) muestra el celular completo.
 */
export function OwnerCustomerTable({
  initial,
  meta,
  showMembership = true,
}: {
  initial: OwnerCustomerRow[];
  meta: Meta;
  /** REQ-083.3: sin la columna "Membresía" con el módulo apagado. */
  showMembership?: boolean;
}) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState(initial);
  const [which, setWhich] = useState<"all" | "stale">("all");
  const [barber, setBarber] = useState("");
  const [pending, startTransition] = useTransition();
  const seq = useRef(0);

  useEffect(() => {
    const id = ++seq.current;
    if (id === 1 && q === "") return; // la lista inicial ya viene del servidor
    const timer = setTimeout(() => {
      startTransition(async () => {
        const res = await searchOwnerCustomers(q);
        if (id === seq.current) setItems(res);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [q]);

  const barberName = (id: string | null) => meta.barbers.find((b) => b.id === id)?.name ?? "—";
  const rows = items
    .map((c) => ({ ...c, seen: lastSeen(c.lastVisitAt, meta.today, meta.inactiveDays) }))
    .filter((c) => (which === "stale" ? c.seen.stale : true))
    .filter((c) => (barber ? c.preferredBarberId === barber : true));
  const filtered = q.trim() !== "" || which !== "all" || barber !== "";
  const count = filtered ? rows.length : meta.total;

  return (
    <section
      aria-label="Clientes"
      className="bg-card border-line mt-4 min-w-0 overflow-hidden rounded-md border"
    >
      <div className="border-line flex flex-wrap items-center gap-2 border-b p-3">
        <label className="min-w-0 flex-1 basis-56">
          <span className="sr-only">Buscar cliente</span>
          <input
            className="input"
            type="search"
            inputMode="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nombre o celular"
            autoComplete="off"
          />
        </label>
        <select
          className="input w-auto! flex-none"
          aria-label="Qué clientes"
          value={which}
          onChange={(e) => setWhich(e.target.value as "all" | "stale")}
        >
          <option value="all">Todos</option>
          <option value="stale">No vienen hace más de {meta.inactiveDays} días</option>
        </select>
        <select
          className="input w-auto! flex-none"
          aria-label="Barbero habitual"
          value={barber}
          onChange={(e) => setBarber(e.target.value)}
        >
          <option value="">Barbero: todos</option>
          {meta.barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <p className="text-muted ml-auto text-sm" aria-live="polite" data-testid="customers-count">
          {pending ? (
            "Buscando…"
          ) : (
            <>
              <strong className="text-ink tabular-nums">{count.toLocaleString("es-CO")}</strong>{" "}
              {count === 1 ? "cliente" : "clientes"}
            </>
          )}
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted px-4 py-6 text-center">
          {filtered ? "No encontramos clientes con esa búsqueda." : "No encontramos clientes."}
        </p>
      ) : (
        <>
          <table className="hidden w-full text-sm lg:table" aria-label="Tabla de clientes">
            <thead className="bg-brand text-brand-ink text-left text-xs">
              <tr>
                <th className="px-4 py-2 font-bold">Nombre</th>
                <th className="px-3 py-2 font-bold">Celular</th>
                <th className="px-3 py-2 font-bold">Última vez</th>
                <th className="px-3 py-2 font-bold">Barbero habitual</th>
                <th className="px-3 py-2 text-right font-bold">Cortes</th>
                <th className="px-3 py-2 text-right font-bold">Fidelidad</th>
                {showMembership && <th className="px-4 py-2 font-bold">Membresía</th>}
              </tr>
            </thead>
            <tbody className="divide-line divide-y">
              {rows.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-0">
                    <Link
                      href={`/app/clientes/${c.id}`}
                      className="flex min-h-12 items-center font-bold hover:underline"
                    >
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{c.phoneMasked}</td>
                  <td className={`px-3 py-2 ${c.seen.stale ? "text-warn font-bold" : ""}`}>
                    {c.seen.label}
                  </td>
                  <td className="px-3 py-2">{barberName(c.preferredBarberId)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.visitsCount}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.loyalty}</td>
                  {showMembership && (
                    <td className="px-4 py-2">
                      {c.membership ? (
                        <Tag tone={c.membership.tone}>{c.membership.label}</Tag>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>

          <ul aria-label="Lista de clientes" className="divide-line divide-y lg:hidden">
            {rows.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/app/clientes/${c.id}`}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-bold">{c.name}</span>
                    <span
                      className={`block truncate text-xs ${c.seen.stale ? "text-warn" : "text-muted"}`}
                    >
                      <span className="tabular-nums">{c.phoneMasked}</span> · {c.seen.label}
                      {c.preferredBarberId ? ` · ${barberName(c.preferredBarberId)}` : ""}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 text-xs">
                    <span className="text-muted tabular-nums">
                      {c.visitsCount} {c.visitsCount === 1 ? "corte" : "cortes"}
                      {c.loyalty !== "—" ? ` · ${c.loyalty}` : ""}
                    </span>
                    {showMembership && c.membership && (
                      <Tag tone={c.membership.tone}>{c.membership.label}</Tag>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {!filtered && meta.total > rows.length && (
            <p className="text-muted border-line border-t px-4 py-3 text-sm">
              {`1–${rows.length} de ${meta.total.toLocaleString("es-CO")}. Busca por nombre o por los últimos números del celular para ver a los demás.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}
