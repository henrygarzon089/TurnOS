/** REQ-038.5: bebida del turno en las filas del barbero y del dueño. Servida no se desmarca. */
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
      <span className="min-w-0 font-medium break-words">🥤 {name}</span>
      {served ? (
        <span className="text-ok shrink-0 text-sm font-semibold">Servida ✓</span>
      ) : (
        <button
          type="button"
          className="border-line flex min-h-12 shrink-0 items-center rounded-full border px-4 text-sm font-semibold disabled:opacity-50"
          disabled={disabled}
          onClick={onServe}
        >
          Servida ✓
        </button>
      )}
    </div>
  );
}
