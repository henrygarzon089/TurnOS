import { PageHeader } from "@/components/admin/PageHeader";
import { SectionTabs } from "@/components/admin/SectionTabs";

const TABS = [
  { href: "/admin/inventario", label: "Catálogo" },
  { href: "/admin/inventario/conteo", label: "Conteo" },
  { href: "/admin/inventario/compra", label: "Orden de compra" },
  { href: "/admin/inventario/costos", label: "Costo por servicio" },
];

/**
 * Encabezado y pestañas de /admin/inventario como el tablero Dueno-Local (design §22.8): Catálogo
 * (la tabla, y su edición en /admin/inventario/catalogo), Conteo, Orden de compra y Costo por servicio.
 */
export function InventoryNav({ current }: { current: string }) {
  return (
    <>
      <PageHeader
        title="Inventario"
        subtitle="Catálogo, conteo, orden de compra y costo por servicio."
      />
      <SectionTabs label="Inventario" tabs={TABS} current={current} />
    </>
  );
}
