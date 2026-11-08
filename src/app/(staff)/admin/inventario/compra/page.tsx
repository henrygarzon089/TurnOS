import type { Metadata } from "next";
import { InventoryNav } from "@/components/admin/InventoryNav";
import { getPurchaseOrder } from "@/lib/actions/inventory";
import { getStaffSession } from "@/lib/auth/session";
import { purchaseOrderLink } from "@/lib/domain/inventory";
import { formatCOP } from "@/lib/domain/money";
import { businessDayBogota } from "@/lib/domain/time";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Orden de compra" };

/** REQ-074.1 orden de compra sugerida por proveedor y REQ-074.2 compartir por WhatsApp. */
export default async function PurchaseOrderPage() {
  const session = (await getStaffSession())!;
  const rows = (await getPurchaseOrder()) ?? [];
  const suppliers = [...new Set(rows.map((r) => r.supplier))];
  const total = rows.reduce((acc, r) => acc + r.amount, 0);
  const link = purchaseOrderLink(session.business.name, businessDayBogota(), rows);

  return (
    <main className="pb-6">
      <h1 className="text-2xl font-bold">Inventario</h1>
      <InventoryNav current="/admin/inventario/compra" />

      <p className="text-muted mt-4 text-sm">
        Ítems en su mínimo o por debajo (bodega + vitrina), con lo que falta para llegar al máximo.
      </p>
      {rows.length === 0 ? (
        <p className="border-line bg-card mt-3 rounded-md border p-4 text-sm">
          No hay nada por pedir: todo está por encima del mínimo.
        </p>
      ) : (
        <>
          {suppliers.map((s) => (
            <section key={s ?? "none"} className="mt-4" aria-label={s ?? "Sin proveedor"}>
              <h2 className="text-lg font-semibold">{s ?? "Sin proveedor"}</h2>
              <ul className="mt-2 flex flex-col gap-2">
                {rows
                  .filter((r) => r.supplier === s)
                  .map((r) => (
                    <li
                      key={r.item_id}
                      className="border-line bg-card rounded-md border p-3 text-sm"
                    >
                      <p className="font-semibold">
                        {r.name} · pedir {r.qty} {r.unit_label}
                      </p>
                      <p className="text-muted">
                        {r.presentation} · hay {r.on_hand} (mín. {r.min_qty}, máx. {r.max_qty}) ·{" "}
                        {formatCOP(r.amount)}
                      </p>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
          <p className="mt-4 text-lg font-semibold">Total estimado: {formatCOP(total)}</p>
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-primary mt-3 flex items-center justify-center"
          >
            Compartir por WhatsApp
          </a>
        </>
      )}
    </main>
  );
}
