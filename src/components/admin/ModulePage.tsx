import { useId } from "react";

/**
 * Piezas de los módulos del dueño (T-166, tableros Dueno-Operacion y Dueno-Clientes): título con
 * su bajada y raya, paneles con borde (sin sombra) y etiquetas de estado sin píldoras.
 */
export function ModuleHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  /** Lo que va a la derecha del título (un enlace o un botón). */
  children?: React.ReactNode;
}) {
  return (
    <header className="border-ink flex flex-wrap items-end justify-between gap-x-4 gap-y-2 border-b-2 pb-3">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-[28px] leading-tight font-bold">{title}</h1>
        {subtitle && <p className="text-muted text-sm">{subtitle}</p>}
      </div>
      {children}
    </header>
  );
}

/** Panel con encabezado (título + lo de la derecha) y contenido. Es una región con nombre. */
export function Panel({
  title,
  label,
  actions,
  children,
  className = "",
}: {
  title?: React.ReactNode;
  /** Nombre de la región cuando el título no es texto plano. */
  label?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section
      aria-labelledby={label ? undefined : title ? id : undefined}
      aria-label={label}
      className={`bg-card border-line min-w-0 rounded-md border ${className}`}
    >
      {(title || actions) && (
        <div className="border-line flex min-h-14 flex-wrap items-center justify-between gap-2 border-b px-4 py-2">
          {typeof title === "string" ? (
            <h2 id={id} className="text-lg font-bold">
              {title}
            </h2>
          ) : (
            <div id={id} className="flex min-w-0 items-center gap-2">
              {title}
            </div>
          )}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

type Tone = "ok" | "warn" | "muted" | "outline";

const TONE: Record<Tone, string> = {
  ok: "bg-ok-soft text-ok",
  warn: "bg-warn-soft text-warn",
  muted: "bg-surface text-muted",
  outline: "border border-ink text-ink",
};

/** Etiqueta de estado (esquina `xs`, nunca píldora). Nunca roja: no es "atención ahora". */
export function Tag({ tone = "muted", children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex h-6 shrink-0 items-center rounded-xs px-2 text-xs font-bold whitespace-nowrap ${TONE[tone]}`}
    >
      {children}
    </span>
  );
}

/** Rótulo de grupo dentro de un panel ("ANDRÉS · 3", "A PAGAR"). */
export function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="bg-surface text-muted px-4 py-2 text-xs font-bold tracking-wide uppercase">
      {children}
    </p>
  );
}
