/**
 * REQ-035.1 / REQ-035.2: lista de casillas para "Servicios que hace" y "Quién lo hace".
 * El campo oculto `<shown>` le dice a la acción que la lista se mostró (si no, no toca la relación).
 */
export function CheckList({
  legend,
  name,
  shown,
  options,
  checked,
}: {
  legend: string;
  name: string;
  shown: string;
  options: { id: string; label: string }[];
  /** null = todos marcados (nuevo) */
  checked: string[] | null;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="min-w-0">
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <input type="hidden" name={shown} value="1" />
      <div className="flex flex-wrap gap-x-4">
        {options.map((o) => (
          <label key={o.id} className="flex min-h-12 items-center gap-2 text-sm">
            <input
              type="checkbox"
              name={name}
              value={o.id}
              defaultChecked={checked === null || checked.includes(o.id)}
              className="h-5 w-5"
            />
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
