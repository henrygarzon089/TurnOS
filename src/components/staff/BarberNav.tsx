"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import {
  BARBER_MORE,
  BARBER_TABS,
  isBarberActive,
  isBarberMoreActive,
  type BarberLink,
} from "@/lib/domain/barber-nav";

/**
 * Barra inferior del barbero (T-163, tablero Barbero-Fila): Mi fila, Clientes, Números, Limpieza y
 * "Más" (Mis fotos, Mi estación) en una hoja. Destinos de 56 px (REQ-078.5); el actual con raya
 * arriba y texto en `brand`, igual que la del dueño.
 */
export function BarberNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const closeMore = useCallback(() => setMore(false), []);
  const current = (link: BarberLink) => (isBarberActive(pathname, link) ? "page" : undefined);

  return (
    <>
      <nav
        aria-label="Menú del barbero"
        className="border-line bg-card fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {BARBER_TABS.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-label={it.name}
                aria-current={current(it)}
                className={tabClass(!!current(it))}
              >
                {it.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={more}
              onClick={() => setMore(true)}
              className={`${tabClass(isBarberMoreActive(pathname))} w-full`}
            >
              Más
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={more} onClose={closeMore} title="Más">
        <ul>
          {BARBER_MORE.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={current(it)}
                onClick={closeMore}
                className={`border-line flex min-h-12 items-center border-b text-base ${
                  current(it) ? "text-brand font-semibold" : "text-ink"
                }`}
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}

function tabClass(active: boolean) {
  return `relative flex h-14 items-center justify-center px-1 text-sm font-semibold ${
    active
      ? "text-brand before:bg-brand before:absolute before:inset-x-3 before:top-0 before:h-0.5"
      : "text-muted"
  }`;
}
