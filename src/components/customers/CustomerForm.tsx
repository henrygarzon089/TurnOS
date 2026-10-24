"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import { updateCustomer, type CustomerFormState, type CustomerView } from "@/lib/actions/customers";

/** REQ-018.5 dueño: nombre y notas; REQ-018.4 barbero: notas y barbero preferido. */
export function CustomerForm({ view }: { view: CustomerView }) {
  const router = useRouter();
  const [seen, setSeen] = useState<CustomerFormState>(undefined);
  const [state, action, pending] = useActionState<CustomerFormState, FormData>(
    updateCustomer,
    undefined,
  );
  if (state?.ok && state !== seen) {
    setSeen(state);
    router.refresh();
  }
  const isOwner = view.viewer.role === "owner";
  const c = view.customer;

  return (
    <form action={action} className="border-line bg-card flex flex-col gap-3 rounded-xl border p-4">
      <input type="hidden" name="id" value={c.id} />
      {isOwner && (
        <label className="flex flex-col gap-1 text-sm font-medium">
          Nombre
          <input name="name" defaultValue={c.name} required maxLength={60} className="input" />
        </label>
      )}
      <label className="flex flex-col gap-1 text-sm font-medium">
        Barbero preferido
        <select
          name="preferred_barber_id"
          defaultValue={c.preferredBarberId ?? ""}
          className="input"
        >
          <option value="">Sin preferido</option>
          {view.barbers.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        Notas
        <textarea
          name="notes"
          defaultValue={c.notes}
          maxLength={500}
          rows={3}
          className="input min-h-24 py-2"
          placeholder="Ej.: corte bajo a los lados, viene con el hijo"
        />
      </label>
      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <div className="flex items-center gap-3">
        <button type="submit" className="btn-primary flex-1" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
        {state?.ok && state === seen && !pending && (
          <span role="status" className="text-ok text-sm font-medium">
            Guardado
          </span>
        )}
      </div>
    </form>
  );
}
