import type { Metadata } from "next";
import Link from "next/link";
import { AdminNav } from "@/components/admin/AdminNav";
import { CountForm, type CountRow } from "@/components/admin/InventoryForms";
import { InventoryNav } from "@/components/admin/InventoryNav";
import {
  getInventoryOverview,
  hasStockCount,
  type InventoryLocation,
} from "@/lib/actions/inventory";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Conteo de inventario" };

function locationName(l: InventoryLocation) {
  if (l.kind === "warehouse") return "Bodega";
  if (l.kind === "shelf") return "Vitrina";
  return `${l.barberName ?? "Estación"}${l.status === "closing" ? " (por cerrar)" : ""}`;
}

/**
 * REQ-073.3 conteo semanal de estación, REQ-073.6 conteo mensual de bodega y vitrina con motivo,
 * REQ-073.7 cierre de una estación por cerrar (design.md §18.6).
 */
export default async function InventoryCountPage({
  searchParams,
}: {
  searchParams: Promise<{ sitio?: string }>;
}) {
  const { sitio } = await searchParams;
  const view = await getInventoryOverview();
  const locations = (view?.locations ?? []).filter((l) => l.status !== "closed");
  const loc = locations.find((l) => l.id === sitio);
  const counted = loc ? await hasStockCount(loc.id) : false;

  const rows: CountRow[] =
    !view || !loc
      ? []
      : view.items
          .filter((i) =>
            loc.kind === "warehouse"
              ? true
              : loc.kind === "shelf"
                ? i.use === "sale"
                : i.use === "internal" && (i.stationQty > 0 || (i.stock[loc.id] ?? 0) !== 0),
          )
          .map((i) => ({
            itemId: i.id,
            name: i.name,
            unitLabel: i.unitLabel,
            systemQty: i.stock[loc.id] ?? 0,
          }));

  return (
    <main className="pb-6">
      <AdminNav current="/admin/inventario" />
      <h1 className="text-2xl font-bold">Inventario</h1>
      <InventoryNav current="/admin/inventario/conteo" />

      <p className="text-muted mt-4 text-sm">
        Estaciones: cada semana. Bodega y vitrina: cada mes, con el motivo de cada diferencia. El
        primer conteo de cada sitio es el inicial.
      </p>
      <nav aria-label="Sitio" className="mt-3 grid grid-cols-2 gap-2">
        {locations.map((l) => (
          <Link
            key={l.id}
            href={`/admin/inventario/conteo?sitio=${l.id}`}
            aria-current={loc?.id === l.id ? "page" : undefined}
            className={`flex min-h-12 items-center justify-center rounded-md border px-2 text-center text-sm font-semibold ${
              loc?.id === l.id ? "bg-ink text-card border-ink" : "border-line bg-card"
            }`}
          >
            {locationName(l)}
          </Link>
        ))}
      </nav>

      {loc && !counted && (
        <p className="border-line bg-card mt-4 rounded-md border p-3 text-sm">
          Es el conteo inicial de este sitio: lo que cuentes queda como punto de partida.
        </p>
      )}
      {loc && (
        <CountForm
          key={loc.id}
          locationId={loc.id}
          needsReason={loc.kind !== "station" && counted}
          rows={rows}
        />
      )}
    </main>
  );
}
