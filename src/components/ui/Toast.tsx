"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";

/**
 * Aviso emergente (design §22.3): sube desde abajo (`animate-enter`). El de éxito se va solo a
 * los 4 s y puede traer "Deshacer"; el de error se queda hasta que lo cierren.
 */
export function Toast({
  tone = "ok",
  children,
  action,
  onClose,
}: {
  tone?: "ok" | "error";
  children: React.ReactNode;
  /** Botón de texto a la derecha, p. ej. { label: "Deshacer", onClick }. */
  action?: { label: string; onClick: () => void };
  onClose: () => void;
}) {
  useEffect(() => {
    if (tone !== "ok") return;
    const id = setTimeout(onClose, 4000);
    return () => clearTimeout(id);
  }, [tone, onClose]);

  const look =
    tone === "ok" ? "bg-brand text-brand-ink" : "bg-card text-danger border-2 border-danger";
  return (
    <div
      role={tone === "ok" ? "status" : "alert"}
      className={`animate-enter shadow-overlay flex min-h-12 items-center gap-3 rounded-md px-4 py-3 text-base ${look}`}
    >
      <Icon name={tone === "ok" ? "check" : "error"} />
      <div className="min-w-0 flex-1">{children}</div>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="min-h-12 px-1 font-semibold underline underline-offset-4"
        >
          {action.label}
        </button>
      )}
      {tone === "error" && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="-mr-2 flex size-12 items-center justify-center"
        >
          <Icon name="x" />
        </button>
      )}
    </div>
  );
}
