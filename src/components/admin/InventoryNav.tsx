import Link from "next/link";

const TABS = [
  { href: "/admin/inventario", label: "Resumen" },
  { href: "/admin/inventario/catalogo", label: "Catálogo" },
];

/** Pestañas de /admin/inventario (design.md §18.6). */
export function InventoryNav({ current }: { current: string }) {
  return (
    <nav aria-label="Inventario" className="mt-2 flex gap-2">
      {TABS.map((t) => (
        <Link
          key={t.href}
          href={t.href}
          aria-current={current === t.href ? "page" : undefined}
          className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold ${
            current === t.href ? "bg-ink text-card border-ink" : "border-line bg-card"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
