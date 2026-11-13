"use client";

import { useId, useState } from "react";

/**
 * Control segmentado del tablero Barbero-Otros (Hoy / Semana / Mes, Apertura / Cierre / Profunda):
 * pestañas de 48 px a todo el ancho; la elegida en `brand`. Los paneles se montan todos y se
 * esconden con `hidden` (lectura en una sola consulta, REQ-078.16).
 */
export function Segmented({
  label,
  tabs,
  initial = 0,
  onChange,
}: {
  label: string;
  tabs: { name: string; panel: React.ReactNode }[];
  initial?: number;
  onChange?: (i: number) => void;
}) {
  const [active, setActive] = useState(initial);
  const id = useId();
  function pick(i: number) {
    setActive(i);
    onChange?.(i);
  }
  function key(e: React.KeyboardEvent, i: number) {
    const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (i + d + tabs.length) % tabs.length;
    pick(next);
    document.getElementById(`${id}-tab-${next}`)?.focus();
  }
  return (
    <>
      <div
        role="tablist"
        aria-label={label}
        className="border-line-strong mx-4 grid overflow-hidden rounded-md border"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t, i) => (
          <button
            key={t.name}
            id={`${id}-tab-${i}`}
            type="button"
            role="tab"
            aria-selected={i === active}
            aria-controls={`${id}-panel-${i}`}
            tabIndex={i === active ? 0 : -1}
            onClick={() => pick(i)}
            onKeyDown={(e) => key(e, i)}
            className={`desk:min-h-10 min-h-12 text-sm font-semibold transition-colors ${
              i > 0 ? "border-line-strong border-l" : ""
            } ${i === active ? "bg-brand text-brand-ink" : "bg-card text-ink"}`}
          >
            {t.name}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.name}
          id={`${id}-panel-${i}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${i}`}
          hidden={i !== active}
        >
          {t.panel}
        </div>
      ))}
    </>
  );
}
