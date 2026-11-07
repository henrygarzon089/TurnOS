"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckoutSheet } from "@/components/cash/CheckoutSheet";
import { Toast } from "@/components/ui/Toast";

/**
 * REQ-023.4 / REQ-024.2 "Nueva venta": productos o servicios sin turno. En "Hoy" (REQ-076.8) va
 * como botón principal y el aviso sale como `Toast`, porque el botón vive en una barra fija.
 */
export function NewSaleButton({
  onSaved,
  className = "btn-secondary",
  toast = false,
}: {
  onSaved?: () => void;
  className?: string;
  toast?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <>
      <button
        type="button"
        className={className}
        onClick={() => {
          setNotice(null);
          setOpen(true);
        }}
      >
        + Nueva venta
      </button>
      {notice && toast && <Toast onClose={() => setNotice(null)}>{notice}</Toast>}
      {notice && !toast && (
        <p role="status" className="text-ok bg-ok-soft mt-2 rounded-md p-3 text-sm font-medium">
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
