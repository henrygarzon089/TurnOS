import Link from "next/link";

const TABS = [
  { href: "/admin/inventario", label: "Resumen" },
  { href: "/admin/inventario/catalogo", label: "Catálogo" },
  { href: "/admin/inventario/conteo", label: "Conteo" },
  { href: "/admin/inventario/compra", label: "Orden de compra" },
  { href: "/admin/inventario/costos", label: "Costos" },
];

/** Pestañas de /admin/inventario (design.md §18.6). */
export function InventoryNav({ current }: { current: string }) {
  return (
    <nav aria-label="Inventario" className="-mx-4 mt-2 flex gap-2 overflow-x-auto px-4">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={current === t.href ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${
            current === t.href ? "bg-ink text-card border-ink" : "border-line bg-card"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
