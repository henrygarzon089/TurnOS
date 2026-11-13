"use client";

import Image from "next/image";
import { useState } from "react";
import { showcaseCategories } from "@/lib/domain/showcase";
import { formatCOP } from "@/lib/domain/money";
import { mediaUrl } from "@/lib/media/paths";

export type ShowcaseProduct = {
  id: string;
  name: string;
  price: number;
  photoPath: string | null;
  category: string | null;
  commissionable: boolean;
};

/**
 * REQ-066.1 / REQ-066.2 vitrina: cuadros con foto (o la inicial), nombre, precio y + / −, con
 * pestañas por categoría si hay alguna. La usan "Nueva venta" y el cobro del turno (REQ-066.5).
 * Con `discountPct` (compra de un barbero, REQ-068.3) cada cuadro muestra el precio con descuento.
 */
export function ProductShowcase({
  products,
  qty,
  onChange,
  discountPct = 0,
}: {
  products: ShowcaseProduct[];
  qty: Record<string, number>;
  onChange: (id: string, qty: number) => void;
  discountPct?: number;
}) {
  const categories = showcaseCategories(products);
  const [tab, setTab] = useState<string | null>(null);
  const shown = tab === null ? products : products.filter((p) => p.category === tab);

  return (
    <section aria-label="Productos" className="flex flex-col gap-2">
      <h3 className="text-muted text-xs font-semibold tracking-wide uppercase">Productos</h3>
      {categories.length > 0 && (
        <div role="tablist" aria-label="Categorías" className="flex gap-2 overflow-x-auto pb-1">
          {[null, ...categories].map((c) => (
            <button
              key={c ?? "todos"}
              type="button"
              role="tab"
              aria-selected={tab === c}
              onClick={() => setTab(c)}
              className={`min-h-12 shrink-0 rounded-md border px-4 text-sm font-semibold ${
                tab === c
                  ? "border-brand bg-brand-soft text-ink border-2"
                  : "border-line-strong bg-card"
              }`}
            >
              {c ?? "Todos"}
            </button>
          ))}
        </div>
      )}
      {/* Columnas de al menos 136 px: el − cantidad + cabe entero; con zoom 200 % queda una sola */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2">
        {shown.map((p) => {
          const n = qty[p.id] ?? 0;
          return (
            <div
              key={p.id}
              className={`flex flex-col gap-1 rounded-md border p-2 ${
                n > 0 ? "border-brand" : "border-line"
              }`}
            >
              {p.photoPath ? (
                <Image
                  src={mediaUrl(p.photoPath)}
                  alt=""
                  width={160}
                  height={96}
                  unoptimized
                  className="h-24 w-full rounded-sm object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="bg-line/40 text-muted flex h-24 w-full items-center justify-center rounded-sm text-3xl font-bold"
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-sm leading-tight font-semibold break-words">{p.name}</span>
              <span className="text-muted text-sm">
                {discountPct > 0 ? (
                  <>
                    <s>{formatCOP(p.price)}</s> −{discountPct} %
                  </>
                ) : (
                  formatCOP(p.price)
                )}
              </span>
              <span className="flex items-center justify-between gap-1">
                <button
                  type="button"
                  className="btn-secondary desk:h-10 h-12 w-12 px-0"
                  aria-label={`Quitar un ${p.name}`}
                  disabled={n === 0}
                  onClick={() => onChange(p.id, Math.max(0, n - 1))}
                >
                  −
                </button>
                <span className="w-6 text-center font-semibold" aria-label={`${p.name}: ${n}`}>
                  {n}
                </span>
                <button
                  type="button"
                  className="btn-secondary desk:h-10 h-12 w-12 px-0"
                  aria-label={`Agregar un ${p.name}`}
                  onClick={() => onChange(p.id, n + 1)}
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
