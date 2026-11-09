import { Icon, type IconName } from "./Icon";

/**
 * Estado de un turno (design §22.3): siempre ícono + texto + color. Solo "Llamado" va en rojo
 * relleno, porque pide atención ahora (REQ-078.3).
 */
export type ChipStatus =
  "waiting" | "called" | "in_service" | "done" | "cancelled" | "no_show" | "appointment";

const CHIP: Record<ChipStatus, { icon: IconName; label: string; look: string }> = {
  waiting: {
    icon: "clock",
    label: "En espera",
    look: "border border-line-strong bg-card text-ink",
  },
  called: { icon: "bell", label: "Llamado", look: "bg-called text-accent-ink" },
  in_service: { icon: "scissors", label: "En servicio", look: "bg-brand text-brand-ink" },
  done: { icon: "check", label: "Terminado", look: "bg-ok-soft text-ok" },
  cancelled: {
    icon: "x",
    label: "Cancelado",
    look: "border border-line-strong bg-card text-muted",
  },
  no_show: { icon: "alert", label: "No vino", look: "bg-warn-soft text-warn" },
  appointment: { icon: "calendar", label: "Cita", look: "border-2 border-ink bg-card text-ink" },
};

/** `label` cambia solo el texto (p. ej. "Cita cancelada" en Mi cita); ícono y color se quedan. */
export function StatusChip({
  status,
  time,
  label,
}: {
  status: ChipStatus;
  time?: string;
  label?: string;
}) {
  const c = CHIP[status];
  return (
    <span
      className={`inline-flex h-7 shrink-0 items-center gap-1.5 rounded-xs px-2 text-sm font-semibold whitespace-nowrap ${c.look}`}
    >
      <Icon name={c.icon} className="size-4" />
      {label ?? (status === "appointment" && time ? `${c.label} ${time}` : c.label)}
    </span>
  );
}
