import Link from "next/link";
import { businessMark } from "@/lib/domain/public-view";

/**
 * Encabezado de las pantallas del cliente (tablero Cliente-Negocio): cuadro azul marino con la
 * marca del negocio (REQ-078.14, sin logo descargado), nombre y una línea de estado. `back` pone
 * la flecha de volver en lugar del cuadro (reservar cita, privacidad). `aside` va a la derecha.
 * El nombre es el `h1` de la página.
 */
export function PublicHeader({
  name,
  subtitle,
  back,
  aside,
}: {
  name: string;
  subtitle?: React.ReactNode;
  back?: { href: string; label: string };
  aside?: React.ReactNode;
}) {
  return (
    <header className="border-line bg-card flex min-h-16 items-center gap-3 border-b px-4 py-3">
      {back ? (
        <Link
          href={back.href}
          aria-label={back.label}
          className="text-ink -ml-2 flex size-12 shrink-0 items-center justify-center rounded-md"
        >
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="size-6"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 5-7 7 7 7" />
          </svg>
        </Link>
      ) : (
        <span
          aria-hidden="true"
          className="bg-brand text-brand-ink flex size-12 shrink-0 items-center justify-center rounded-md text-lg font-bold tabular-nums"
        >
          {businessMark(name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-lg leading-tight font-bold">{name}</h1>
        {subtitle && <p className="text-muted truncate text-sm">{subtitle}</p>}
      </div>
      {aside}
    </header>
  );
}
