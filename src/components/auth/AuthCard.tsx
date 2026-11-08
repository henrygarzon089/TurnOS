/**
 * Marco de las pantallas de acceso (tablero Acceso): en el celular ocupa el ancho; en escritorio
 * es una tarjeta centrada sobre el fondo. Arriba la marca "TurnOS" en texto (REQ-078.14).
 */
export function AuthCard({
  title,
  subtitle,
  eyebrow,
  children,
  footer,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Va encima del título: la marca del negocio o "Paso 1 de 3". */
  eyebrow?: React.ReactNode;
  children: React.ReactNode;
  /** Va debajo de la tarjeta (enlaces a otra pantalla de acceso). */
  footer?: React.ReactNode;
}) {
  return (
    <main className="sm:bg-surface flex w-full flex-1 flex-col items-center px-4 py-8 sm:justify-center sm:py-12">
      <div
        data-testid="auth-card"
        className="sm:border-line sm:bg-card w-full max-w-md sm:rounded-lg sm:border sm:p-8"
      >
        <p className="text-ink flex items-center gap-2 text-base font-bold">
          <span aria-hidden="true" className="bg-brand size-2 rounded-xs" />
          TurnOS
        </p>
        {eyebrow && <div className="mt-6">{eyebrow}</div>}
        <h1 className={`${eyebrow ? "mt-2" : "mt-6"} text-2xl font-bold break-words`}>{title}</h1>
        {subtitle && <div className="text-muted mt-1">{subtitle}</div>}
        {children}
      </div>
      {footer && <div className="mt-6 w-full max-w-md text-center">{footer}</div>}
    </main>
  );
}
