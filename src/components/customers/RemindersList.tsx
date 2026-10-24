"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import {
  logReminder,
  saveInactiveDays,
  setDoNotContact,
  type RemindersView,
} from "@/lib/actions/customers";
import { buildReminderLink } from "@/lib/notifications/reminder";

/** REQ-020.1–20.5: clientes para recordar con WhatsApp y "No contactar". */
export function RemindersList({ view }: { view: RemindersView }) {
  const router = useRouter();
  const [days, setDays] = useState(String(view.inactiveDays));
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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
    <div className="mt-4 flex flex-col gap-4">
      <form onSubmit={saveDays} className="flex items-end gap-2">
        <label className="flex flex-1 flex-col gap-1 text-sm font-medium">
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
        <button type="submit" className="btn-secondary" disabled={pending}>
          Aplicar
        </button>
      </form>
      {error && <ErrorText>{error}</ErrorText>}

      {rows.length === 0 ? (
        <p className="text-muted">
          No hay clientes para recordar: todos han venido en los últimos {view.inactiveDays} días o
          ya se les escribió esta semana.
        </p>
      ) : (
        <ul aria-label="Clientes para recordar" className="flex flex-col gap-2">
          {rows.map((c) => (
            <li
              key={c.id}
              className="border-line bg-card flex flex-col gap-2 rounded-xl border p-3"
            >
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-muted text-sm">
                  {c.daysSince} días · {c.visitsCount} {c.visitsCount === 1 ? "visita" : "visitas"}
                  {c.preferredBarberName ? ` · ${c.preferredBarberName}` : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <a
                  className="btn-primary flex-1"
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
                  📲 Recordar por WhatsApp
                </a>
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={pending}
                  onClick={() => {
                    if (!window.confirm(`¿No volver a contactar a ${c.name}?`)) return;
                    setError(null);
                    startTransition(async () => {
                      const r = await setDoNotContact(c.id, true);
                      if (r.ok) hide(c.id);
                      else setError(r.error);
                    });
                  }}
                >
                  No contactar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
