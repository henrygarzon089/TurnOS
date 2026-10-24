import Link from "next/link";

const ITEMS: { href: string; label: string }[] = [
  { href: "/admin/fila", label: "Fila" },
  { href: "/admin/caja", label: "Caja" },
  { href: "/app/clientes", label: "Clientes" },
  { href: "/admin/servicios", label: "Servicios" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/barberos", label: "Barberos" },
  { href: "/admin/horario", label: "Horario" },
  { href: "/admin/qr", label: "QR" },
  { href: "/admin/mensajes", label: "Mensajes" },
  { href: "/admin/negocio", label: "Negocio" },
  { href: "/admin/privacidad", label: "Privacidad" },
];

/** Menú del dueño: chips desplazables, pensado para pulgar (NFR-008). */
export function AdminNav({ current }: { current: string }) {
  return (
    <nav aria-label="Administración" className="-mx-4 overflow-x-auto px-4 py-3">
      <ul className="flex gap-2">
        {ITEMS.map((it) => {
          const active = current.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-10 items-center rounded-full border px-4 text-sm font-semibold whitespace-nowrap ${
                  active ? "bg-ink text-card border-ink" : "border-line bg-card text-ink"
                }`}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
