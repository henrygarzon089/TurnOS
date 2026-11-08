"use client";

import { useEffect, useId, useRef } from "react";

/**
 * Hoja inferior (celular; centrada y angosta en pantallas grandes) y diálogo (escritorio) sobre
 * `<dialog>` nativo (design §22.3): el navegador encierra el foco, Esc cierra y el fondo queda
 * inerte. Deslizar la manija hacia abajo también cierra. Al abrir, el foco va al primer
 * campo (`autoFocus`) o al primer control. Confirmación de lo destructivo (REQ-078.3).
 * Entrada: la hoja sube (250 ms) y el diálogo aparece con escala .98 (200 ms); con movimiento
 * reducido, solo opacidad (REQ-078.13, globals.css).
 */
type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Texto corto bajo el título: qué pasa si se confirma. */
  description?: React.ReactNode;
  children: React.ReactNode;
};

function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      const first = el.querySelector<HTMLElement>(
        "[autofocus], input:not([type=hidden]), select, textarea, button",
      );
      first?.focus();
    }
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Esc dispara "cancel": se cierra por el estado del dueño, no por el navegador
    const cancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener("cancel", cancel);
    return () => el.removeEventListener("cancel", cancel);
  }, [onClose]);
  return ref;
}

export function Sheet({ open, onClose, title, description, children }: Props) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  const drag = useRef<number | null>(null);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="bg-card text-ink shadow-overlay backdrop:bg-ink/60 animate-sheet-in fixed inset-x-0 top-auto bottom-0 m-0 max-h-[90dvh] w-full max-w-none overflow-y-auto rounded-t-lg p-0 pb-[env(safe-area-inset-bottom)] sm:mx-auto sm:max-w-lg"
    >
      {open && (
        <div className="flex flex-col gap-4 px-5 pt-3 pb-5">
          <div
            aria-hidden="true"
            className="bg-line-strong mx-auto h-1.5 w-10 shrink-0 cursor-grab touch-none rounded-full lg:hidden"
            onPointerDown={(e) => (drag.current = e.clientY)}
            onPointerUp={(e) => {
              if (drag.current !== null && e.clientY - drag.current > 60) onClose();
              drag.current = null;
            }}
          />
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {description && <div className="text-muted mt-1 text-base">{description}</div>}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

export function Dialog({ open, onClose, title, description, children }: Props) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="bg-card text-ink shadow-overlay backdrop:bg-ink/60 animate-dialog-in m-auto w-[min(28rem,calc(100%-2rem))] rounded-md p-0"
    >
      {open && (
        <div className="flex flex-col gap-4 p-6">
          <div>
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            {description && <div className="text-muted mt-1 text-base">{description}</div>}
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
