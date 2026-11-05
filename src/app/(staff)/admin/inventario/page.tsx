import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { InventoryMovements, YieldSuggestionForm } from "@/components/admin/InventoryForms";
import { InventoryNav } from "@/components/admin/InventoryNav";
import { getInventoryOverview, type InventoryLocation } from "@/lib/actions/inventory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Inventario" };

function locationName(l: InventoryLocation) {
  if (l.kind === "warehouse") return "Bodega";
  if (l.kind === "shelf") return "Vitrina";
  return l.barberName ?? "Estación";
}

/**
 * Resumen del inventario (design.md §18.6): alertas de consumo (REQ-073.4), vitrina por surtir
 * (REQ-072.4), estaciones por cerrar (REQ-071.5), sugerencias de rendimiento (REQ-073.5),
 * movimientos (REQ-071.2…071.4) y stock por sitio. Solo el dueño: lo asegura el layout de /admin.
 */
export default async function InventoryPage() {
  const view = await getInventoryOverview();
  if (!view) {
    return (
      <main className="pb-6">
        <AdminNav current="/admin/inventario" />
        <h1 className="text-2xl font-bold">Inventario</h1>
        <p className="text-danger mt-2">No se pudo cargar el inventario. Recarga la página.</p>
      </main>
    );
  }
  const stations = view.locations.filter((l) => l.kind === "station" && l.status !== "closed");
  const places = [
    ...view.locations.filter((l) => l.kind !== "station"),
    ...stations,
  ];
  const toFill = view.items.filter((i) => (i.shelfToFill ?? 0) > 0);
  const negative = view.items.filter((i) => i.negative);
  const active = view.items;

  return (
    <main className="pb-6">
      <AdminNav current="/admin/inventario" />
      <h1 className="text-2xl font-bold">Inventario</h1>
      <InventoryNav current="/admin/inventario" />

      {active.length === 0 && (
        <p className="border-line bg-card mt-4 rounded-xl border p-4 text-sm">
          Todavía no hay ítems. Empieza por el{" "}
          <Link href="/admin/inventario/catalogo" className="font-semibold underline">
            catálogo
          </Link>
          .
        </p>
      )}

      {(view.alerts.length > 0 || toFill.length > 0 || negative.length > 0 || view.closingStations.length > 0) && (
        <section className="mt-4 flex flex-col gap-2" aria-label="Pendientes">
          {view.alerts.map((a) => (
            <p key={`${a.locationId}-${a.itemId}`} className="border-danger text-danger rounded-xl border p-3 text-sm">
              <span className="font-semibold">
                Revisar con {a.barberName}: {a.itemName}
              </span>{" "}
              · gastó {a.realUse}, se esperaba {a.expectedUse}.
            </p>
          ))}
          {negative.map((i) => (
            <p key={`neg-${i.id}`} className="border-danger text-danger rounded-xl border p-3 text-sm">
              <span className="font-semibold">{i.name}</span>: el stock quedó en negativo. Registra la entrada
              o haz el conteo.
            </p>
          ))}
          {toFill.map((i) => (
            <p key={`fill-${i.id}`} className="border-line bg-card rounded-xl border p-3 text-sm">
              <span className="font-semibold">Surtir vitrina:</span> {i.name} · faltan {i.shelfToFill}.
            </p>
          ))}
          {view.closingStations.map((s) => (
            <p key={s.locationId} className="border-line bg-card rounded-xl border p-3 text-sm">
              <span className="font-semibold">Estación por cerrar:</span> {s.barberName}. Recibe lo que
              tiene y transfiérelo a la bodega.
            </p>
          ))}
        </section>
      )}

      {active.length > 0 && <InventoryMovements items={active} locations={view.locations} />}

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
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted text-left">
                  <th className="py-2 pr-3 font-medium">Ítem</th>
                  {places.map((l) => (
                    <th key={l.id} className="px-2 py-2 text-right font-medium whitespace-nowrap">
                      {locationName(l)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {active.map((i) => (
                  <tr key={i.id} className="border-line border-t">
                    <td className="py-2 pr-3">
                      {i.name}
                      <span className="text-muted block text-xs">{i.presentation}</span>
                    </td>
                    {places.map((l) => {
                      const qty = i.stock[l.id] ?? 0;
                      return (
                        <td
                          key={l.id}
                          className={`px-2 py-2 text-right tabular-nums ${qty < 0 ? "text-danger font-semibold" : ""}`}
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
