"use client";

import { useActionState, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { PinField } from "@/components/ui/PinField";
import { acceptInvitation, type AcceptState } from "@/lib/actions/public";

/** El barbero invitado elige su PIN dos veces, en casillas que muestran puntos (REQ-078.7). */
export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(
    acceptInvitation,
    undefined,
  );
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <PinField label="PIN (6 números)" name="pin" value={pin} onChange={setPin} />
      <PinField label="Repite el PIN" name="pin2" value={pin2} onChange={setPin2} />
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <Button type="submit" className="mt-2 w-full" pending={pending}>
        Crear mi acceso
      </Button>
    </form>
  );
}
