"use client";

import { useId, useState } from "react";
import { Icon } from "./Icon";

/**
 * PIN de 6 dígitos (REQ-078.7, design §22.3): seis casillas que muestran un punto por dígito,
 * nunca el dígito. Un solo `<input type="password">` invisible encima recibe el teclado
 * numérico; las casillas son solo dibujo.
 */
export function PinField({
  label,
  value,
  onChange,
  error,
  hint,
  length = 6,
  disabled,
  name,
}: {
  label: string;
  /** Nombre del campo en un `<form action>`; sin él, el PIN solo vive en el estado. */
  name?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  length?: number;
  disabled?: boolean;
}) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const described = error || hint ? `${id}-msg` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-ink text-sm font-semibold">
        {label}
      </label>
      <div className="relative w-fit">
        <div data-testid="pin-cells" aria-hidden="true" className="flex gap-2">
          {Array.from({ length }, (_, i) => {
            const filled = i < value.length;
            const current = focused && i === Math.min(value.length, length - 1);
            const border = error
              ? "border-danger"
              : current
                ? "border-brand border-2"
                : "border-line-strong";
            return (
              <span
                key={i}
                className={`bg-card text-ink flex h-12 w-11 items-center justify-center rounded-sm border text-base leading-none ${border}`}
              >
                {filled ? "●" : ""}
              </span>
            );
          })}
        </div>
        <input
          id={id}
          name={name}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="\d*"
          maxLength={length}
          disabled={disabled}
          value={value}
          aria-invalid={error ? true : undefined}
          aria-describedby={described}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
          className="absolute inset-0 h-full w-full cursor-text opacity-0"
        />
      </div>
      {error ? (
        <p
          id={`${id}-msg`}
          role="alert"
          className="text-danger flex items-center gap-1.5 text-sm font-medium"
        >
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
