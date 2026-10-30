"use client";

import { startTransition, useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import { updateCustomer, type CustomerFormState, type CustomerView } from "@/lib/actions/customers";
import { MONTH_NAMES } from "@/lib/domain/birthday";

/** REQ-018.5 dueño: nombre y notas; REQ-018.4 barbero: notas y barbero preferido; REQ-037.1 ambos: cumpleaños. */
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

  // Sin `action` en el <form>: React lo reiniciaría y una fecha imposible borraría lo escrito
  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  }

  return (
    <form
      onSubmit={submit}
      className="border-line bg-card flex flex-col gap-3 rounded-xl border p-4"
    >
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
      <fieldset className="min-w-0">
        <legend className="mb-1 text-sm font-medium">Cumpleaños</legend>
        <div className="flex gap-2">
          <label className="flex w-24 flex-col gap-1 text-sm">
            Día
            <input
              name="birthday_day"
              type="text"
              inputMode="numeric"
              maxLength={2}
              defaultValue={c.birthdayDay ?? ""}
              className="input"
            />
          </label>
          <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm">
            Mes
            <select name="birthday_month" defaultValue={c.birthdayMonth ?? ""} className="input">
              <option value="">Sin elegir</option>
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>
      </fieldset>
      {isOwner && (
        <label className="flex min-h-12 items-center gap-3 text-sm font-medium">
          <input
            type="checkbox"
            name="do_not_contact"
            defaultChecked={c.doNotContact}
            className="h-5 w-5"
          />
          No contactar (sin recordatorios ni avisos por WhatsApp)
        </label>
      )}
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
