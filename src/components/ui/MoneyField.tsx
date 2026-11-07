"use client";

import { formatCOP, parseCOP } from "@/lib/domain/money";
import { Field, type FieldProps } from "./Field";

/**
 * Pesos sin decimales, con "$" fijo y la cifra a la derecha (design §22.3). Guarda enteros
 * (constitution P5): `null` mientras está vacío o no es un monto válido.
 */
export function MoneyField({
  value,
  onChange,
  ...rest
}: Omit<FieldProps, "value" | "onChange" | "prefix" | "type"> & {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <Field
      {...rest}
      prefix="$"
      inputMode="numeric"
      className="text-right tabular-nums"
      value={value === null ? "" : formatCOP(value).replace("$ ", "")}
      onChange={(e) => onChange(parseCOP(e.target.value.replace(/\./g, "")))}
    />
  );
}
