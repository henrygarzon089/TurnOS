"use client";

import Image from "next/image";
import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { formatCOP } from "@/lib/domain/money";
import { mediaUrl } from "@/lib/media/paths";
import type { PublicBusiness } from "@/lib/queue/public-queue";

type MenuProps = { address: string | null; products: PublicBusiness["products"] };

/**
 * REQ-038.2 (ADR-052): "Ver menú" abre la hoja "Menú" con la dirección del local arriba y "Lo que
 * vendemos" (foto 48×48, nombre y precio). Solo se muestran: se compran en el local. Sin productos
 * a la venta, quien la usa no pinta el botón.
 */
export function MenuSheet({ address, products }: MenuProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-ink inline-flex min-h-12 items-center font-semibold underline underline-offset-4"
      >
        Ver menú
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Menú">
        <MenuList address={address} products={products} />
        <button type="button" className="btn-secondary" onClick={() => setOpen(false)}>
          Cerrar
        </button>
      </Sheet>
    </>
  );
}

export function MenuList({ address, products }: MenuProps) {
  return (
    <div className="flex flex-col gap-4">
      {address && <p className="text-muted">{address}</p>}
      <section aria-labelledby="lo-que-vendemos">
        <h3 id="lo-que-vendemos" className="text-muted text-sm font-semibold">
          Lo que vendemos
        </h3>
        <ul className="divide-line mt-1 divide-y">
          {products.map((p) => (
            <li key={p.id} className="flex min-h-14 items-center gap-3 py-1">
              {p.photoPath && (
                <Image
                  src={mediaUrl(p.photoPath)}
                  alt={p.name}
                  width={48}
                  height={48}
                  unoptimized
                  className="size-12 shrink-0 rounded-sm object-cover"
                />
              )}
              <span className="min-w-0 flex-1 break-words">{p.name}</span>
              <span className="shrink-0 font-semibold tabular-nums">{formatCOP(p.price)}</span>
            </li>
          ))}
        </ul>
        <p className="text-muted mt-1 text-sm">Se compran en el local.</p>
      </section>
    </div>
  );
}
