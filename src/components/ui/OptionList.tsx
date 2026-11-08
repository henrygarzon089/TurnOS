"use client";

/**
 * Elegir una opción: servicio, barbero, medio de pago (design §22.3). La elegida lleva borde de
 * 2 px azul marino, fondo `brand-soft` y la marca redonda llena: nunca solo el color.
 * Es un grupo de radios de verdad, así funciona con teclado y lector de pantalla.
 */
export type Option = {
  value: string;
  label: string;
  /** Línea pequeña debajo: "30 min", "3 esperan · ~ 40 min". */
  meta?: string;
  /** A la derecha: "$ 25.000". */
  aside?: string;
  disabled?: boolean;
};

export function OptionList({
  name,
  legend,
  options,
  value,
  onChange,
  layout = "list",
}: {
  name: string;
  legend: string;
  options: Option[];
  value: string | null;
  onChange: (value: string) => void;
  /** `list`: filas a lo ancho. `grid`: botones en rejilla de 3 (medios de pago). */
  layout?: "list" | "grid";
}) {
  return (
    <fieldset>
      <legend className="text-ink mb-2 text-sm font-semibold">{legend}</legend>
      <div className={layout === "grid" ? "grid grid-cols-3 gap-2" : "flex flex-col gap-2"}>
        {options.map((o) => {
          const on = o.value === value;
          const look = o.disabled
            ? "border border-line bg-surface text-muted"
            : on
              ? "border-2 border-brand bg-brand-soft text-ink"
              : "border border-line-strong bg-card text-ink";
          return (
            <label
              key={o.value}
              className={`has-focus-visible:outline-brand flex min-h-12 cursor-pointer items-center gap-3 rounded-sm px-3 py-2 has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-disabled:cursor-not-allowed ${layout === "grid" ? "justify-center text-center" : ""} ${look}`}
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              {layout === "list" && (
                <span
                  aria-hidden="true"
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${on ? "border-brand" : "border-line-strong"}`}
                >
                  {on && <span className="bg-brand size-2.5 rounded-full" />}
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block text-base font-semibold">{o.label}</span>
                {o.meta && <span className="text-muted block text-sm">{o.meta}</span>}
              </span>
              {o.aside && <span className="text-base font-semibold tabular-nums">{o.aside}</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
