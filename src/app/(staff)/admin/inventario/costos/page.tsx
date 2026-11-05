import type { Metadata } from "next";
import { AdminNav } from "@/components/admin/AdminNav";
import { InventoryNav } from "@/components/admin/InventoryNav";
import { getSupplyCosts } from "@/lib/actions/inventory";
import { formatCOP } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Costo de insumos" };

/** REQ-074.3 costo de insumos por servicio, "Incompleto" si algún ítem está en "Midiendo". */
export default async function SupplyCostPage() {
  const rows = (await getSupplyCosts()) ?? [];
  return (
    <main className="pb-6">
      <AdminNav current="/admin/inventario" />
      <h1 className="text-2xl font-bold">Inventario</h1>
      <InventoryNav current="/admin/inventario/costos" />

      <h2 className="mt-4 text-lg font-semibold">Costo de insumos por servicio</h2>
      <p className="text-muted mt-1 text-sm">
        Suma de (precio por unidad ÷ rendimiento) de los insumos que gasta cada servicio.
      </p>
      {rows.length === 0 ? (
        <p className="border-line bg-card mt-3 rounded-xl border p-4 text-sm">
          Ningún servicio tiene insumos todavía. Escógelos en el catálogo.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.service_id}
              className="border-line bg-card flex min-h-12 items-center justify-between rounded-xl border px-4 py-2"
            >
              <span>
                {r.name}
                {r.incomplete && <span className="text-muted block text-xs">Incompleto: hay insumos en Midiendo</span>}
              </span>
              <span className="font-semibold tabular-nums">{formatCOP(r.cost)}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
