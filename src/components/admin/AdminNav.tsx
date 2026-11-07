"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import {
  ADMIN_GROUPS,
  ADMIN_TABS,
  isActiveLink,
  isMoreActive,
  type AdminLink,
} from "@/lib/domain/admin-nav";

/**
 * Menú del dueño (REQ-077, design §21.4). Celular: barra inferior fija con lo de todos los días y
 * "Más", que abre los grupos en una hoja. 1024 px o más: menú lateral fijo de 240 px con los mismos
 * grupos. Se monta una vez en el layout del personal, solo para el dueño.
 */
export function AdminNav() {
  const pathname = usePathname();
  const [more, setMore] = useState(false);
  const closeMore = useCallback(() => setMore(false), []);
  const current = (link: AdminLink) => (isActiveLink(pathname, link) ? "page" : undefined);

  return (
    <>
      <nav
        aria-label="Menú del dueño"
        className="border-line bg-card fixed inset-y-0 left-0 z-20 hidden w-60 flex-col gap-5 overflow-y-auto border-r px-3 py-5 lg:flex"
      >
        {ADMIN_GROUPS.map((group) => (
          <section key={group.label}>
            <h2 className="text-muted px-3 pb-1 text-xs font-bold tracking-wider uppercase">
              {group.label}
            </h2>
            <ul>
              {group.items.map((it) => (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={current(it)}
                    className={`flex min-h-12 items-center rounded-sm px-3 text-base ${
                      current(it)
                        ? "bg-brand-soft text-brand font-semibold shadow-[inset_3px_0_0_var(--color-brand)]"
                        : "text-ink hover:bg-surface"
                    }`}
                  >
                    {it.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </nav>

      <nav
        aria-label="Accesos rápidos"
        className="border-line bg-card fixed inset-x-0 bottom-0 z-20 border-t pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5">
          {ADMIN_TABS.map((it) => (
            <li key={it.href}>
              <Link href={it.href} aria-current={current(it)} className={tabClass(!!current(it))}>
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
              className={`${tabClass(isMoreActive(pathname))} w-full`}
            >
              Más
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={more} onClose={closeMore} title="Todo el menú">
        {ADMIN_GROUPS.map((group) => (
          <section key={group.label}>
            <h3 className="text-muted pb-1 text-xs font-bold tracking-wider uppercase">
              {group.label}
            </h3>
            <ul className="grid grid-cols-2 gap-x-3">
              {group.items.map((it) => (
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
          </section>
        ))}
      </Sheet>
    </>
  );
}

/** Destino de la barra: 56 px de alto; el actual con raya arriba y texto en `brand`. */
function tabClass(active: boolean) {
  return `relative flex h-14 min-h-12 items-center justify-center text-sm font-semibold ${
    active
      ? "text-brand before:bg-brand before:absolute before:inset-x-3 before:top-0 before:h-0.5"
      : "text-muted"
  }`;
}
