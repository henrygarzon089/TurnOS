"use client";

import { formatPhoneTyping, type PhoneCountry } from "@/lib/domain/phone";
import { Field, type FieldProps } from "./Field";

/**
 * Celular colombiano con "+57" fijo y grupos `300 100 0001` mientras se escribe (design §22.3).
 * El valor sale con espacios; se normaliza con `normalizePhoneCO` al guardar (REQ-003.2).
 * Con `country="other"` (solo barberos, REQ-081.4) no hay prefijo fijo: se escribe el número con
 * su indicativo y no se reformatea.
 */
export function PhoneField({
  value,
  onChange,
  country = "co",
  ...rest
}: Omit<FieldProps, "value" | "onChange" | "prefix" | "type"> & {
  value: string;
  onChange: (value: string) => void;
  country?: PhoneCountry;
}) {
  if (country === "other") {
    return (
      <Field
        {...rest}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={rest.placeholder ?? "+54 9 11 2345 6789"}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d\s\-()+]/g, "").slice(0, 24))}
      />
    );
  }
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
