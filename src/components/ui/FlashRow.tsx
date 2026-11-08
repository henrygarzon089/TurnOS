/**
 * Fila que llegó por tiempo real (REQ-078.12): entra con fondo `flash` que se desvanece en 1,2 s.
 * No mueve nada: quien la usa la agrega al final o donde ya estaba, nunca reordena lo que la
 * persona tiene bajo el dedo.
 */
export function FlashRow({
  flash = false,
  className = "",
  children,
}: {
  flash?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={`${flash ? "animate-flash" : ""} ${className}`}>{children}</div>;
}
