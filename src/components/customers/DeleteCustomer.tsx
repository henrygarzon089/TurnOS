"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
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

  function close() {
    setOpen(false);
    setError(null);
  }

  return (
    <>
      <button
        type="button"
        className="text-danger min-h-12 w-full text-base font-semibold underline underline-offset-4"
        onClick={() => setOpen(true)}
      >
        Eliminar datos del cliente
      </button>
      {/* REQ-078.3: lo destructivo en contorno rojo y detrás de una confirmación */}
      <Sheet
        open={open}
        onClose={close}
        title="Eliminar datos del cliente"
        description={`¿Eliminar los datos de ${name}?`}
      >
        <p className="text-base">
          Úsalo solo si el cliente lo pidió (Ley 1581). Se borran su nombre, su celular y las notas
          de la ficha y de todos sus turnos. Las visitas y los montos se conservan para la caja, sin
          datos personales.
        </p>
        <p className="text-danger text-base font-semibold">Esto no se puede deshacer.</p>
        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex flex-col gap-2">
          <Button variant="danger" pending={pending} pendingText="Eliminando…" onClick={confirm}>
            Sí, eliminar sus datos
          </Button>
          <Button variant="secondary" onClick={close}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </>
  );
}
