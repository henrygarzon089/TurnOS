"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";

/** REQ-023.4 / REQ-024.2 "Nueva venta": productos o servicios sin turno. */
export function NewSaleButton({ onSaved }: { onSaved?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className="btn-secondary"
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
      >
        + Nueva venta
      </button>
      {notice && (
        <p role="status" className="text-ok mt-2 rounded-xl bg-green-50 p-3 text-sm font-medium">
          {notice}
        </p>
      )}
      {open && (
        <CheckoutSheet
          ticketId={null}
          onClose={() => setOpen(false)}
          onDone={(msg) => {
            setOpen(false);
            setNotice(msg.replace("Cobro registrado", "Venta registrada"));
            onSaved?.();
            router.refresh();
          }}
        />
      )}
    </>
  );
}
