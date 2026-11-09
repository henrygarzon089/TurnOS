import type { Metadata } from "next";
import Link from "next/link";
import { InventoryMovements, YieldSuggestionForm } from "@/components/admin/InventoryForms";
import { InventoryCatalogTable } from "@/components/admin/InventoryCatalogTable";
import { InventoryNav } from "@/components/admin/InventoryNav";
import { RetryError } from "@/components/admin/RetryError";
import { EmptyState } from "@/components/ui/States";
import { getInventoryOverview, type InventoryLocation } from "@/lib/actions/inventory";
import { inventoryCatalogRows } from "@/lib/domain/inventory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventario" };

function locationName(l: InventoryLocation) {
  if (l.kind === "warehouse") return "Bodega";
  if (l.kind === "shelf") return "Vitrina";
  return l.barberName ?? "Estación";
}

/**
 * Catálogo del inventario (tablero Dueno-Local, REQ-078.33): la tabla de insumos con su estado y,
 * debajo, lo que antes era el resumen (design.md §18.6): alertas de consumo (REQ-073.4), vitrina por surtir
 * (REQ-072.4), estaciones por cerrar (REQ-071.5), sugerencias de rendimiento (REQ-073.5),
 * movimientos (REQ-071.2…071.4) y stock por sitio. Solo el dueño: lo asegura el layout de /admin.
 */
export default async function InventoryPage() {
  const view = await getInventoryOverview();
  if (!view) {
    return (
      <main className="pb-6">
        <InventoryNav current="/admin/inventario" />
        <RetryError title="No pudimos cargar el inventario" />
      </main>
    );
  }
  const stations = view.locations.filter((l) => l.kind === "station" && l.status !== "closed");
  const places = [...view.locations.filter((l) => l.kind !== "station"), ...stations];
  const toFill = view.items.filter((i) => (i.shelfToFill ?? 0) > 0);
  const negative = view.items.filter((i) => i.negative);
  const active = view.items;

  return (
    <main className="pb-6">
      <InventoryNav current="/admin/inventario" />

      {active.length > 0 && <InventoryCatalogTable rows={inventoryCatalogRows(view)} />}

      {active.length === 0 && (
        <div className="border-line bg-card mt-4 rounded-md border">
          <EmptyState
            icon="list"
            title="Todavía no hay ítems"
            text="Empieza por el catálogo: ahí agregas los insumos y lo que vendes en la vitrina."
            action={
              <Link href="/admin/inventario/catalogo" className="btn-primary px-5">
                Ir al catálogo
              </Link>
            }
          />
        </div>
      )}

      {/* Pendientes y movimientos lado a lado desde 1024 px: los campos no se estiran (§22.8) */}
      <div className="grid items-start gap-x-4 lg:grid-cols-2">
        {(view.alerts.length > 0 ||
          toFill.length > 0 ||
          negative.length > 0 ||
          view.closingStations.length > 0) && (
          <section
            className="border-line bg-card divide-line mt-6 flex flex-col divide-y overflow-hidden rounded-md border"
            aria-label="Pendientes"
          >
            {view.alerts.map((a) => (
              <p key={`${a.locationId}-${a.itemId}`} className="bg-accent-soft px-4 py-3 text-base">
                <span className="font-bold">
                  Revisar con {a.barberName}: {a.itemName}
                </span>{" "}
                <span className="text-danger block text-sm font-semibold">
                  Consumo raro: gastó {a.realUse}, se esperaba {a.expectedUse}.
                </span>
              </p>
            ))}
            {negative.map((i) => (
              <p key={`neg-${i.id}`} className="bg-accent-soft px-4 py-3 text-base">
                <span className="font-bold">{i.name}</span>
                <span className="text-danger block text-sm font-semibold">
                  El stock quedó en negativo. Registra la entrada o haz el conteo.
                </span>
              </p>
            ))}
            {toFill.map((i) => (
              <p key={`fill-${i.id}`} className="bg-warn-soft px-4 py-3 text-base">
                <span className="font-bold">Surtir vitrina:</span> {i.name}
                <span className="text-warn block text-sm font-semibold">
                  Faltan {i.shelfToFill}.
                </span>
              </p>
            ))}
            {view.closingStations.map((s) => (
              <p key={s.locationId} className="px-4 py-3 text-base">
                <span className="font-bold">Estación por cerrar:</span> {s.barberName}
                <span className="text-muted block text-sm">
                  Recibe lo que tiene y transfiérelo a la bodega.
                </span>
              </p>
            ))}
          </section>
        )}

        {active.length > 0 && <InventoryMovements items={active} locations={view.locations} />}
      </div>

      {view.suggestions.length > 0 && (
        <section className="mt-6" aria-labelledby="yield-title">
          <h2 id="yield-title" className="text-lg font-semibold">
            Rendimiento sugerido
          </h2>
          <p className="text-muted mt-1 text-sm">
            Ya hay suficientes conteos para proponer cuántos servicios rinde cada unidad.
          </p>
          <div className="mt-2 flex flex-col gap-3">
            {view.suggestions.map((s) => (
              <YieldSuggestionForm key={s.item_id} s={s} />
            ))}
          </div>
        </section>
      )}

      {active.length > 0 && (
        <section className="mt-6" aria-labelledby="stock-title">
          <h2 id="stock-title" className="text-lg font-semibold">
            Stock por sitio
          </h2>
          <div className="border-line bg-card mt-2 overflow-x-auto rounded-md border">
            <table className="w-full text-base">
              <thead>
                <tr className="bg-brand text-brand-ink text-left text-sm">
                  <th className="px-3 py-2 font-semibold">Ítem</th>
                  {places.map((l) => (
                    <th key={l.id} className="px-3 py-2 text-right font-semibold whitespace-nowrap">
                      {locationName(l)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((i) => (
                  <tr key={i.id} className="border-line border-t">
                    <td className="px-3 py-2 font-semibold">
                      {i.name}
                      <span className="text-muted block text-sm font-normal">{i.presentation}</span>
                    </td>
                    {places.map((l) => {
                      const qty = i.stock[l.id] ?? 0;
                      return (
                        <td
                          key={l.id}
                          className={`px-3 py-2 text-right tabular-nums ${qty < 0 ? "text-danger font-semibold" : ""}`}
                        >
                          {qty}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
