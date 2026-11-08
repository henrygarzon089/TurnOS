import type { Metadata } from "next";
import Link from "next/link";
import { InventoryNav } from "@/components/admin/InventoryNav";
import { EmptyState } from "@/components/ui/States";
import { getSupplyCosts } from "@/lib/actions/inventory";
import { formatCOP } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Costo de insumos" };

/** REQ-074.3 costo de insumos por servicio, "Incompleto" si algún ítem está en "Midiendo". */
export default async function SupplyCostPage() {
  const rows = (await getSupplyCosts()) ?? [];
  return (
    <main className="pb-6">
      <InventoryNav current="/admin/inventario/costos" />

      <h2 className="mt-4 text-lg font-semibold">Costo de insumos por servicio</h2>
      <p className="text-muted mt-1 text-sm">
        Suma de (precio por unidad ÷ rendimiento) de los insumos que gasta cada servicio.
      </p>
      {rows.length === 0 ? (
        <div className="border-line bg-card mt-3 rounded-md border">
          <EmptyState
            icon="list"
            title="Ningún servicio tiene insumos todavía"
            text="En el catálogo, abre un insumo y escoge qué servicios lo gastan."
            action={
              <Link href="/admin/inventario/catalogo" className="btn-secondary px-5">
                Ir al catálogo
              </Link>
            }
          />
        </div>
      ) : (
        <ul className="border-line bg-card divide-line mt-3 flex flex-col divide-y rounded-md border">
          {rows.map((r) => (
            <li
              key={r.service_id}
              className="flex min-h-12 items-center justify-between gap-3 px-4 py-2"
            >
              <span>
                {r.name}
                {r.incomplete && (
                  <span className="text-warn block text-sm font-semibold">
                    Incompleto: hay insumos en Midiendo
                  </span>
                )}
              </span>
              <span className="font-semibold tabular-nums">{formatCOP(r.cost)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
