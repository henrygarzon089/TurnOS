/**
 * Encabezado de un módulo del dueño (tableros Dueno-Local y Dueno-Config): título, para qué sirve
 * y, si hay, la acción principal de la pantalla a la derecha (la única rellena, REQ-078.4).
 */
export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <header className="border-ink flex flex-wrap items-end justify-between gap-3 border-b-2 pb-3">
      <div className="min-w-0">
        <h1 className="text-[1.75rem] leading-tight font-bold">{title}</h1>
        {subtitle && <p className="text-muted mt-1 text-sm">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

/** Tarjeta de sección: borde `line`, sin sombra (design §22.1). */
export function Panel({
  title,
  action,
  children,
  className = "",
  ...rest
}: {
  title?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <section className={`border-line bg-card rounded-md border ${className}`} {...rest}>
      {(title || action) && (
        <div className="border-line flex min-h-14 items-center justify-between gap-3 border-b px-4 py-2">
          {title && <h2 className="text-lg font-bold">{title}</h2>}
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
