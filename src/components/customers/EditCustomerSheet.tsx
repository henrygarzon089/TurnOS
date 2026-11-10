"use client";

import { useState } from "react";
import { Sheet } from "@/components/ui/Sheet";
import { CustomerForm } from "@/components/customers/CustomerForm";
import type { CustomerView } from "@/lib/actions/customers";

/** REQ-018.4 el barbero edita nota, preferido y cumpleaños desde el detalle (tablero Barbero-Otros). */
export function EditCustomerSheet({ view }: { view: CustomerView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-brand min-h-12 shrink-0 px-1 text-sm font-semibold underline underline-offset-2"
        aria-label="Editar datos del cliente"
      >
        Editar
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Editar datos">
        <CustomerForm view={view} />
      </Sheet>
    </>
  );
}
