import { Icon } from "@/components/ui/Icon";

/**
 * REQ-038.5: bebida del turno en las filas del barbero y del dueño. Servida no se desmarca.
 * La taza es SVG de trazo (REQ-078.14), no el emoji.
 */
export function CourtesyLine({
  name,
  served,
  disabled,
  onServe,
}: {
  name: string;
  served: boolean;
  disabled: boolean;
  onServe: () => void;
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-3">
      <span className="flex min-w-0 items-center gap-1.5 font-medium break-words">
        <Icon name="cup" className="size-5" />
        {name}
      </span>
      {served ? (
        <span className="text-ok shrink-0 text-sm font-semibold">Servida ✓</span>
      ) : (
        <button
          type="button"
          className="border-line-strong flex min-h-12 shrink-0 items-center rounded-md border px-4 text-sm font-semibold disabled:opacity-50"
          disabled={disabled}
          onClick={onServe}
        >
          Servida ✓
        </button>
      )}
    </div>
  );
}
