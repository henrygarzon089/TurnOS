"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";
import { EmptyState } from "@/components/ui/States";
import {
  logReminder,
  saveInactiveDays,
  setDoNotContact,
  type RemindersView,
} from "@/lib/actions/customers";
import { buildReminderLink } from "@/lib/notifications/reminder";

/**
 * REQ-020.1–20.5: clientes para recordar con WhatsApp y "No contactar" (con hoja de
 * confirmación, T-166).
 */
export function RemindersList({ view }: { view: RemindersView }) {
  const router = useRouter();
  const [days, setDays] = useState(String(view.inactiveDays));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(null);

  const hide = (id: string) => setHidden((h) => new Set(h).add(id));
  const rows = view.customers.filter((c) => !hidden.has(c.id));

  function saveDays(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await saveInactiveDays(Number(days));
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col">
      <form onSubmit={saveDays} className="border-line flex items-end gap-2 border-b p-4">
        <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
          Días sin venir
          <input
            className="input"
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary" pending={pending}>
          Aplicar
        </Button>
      </form>
      {error && (
        <div className="px-4 pt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="users"
          title="No hay clientes para recordar"
          text={`Todos han venido en los últimos ${view.inactiveDays} días o ya se les escribió esta semana. Si quieres ver más, baja los días sin venir.`}
        />
      ) : (
        <ul aria-label="Clientes para recordar" className="divide-line divide-y">
          {rows.map((c) => (
            <li
              key={c.id}
              className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-bold">{c.name}</p>
                <p className="text-muted text-sm">
                  {c.daysSince} días · {c.visitsCount} {c.visitsCount === 1 ? "visita" : "visitas"}
                  {c.preferredBarberName ? ` · ${c.preferredBarberName}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  className="btn-secondary flex-1 text-base sm:w-auto sm:flex-none"
                  href={buildReminderLink({
                    phoneE164: c.phone,
                    template: view.template,
                    customerName: c.name,
                    businessName: view.businessName,
                    queueUrl: view.queueUrl,
                  })}
                  target="_blank"
                  rel="noopener"
                  onClick={() => {
                    hide(c.id);
                    void logReminder(c.id);
                  }}
                >
                  Recordar por WhatsApp
                </a>
                <Button
                  variant="text"
                  className="text-base"
                  disabled={pending}
                  onClick={() => setAsking({ id: c.id, name: c.name })}
                >
                  No contactar
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Sheet
        open={asking !== null}
        onClose={() => setAsking(null)}
        title={asking ? `¿No volver a contactar a ${asking.name}?` : ""}
        description="Sale de esta lista y de los recordatorios. Se puede volver a activar en su ficha."
      >
        <Button
          variant="secondary"
          className="w-full"
          pending={pending}
          onClick={() => {
            const target = asking!;
            setError(null);
            startTransition(async () => {
              const r = await setDoNotContact(target.id, true);
              if (r.ok) hide(target.id);
              else setError(r.error);
              setAsking(null);
            });
          }}
        >
          Sí, no contactar
        </Button>
        <Button variant="text" className="mx-auto" onClick={() => setAsking(null)}>
          No, dejarlo en la lista
        </Button>
      </Sheet>
    </div>
  );
}
