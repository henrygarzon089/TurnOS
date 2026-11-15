"use client";

import { useId, useState } from "react";
import { descriptionLength } from "@/lib/domain/description";

/**
 * REQ-096.1 / REQ-097.1 (design §29.3): descripción opcional con ayuda y contador "N/max". El
 * `maxLength` del navegador es solo una ayuda; la regla la ponen el servidor y la base de datos.
 */
export function DescriptionField({
  label,
  help,
  max,
  defaultValue,
}: {
  label: string;
  help: string;
  max: number;
  defaultValue?: string | null;
}) {
  const id = useId();
  const [count, setCount] = useState(descriptionLength(defaultValue ?? ""));
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
      </label>
      <textarea
        id={id}
        name="description"
        rows={3}
        maxLength={max}
        defaultValue={defaultValue ?? ""}
        aria-describedby={`${id}-help ${id}-count`}
        onChange={(e) => setCount(descriptionLength(e.currentTarget.value))}
        className="input min-h-24 py-2"
      />
      <span className="text-muted flex justify-between gap-3 text-sm">
        <span id={`${id}-help`}>{help}</span>
        <span id={`${id}-count`} aria-live="polite" className="shrink-0 tabular-nums">
          {count}/{max}
        </span>
      </span>
    </div>
  );
}
