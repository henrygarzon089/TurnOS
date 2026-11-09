import { hourOptions } from "@/lib/domain/hours";

/**
 * Selector de hora propio (REQ-078.20, REQ-078.33): un `select` con las horas en español cada 15
 * minutos ("9:00 a. m."), en vez de `input type="time"`, que el navegador muestra en inglés.
 */
export function TimeSelect({
  name,
  label,
  value,
  onChange,
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const v = value.slice(0, 5);
  return (
    <select
      name={name}
      aria-label={label}
      value={v}
      onChange={(e) => onChange(e.target.value)}
      className="input text-ink min-w-0 tabular-nums"
    >
      {hourOptions([v]).map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
