"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * Botón del sistema visual (design §22.3, tablero Componentes).
 * - `primary`: azul marino relleno; uno solo por pantalla (REQ-078.4).
 * - `secondary`: contorno. `danger`: contorno rojo, nunca relleno, y siempre detrás de una
 *   confirmación (REQ-078.3). `text`: enlace subrayado con área de toque de 48 px.
 * - `giant`: 80 px para el botón principal de la fila del barbero (REQ-078.5).
 * - `pending`: deshabilitado con "Guardando…" (REQ-078.9).
 */
type Variant = "primary" | "secondary" | "danger" | "text";

const BASE =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-md font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:cursor-not-allowed";

const VARIANT: Record<Variant, { idle: string; disabled: string; pending: string }> = {
  primary: {
    idle: "bg-brand text-brand-ink px-5 active:opacity-90",
    disabled: "bg-skeleton text-muted px-5",
    pending: "bg-brand text-brand-ink px-5 opacity-75",
  },
  secondary: {
    idle: "border border-line-strong bg-card text-ink px-5 active:bg-surface",
    disabled: "border border-line bg-surface text-muted px-5",
    pending: "border border-line-strong bg-card text-muted px-5",
  },
  danger: {
    idle: "border border-danger bg-card text-danger px-5 active:bg-accent-soft",
    disabled: "border border-line bg-surface text-muted px-5",
    pending: "border border-danger bg-card text-danger px-5 opacity-75",
  },
  text: {
    idle: "text-brand px-1 underline underline-offset-4",
    disabled: "text-muted px-1 underline underline-offset-4",
    pending: "text-muted px-1 underline underline-offset-4",
  },
};

export type ButtonProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick"> & {
  variant?: Variant;
  size?: "md" | "giant";
  pending?: boolean;
  pendingText?: string;
  /** Acción asíncrona: mientras corre, el botón queda en "Guardando…" y no se repite. */
  onAction?: () => Promise<unknown>;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
};

/**
 * Candado para acciones asíncronas: mientras una corre, las demás llamadas se ignoran
 * (REQ-078.9). Un toque doble o un "Cobrar" repetido no envía dos veces.
 */
export function createOnceGuard() {
  let running = false;
  return async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (running) return undefined;
    running = true;
    try {
      return await action();
    } finally {
      running = false;
    }
  };
}

export function Button({
  variant = "primary",
  size = "md",
  pending = false,
  pendingText = "Guardando…",
  onAction,
  onClick,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const [running, setRunning] = useState(false);
  const [guard] = useState(createOnceGuard);
  const busy = pending || running;
  const v = VARIANT[variant];
  const look = busy ? v.pending : disabled ? v.disabled : v.idle;
  const sizing = size === "giant" ? "min-h-20 w-full text-xl font-bold" : "text-lg";

  async function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    onClick?.(e);
    if (!onAction || e.defaultPrevented) return;
    await guard(async () => {
      setRunning(true);
      try {
        await onAction();
      } finally {
        setRunning(false);
      }
    });
  }

  return (
    <button
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={handleClick}
      className={`${BASE} ${look} ${sizing} ${className}`}
      {...rest}
    >
      {busy ? pendingText : children}
    </button>
  );
}

/** Botón de envío de un `<form action>`: toma "guardando" del formulario (REQ-078.9). */
export function SubmitButton(props: Omit<ButtonProps, "type" | "pending" | "onAction">) {
  const { pending } = useFormStatus();
  return <Button {...props} type="submit" pending={pending} />;
}
