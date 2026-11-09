"use client";

import Link from "next/link";
import { useState } from "react";
import {
  filterCatalogRows,
  INVENTORY_GROUP_LABELS,
  INVENTORY_GROUPS,
  INVENTORY_STATUS_LABELS,
  type CatalogRow,
  type InventoryGroup,
} from "@/lib/domain/inventory";
import { formatCOP } from "@/lib/domain/money";

const COLS = "lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.1fr)_6rem_7rem_5rem_6.5rem_8rem]";

/**
 * Catálogo del inventario como el tablero Dueno-Local (REQ-078.33, design §22.8): buscador,
 * "Todas las categorías", "Hacer conteo" y "Nuevo insumo" en una hilera; tabla Insumo · Unidad ·
 * En bodega · En estaciones · Mínimo · Costo · Estado ("Pedir" ámbar, "Consumo raro" rojo). En el
 * celular, una fila por insumo con su estado. Filtra en el navegador sobre lo ya cargado.
 */
export function InventoryCatalogTable({ rows }: { rows: CatalogRow[] }) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState<InventoryGroup | "">("");
  const shown = filterCatalogRows(rows, q, group);
  const groups = INVENTORY_GROUPS.filter((g) => rows.some((r) => r.group === g));

  return (
    <section
      aria-label="Catálogo"
      className="border-line bg-card mt-4 overflow-hidden rounded-md border"
    >
      <div className="flex flex-wrap items-center gap-2 p-3">
        <input
          type="search"
          aria-label="Buscar insumo"
          placeholder="Buscar insumo"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="input min-w-0 flex-1 basis-48 lg:max-w-72"
        />
        <select
          aria-label="Categoría"
          value={group}
          onChange={(e) => setGroup(e.target.value as InventoryGroup | "")}
          className="input w-auto min-w-0 flex-1 basis-48 lg:max-w-60 lg:flex-none"
        >
          <option value="">Todas las categorías</option>
          {groups.map((g) => (
            <option key={g} value={g}>
              {INVENTORY_GROUP_LABELS[g]}
            </option>
          ))}
        </select>
        <div className="flex flex-1 basis-full justify-end gap-2 sm:basis-auto">
          <Link
            href="/admin/inventario/conteo"
            className="btn-secondary flex-1 px-4 sm:w-auto sm:flex-none"
          >
            Hacer conteo
          </Link>
          <Link
            href="/admin/inventario/catalogo?nuevo=1"
            className="btn-primary flex-1 px-4 sm:w-auto sm:flex-none"
          >
            Nuevo insumo
          </Link>
        </div>
      </div>

      <div
        aria-hidden="true"
        className={`bg-brand text-brand-ink hidden gap-3 px-4 py-2 text-sm font-semibold lg:grid ${COLS}`}
      >
        <span>Insumo</span>
        <span>Unidad</span>
        <span className="text-right">En bodega</span>
        <span className="text-right">En estaciones</span>
        <span className="text-right">Mínimo</span>
        <span className="text-right">Costo</span>
        <span>Estado</span>
      </div>
      {shown.length === 0 ? (
        <p className="text-muted border-line border-t px-4 py-3">
          Ningún insumo coincide con la búsqueda.
        </p>
      ) : (
        <ul className="divide-line border-line divide-y border-t lg:border-t-0">
          {shown.map((r) => (
            <li
              key={r.id}
              aria-label={`Insumo ${r.name}`}
              className={`grid grid-cols-[1fr_auto] items-center gap-x-3 px-4 py-2.5 lg:gap-3 ${COLS} ${
                r.status === "rare" ? "bg-accent-soft" : r.status === "order" ? "bg-warn-soft" : ""
              }`}
            >
              <div className="min-w-0 lg:contents">
                <p className="font-bold break-words">{r.name}</p>
                <p className="text-muted lg:text-ink text-sm break-words lg:text-base">
                  {r.unit}
                  <span className="lg:hidden">
                    {" "}
                    · {r.warehouse} en bodega · mín. {r.minQty}
                  </span>
                </p>
                <p className="hidden text-right tabular-nums lg:block">{r.warehouse}</p>
                <p className="hidden text-right tabular-nums lg:block">{r.stations || "—"}</p>
                <p className="hidden text-right tabular-nums lg:block">{r.minQty}</p>
                <p className="hidden text-right tabular-nums lg:block">{formatCOP(r.unitCost)}</p>
              </div>
              <StatusTag status={r.status} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted border-line border-t px-4 py-3 text-sm">
        “Consumo raro”: en el último conteo se gastó más de lo normal para los servicios hechos.
        Revisa con los barberos.
      </p>
    </section>
  );
}

function StatusTag({ status }: { status: CatalogRow["status"] }) {
  const label = INVENTORY_STATUS_LABELS[status];
  if (status === "rare")
    return (
      <span className="bg-danger justify-self-end rounded-sm px-2 py-0.5 text-sm font-bold text-white lg:justify-self-start">
        {label}
      </span>
    );
  if (status === "order")
    return (
      <span className="text-warn justify-self-end text-sm font-bold lg:justify-self-start">
        {label}
      </span>
    );
  return <span className="text-muted justify-self-end text-sm lg:justify-self-start">{label}</span>;
}
