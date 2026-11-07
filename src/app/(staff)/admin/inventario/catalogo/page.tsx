import type { Metadata } from "next";
import {
  BasicTemplateButton,
  InventoryItemForm,
  ItemUsageForm,
} from "@/components/admin/InventoryForms";
import { InventoryNav } from "@/components/admin/InventoryNav";
import { getInventoryCatalog } from "@/lib/actions/inventory";
import {
  INVENTORY_GROUP_LABELS,
  INVENTORY_GROUPS,
  INVENTORY_USE_LABELS,
} from "@/lib/domain/inventory";
import { formatCOP } from "@/lib/domain/money";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catálogo de inventario" };

/**
 * REQ-070.1/070.2/070.6 catálogo de insumos y productos de vitrina, y REQ-073.1 servicios que
 * gastan cada insumo (design.md §18.6). Solo el dueño: lo asegura el layout de /admin.
 */
export default async function InventoryCatalogPage() {
  const catalog = (await getInventoryCatalog())!;
  const usageCount = (id: string) => catalog.usage.filter((u) => u.item_id === id).length;

  return (
    <main className="pb-6">
      <h1 className="text-2xl font-bold">Inventario</h1>
      <InventoryNav current="/admin/inventario/catalogo" />

      <details className="border-line bg-card mt-4 rounded-md border">
        <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold">
          Nuevo ítem
        </summary>
        <div className="px-1 pb-1">
          <InventoryItemForm products={catalog.products} />
        </div>
      </details>
      {catalog.items.length === 0 && <BasicTemplateButton />}

      {INVENTORY_GROUPS.map((g) => {
        const items = catalog.items.filter((i) => i.group === g);
        if (items.length === 0) return null;
        return (
          <section key={g} className="mt-6" aria-labelledby={`group-${g}`}>
            <h2 id={`group-${g}`} className="text-lg font-semibold">
              {INVENTORY_GROUP_LABELS[g]}
            </h2>
            <ul className="mt-2 flex flex-col gap-2">
              {items.map((i) => (
                <li key={i.id}>
                  <details className="border-line bg-card rounded-md border">
                    <summary className="flex min-h-12 cursor-pointer flex-col justify-center px-4 py-2">
                      <span
                        className={`font-semibold ${i.is_active ? "" : "text-muted line-through"}`}
                      >
                        {i.name}
                      </span>
                      <span className="text-muted text-xs">
                        {INVENTORY_USE_LABELS[i.use]} · {i.presentation} · {formatCOP(i.unit_cost)}{" "}
                        / {i.unit_label}
                        {i.use === "internal" &&
                          ` · ${usageCount(i.id) ? `${usageCount(i.id)} servicios` : "sin servicios"}`}
                        {!i.is_active && " · Desactivado"}
                      </span>
                    </summary>
                    <div className="flex flex-col gap-3 px-1 pb-1">
                      <InventoryItemForm item={i} products={catalog.products} />
                      {i.use === "internal" && i.is_active && (
                        <ItemUsageForm item={i} catalog={catalog} />
                      )}
                    </div>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
