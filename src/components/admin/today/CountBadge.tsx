/**
 * Insignia de conteo en rojo relleno: "atención ahora" (REQ-078.3). Es el único archivo de "Hoy"
 * en `ACCENT_FILL_ALLOWED`. El número se lee junto al texto de al lado ("Hoy 4", "Piden tu
 * atención 4"); `label` lo explica a lectores de pantalla.
 */
export function CountBadge({
  count,
  label,
  testId,
}: {
  count: number;
  label: string;
  testId?: string;
}) {
  return (
    <span
      data-testid={testId}
      aria-label={`${count} ${label}`}
      className="bg-accent text-accent-ink inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs leading-none font-bold tabular-nums"
    >
      {count}
    </span>
  );
}
