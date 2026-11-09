"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";
import { Icon } from "@/components/ui/Icon";
import { Sheet } from "@/components/ui/Sheet";
import { Toast } from "@/components/ui/Toast";
import { signOut } from "@/lib/actions/auth";
import {
  BARBER_MORE,
  BARBER_TABS,
  isBarberActive,
  isBarberMoreActive,
  type BarberLink,
} from "@/lib/domain/barber-nav";

/**
 * Barra inferior del barbero (T-163, T-169, tablero Barbero-Fila): Mi fila, Clientes, Números,
 * Limpieza y "Más", cada uno con su ícono encima. Destinos de 56 px (REQ-078.5); el actual con raya
 * arriba y texto en `brand`. "Más" abre una hoja con Mis fotos, Mi estación, "Nueva venta" y
 * "Salir" (ADR-051). `cleaningDot` es el punto rojo de Limpieza cuando falta la apertura.
 */
export function BarberNav({ cleaningDot }: { cleaningDot?: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [more, setMore] = useState(false);
  const [sale, setSale] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const closeMore = useCallback(() => setMore(false), []);
  const closeNotice = useCallback(() => setNotice(null), []);
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
                <span className="relative">
                  {it.icon && <Icon name={it.icon} className="size-5" />}
                  {it.href === "/app/limpieza" && cleaningDot}
                </span>
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
              <Icon name="more" className="size-5" />
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
                className={`border-line flex min-h-14 items-center border-b text-base ${
                  current(it) ? "text-brand font-semibold" : "text-ink"
                }`}
              >
                {it.label}
              </Link>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={() => {
                setMore(false);
                setNotice(null);
                setSale(true);
              }}
              className="border-line text-ink flex min-h-14 w-full items-center border-b text-base"
            >
              + Nueva venta
            </button>
          </li>
          <li>
            <form action={signOut}>
              <button
                type="submit"
                className="text-danger flex min-h-14 w-full items-center text-base font-semibold"
              >
                Salir
              </button>
            </form>
          </li>
        </ul>
      </Sheet>

      {sale && (
        <CheckoutSheet
          ticketId={null}
          onClose={() => setSale(false)}
          onDone={(msg) => {
            setSale(false);
            setNotice(msg);
            router.refresh();
          }}
        />
      )}
      {notice && (
        <div className="fixed inset-x-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 mx-auto max-w-md">
          <Toast onClose={closeNotice}>{notice}</Toast>
        </div>
      )}
    </>
  );
}

function tabClass(active: boolean) {
  return `relative flex h-14 flex-col items-center justify-center gap-0.5 px-1 text-xs font-semibold ${
    active
      ? "text-brand before:bg-brand before:absolute before:inset-x-3 before:top-0 before:h-0.5"
      : "text-muted"
  }`;
}
