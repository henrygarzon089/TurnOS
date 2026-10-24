"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import { redeemRewardManually } from "@/lib/actions/customers";

/** REQ-019.5 "Marcar premio como canjeado" (solo dueño, mientras no exista la caja). */
export function RedeemReward({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function redeem() {
    if (!window.confirm("¿Marcar el premio como canjeado? Se abre una tarjeta nueva en cero.")) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await redeemRewardManually(customerId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(true);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <button type="button" className="btn-primary" onClick={redeem} disabled={pending}>
        {pending ? "Guardando…" : "Marcar premio como canjeado"}
      </button>
      {done && (
        <p role="status" className="text-ok text-sm font-medium">
          Premio canjeado. La tarjeta empieza de nuevo.
        </p>
      )}
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
