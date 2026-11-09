import type { InputHTMLAttributes } from "react";

/**
 * Interruptor del tablero Dueno-Config (design §22.8): una casilla con `role="switch"` dibujada
 * como palanca, azul marino encendida. El área que se toca mide 48 px aunque la palanca sea chica.
 */
export function Switch({
  label,
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "role"> & { label: string }) {
  return (
    <label className={`inline-flex min-h-12 min-w-12 cursor-pointer items-center ${className}`}>
      <input
        type="checkbox"
        role="switch"
        aria-label={label}
        className="bg-line-strong checked:bg-brand focus-visible:outline-brand relative h-7 w-12 shrink-0 cursor-pointer appearance-none rounded-full transition-colors before:absolute before:top-1 before:left-1 before:size-5 before:rounded-full before:bg-white before:shadow-sm before:transition-transform checked:before:translate-x-5 focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none motion-reduce:before:transition-none"
        {...props}
      />
    </label>
  );
}
