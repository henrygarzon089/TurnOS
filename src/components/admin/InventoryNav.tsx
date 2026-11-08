import { PageHeader } from "@/components/admin/PageHeader";
import { SectionTabs } from "@/components/admin/SectionTabs";

const TABS = [
  { href: "/admin/inventario", label: "Resumen" },
  { href: "/admin/inventario/catalogo", label: "Catálogo" },
  { href: "/admin/inventario/conteo", label: "Conteo" },
  { href: "/admin/inventario/compra", label: "Orden de compra" },
  { href: "/admin/inventario/costos", label: "Costos" },
];

/** Encabezado y pestañas de /admin/inventario (design.md §18.6, tablero Dueno-Local). */
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
