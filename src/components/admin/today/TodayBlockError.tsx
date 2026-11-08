"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

/**
 * REQ-076.10: el bloque que falla dice "No se pudo cargar" y ofrece reintentar; los demás bloques
 * siguen visibles (por eso no es un `error.tsx`, que tumbaría toda la página).
 */
export function TodayBlockError() {
  const router = useRouter();
  return (
    <div role="alert" className="flex flex-col items-start gap-3 p-4">
      <p className="text-ink font-semibold">
        No se pudo cargar. <span className="text-muted font-normal">Puede ser la señal.</span>
      </p>
      <Button variant="secondary" onClick={() => router.refresh()}>
        Intentar de nuevo
      </Button>
    </div>
  );
}
