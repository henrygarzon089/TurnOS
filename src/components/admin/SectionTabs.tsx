import Link from "next/link";

/**
 * Pestañas de un módulo del dueño (tablero Dueno-Local): texto con raya azul marino debajo de la
 * activa, sin píldoras (design §22.1). Se desplazan de lado dentro de su franja si no caben.
 */
export function SectionTabs({
  label,
  tabs,
  current,
}: {
  label: string;
  tabs: { href: string; label: string; count?: number }[];
  current: string;
}) {
  return (
    <nav
      aria-label={label}
      className="border-line -mx-4 mt-3 flex overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
    >
      {tabs.map((t) => {
        const active = t.href === current;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-3 text-base whitespace-nowrap ${
              active
                ? "border-brand text-ink font-bold"
                : "text-muted border-transparent font-semibold"
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="tabular-nums">· {t.count}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
