"use client";

import { startTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * REQ-078.35: con `<form action>` sola, React 19 limpia el formulario al terminar la acción y los
 * campos vuelven a su `defaultValue` (el valor viejo de la página): parece que no se guardó.
 * Enviar con `onSubmit` + `startTransition` corre la misma acción sin esa limpieza (como T-193).
 * Se deja `action` en el `<form>` para que funcione aún sin JavaScript.
 */
export function keepValuesOnSubmit(action: (data: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
}

/**
 * REQ-078.35: al guardar bien, relee la página (la lista muestra el ítem nuevo) y avisa a quien
 * cierra la hoja. En un efecto: `router.refresh()` durante el render lo puede descartar React
 * ("Cannot update a component while rendering a different component").
 */
export function useRefreshOnOk(state: { ok?: boolean } | undefined | null, onDone?: () => void) {
  const router = useRouter();
  const seen = useRef<unknown>(null);
  useEffect(() => {
    if (!state?.ok || seen.current === state) return;
    seen.current = state;
    router.refresh();
    onDone?.();
  }, [state, router, onDone]);
}
