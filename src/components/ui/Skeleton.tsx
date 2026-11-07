/**
 * REQ-075.1 / REQ-075.2 (design §19.1): esqueletos de carga. Bloques grises con la forma de la
 * pantalla, sin datos ni texto; solo pulsan si el celular no pide menos movimiento.
 */
export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`bg-line rounded-md motion-safe:animate-pulse ${className}`}
    />
  );
}

/** Contenedor que anuncia "Cargando…" a lectores de pantalla. */
export function SkeletonScreen({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div aria-busy="true" className={className}>
      <span className="sr-only">Cargando…</span>
      {children}
    </div>
  );
}
