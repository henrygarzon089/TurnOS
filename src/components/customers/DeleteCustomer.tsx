"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import { anonymizeCustomer } from "@/lib/actions/customers";

/** REQ-018.6 eliminar datos del cliente (Ley 1581) con doble confirmación. Solo dueño. */
export function DeleteCustomer({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const res = await anonymizeCustomer(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.replace("/app/clientes?eliminado=1");
    });
  }

  return (
    <>
      <button
        type="button"
        className="text-danger min-h-12 w-full text-sm font-semibold underline"
        onClick={() => setOpen(true)}
      >
        Eliminar datos del cliente
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Eliminar datos del cliente"
          className="fixed inset-0 z-30 flex items-end bg-black/40"
        >
          <div className="bg-card flex w-full flex-col gap-3 rounded-t-2xl p-5">
            <p className="text-lg font-bold">¿Eliminar los datos de {name}?</p>
            <p className="text-sm">
              Úsalo solo si el cliente lo pidió (Ley 1581). Se borran su nombre, su celular y las
              notas de la ficha y de todos sus turnos. Las visitas y los montos se conservan para la
              caja, sin datos personales.
            </p>
            <p className="text-danger text-sm font-semibold">Esto no se puede deshacer.</p>
            {error && <ErrorText>{error}</ErrorText>}
            <div className="flex gap-3">
              <button
                type="button"
                className="btn-secondary flex-1"
                onClick={() => {
                  setOpen(false);
                  setError(null);
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-danger flex-1"
                onClick={confirm}
                disabled={pending}
              >
                {pending ? "Eliminando…" : "Sí, eliminar sus datos"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
