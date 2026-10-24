"use client";

import { useActionState } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { acceptInvitation, type AcceptState } from "@/lib/actions/public";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AcceptState, FormData>(
    acceptInvitation,
    undefined,
  );
  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <Field label="PIN (6 números)" htmlFor="pin">
        <input
          id="pin"
          name="pin"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoComplete="new-password"
          className="input tracking-[0.5em]"
        />
      </Field>
      <Field label="Repite el PIN" htmlFor="pin2">
        <input
          id="pin2"
          name="pin2"
          type="password"
          inputMode="numeric"
          pattern="\d{6}"
          maxLength={6}
          required
          autoComplete="new-password"
          className="input tracking-[0.5em]"
        />
      </Field>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando acceso…" : "Crear mi acceso"}
      </button>
    </form>
  );
}
