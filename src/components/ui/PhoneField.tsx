"use client";

import { formatPhoneTyping } from "@/lib/domain/phone";
import { Field, type FieldProps } from "./Field";

/**
 * Celular colombiano con "+57" fijo y grupos `300 100 0001` mientras se escribe (design §22.3).
 * El valor sale con espacios; se normaliza con `normalizePhoneCO` al guardar (REQ-003.2).
 */
export function PhoneField({
  value,
  onChange,
  ...rest
}: Omit<FieldProps, "value" | "onChange" | "prefix" | "type"> & {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field
      {...rest}
      prefix="+57"
      type="tel"
      inputMode="tel"
      autoComplete="tel-national"
      placeholder={rest.placeholder ?? "300 123 4567"}
      value={value}
      onChange={(e) => onChange(formatPhoneTyping(e.target.value))}
    />
  );
}
