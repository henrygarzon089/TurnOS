import { useId } from "react";
import { Icon } from "./Icon";

/**
 * Campo con etiqueta arriba, ayuda o error abajo (design §22.3). El error dice qué pasó con
 * texto e ícono, nunca solo con color; el campo queda `aria-invalid` y el texto lo describe.
 */
export const FIELD_INPUT =
  "min-h-12 w-full rounded-md border bg-card px-3 text-base text-ink outline-none placeholder:text-muted focus:border-2 focus:border-brand focus:ring-2 focus:ring-brand-soft disabled:bg-surface disabled:text-muted";

export type FieldProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "prefix"> & {
  label: string;
  hint?: string;
  error?: string;
  /** Lo que va pegado a la izquierda dentro del borde: "+57", "$". */
  prefix?: string;
};

export function FieldFrame({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-semibold">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-msg`} className="text-danger flex items-center gap-1.5 text-sm font-medium">
          <Icon name="error" className="size-4" />
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-msg`} className="text-muted text-sm">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Field({ label, hint, error, prefix, id, className = "", ...input }: FieldProps) {
  const auto = useId();
  const fid = id ?? auto;
  const border = error ? "border-danger" : "border-line-strong";
  const described = error || hint ? `${fid}-msg` : undefined;
  return (
    <FieldFrame id={fid} label={label} hint={hint} error={error}>
      {prefix ? (
        <div
          className={`bg-card focus-within:border-brand focus-within:ring-brand-soft flex min-h-12 items-stretch overflow-hidden rounded-md border focus-within:border-2 focus-within:ring-2 ${border}`}
        >
          <span className="text-ink border-line bg-surface flex items-center border-r px-3 text-base font-semibold">
            {prefix}
          </span>
          <input
            id={fid}
            aria-invalid={error ? true : undefined}
            aria-describedby={described}
            className={`text-ink placeholder:text-muted w-full min-w-0 bg-transparent px-3 text-base outline-none ${className}`}
            {...input}
          />
        </div>
      ) : (
        <input
          id={fid}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          className={`${FIELD_INPUT} ${border} ${className}`}
          {...input}
        />
      )}
    </FieldFrame>
  );
}
