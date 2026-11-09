"use client";

import Link from "next/link";
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
  type BirthdaysView,
  type RemindersView,
} from "@/lib/actions/customers";
import { remindRows, type RemindRow } from "@/lib/domain/owner-tables";
import { buildBirthdayLink, buildReminderLink } from "@/lib/notifications/reminder";

/**
 * REQ-078.33 (T-180) Recordar como el tablero: tabla Cliente · Por qué · WhatsApp con quienes
 * cumplen esta semana (REQ-037.4) y los que no vienen hace más de N días (REQ-020.2). El enlace
 * registra el envío (REQ-020.4) y la fila queda "Escrito hoy"; al volver a abrir ya no sale por 7
 * días. "No contactar" (REQ-020.5) pide confirmación en una hoja. `limit` corta la lista (Fidelidad).
 */
export function RemindTable({
  reminders,
  birthdays,
  limit,
  showDays = true,
}: {
  reminders: RemindersView;
  birthdays: BirthdaysView;
  limit?: number;
  showDays?: boolean;
}) {
  const router = useRouter();
  const [days, setDays] = useState(String(reminders.inactiveDays));
  const [written, setWritten] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [asking, setAsking] = useState<{ id: string; name: string } | null>(null);

  const all = remindRows(birthdays.customers, reminders.customers, birthdays.today).filter(
    (r) => !hidden.has(r.id),
  );
  const rows = limit ? all.slice(0, limit) : all;

  function saveDays(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await saveInactiveDays(Number(days));
      if (!r.ok) setError(r.error);
      else router.refresh();
    });
  }

  function link(r: RemindRow) {
    return r.kind === "birthday"
      ? buildBirthdayLink({
          phoneE164: r.phone,
          template: birthdays.template,
          customerName: r.name,
          businessName: birthdays.businessName,
        })
      : buildReminderLink({
          phoneE164: r.phone,
          template: reminders.template,
          customerName: r.name,
          businessName: reminders.businessName,
          queueUrl: reminders.queueUrl,
        });
  }

  const key = (r: RemindRow) => `${r.kind}:${r.id}`;

  return (
    <div className="flex flex-col">
      {showDays && (
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
      )}
      {error && (
        <div className="px-4 pt-3">
          <ErrorText>{error}</ErrorText>
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon="users"
          title="No hay clientes para recordar"
          text={`Nadie cumple años esta semana y todos han venido en los últimos ${reminders.inactiveDays} días (o ya se les escribió). Si quieres ver más, baja los días sin venir.`}
        />
      ) : (
        <table className="w-full text-sm" aria-label="Para recordar">
          <thead className="bg-brand text-brand-ink text-left text-xs">
            <tr>
              <th className="px-4 py-2 font-bold">Cliente</th>
              <th className="px-3 py-2 font-bold">Por qué</th>
              <th className="px-4 py-2">
                <span className="sr-only">WhatsApp</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-line divide-y">
            {rows.map((r) => (
              <tr key={key(r)} data-kind={r.kind}>
                <td className="px-3 py-2 font-bold sm:px-4">{r.name}</td>
                <td className="px-3 py-2">
                  <p className={r.kind === "inactive" ? "text-warn" : ""}>{r.reason}</p>
                  {r.detail && <p className="text-muted text-xs">{r.detail}</p>}
                </td>
                <td className="px-3 py-1 text-right">
                  <div className="flex flex-col items-end sm:flex-row sm:items-center sm:justify-end sm:gap-1">
                    {r.kind === "inactive" && !written.has(key(r)) && (
                      <button
                        type="button"
                        className="text-muted min-h-12 px-2 text-xs font-semibold underline underline-offset-4 disabled:opacity-50"
                        disabled={pending}
                        onClick={() => setAsking({ id: r.id, name: r.name })}
                      >
                        No contactar
                      </button>
                    )}
                    {written.has(key(r)) ? (
                      <span className="text-muted">Escrito hoy</span>
                    ) : (
                      <a
                        className="text-ok inline-flex min-h-12 items-center font-bold underline underline-offset-4"
                        href={link(r)}
                        target="_blank"
                        rel="noopener"
                        aria-label={`${r.kind === "birthday" ? "Saludar" : "Recordar"} por WhatsApp a ${r.name}`}
                        onClick={() => {
                          setWritten((s) => new Set(s).add(key(r)));
                          if (r.kind === "inactive") void logReminder(r.id);
                        }}
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {limit && all.length > limit && (
        <Link
          href="/admin/recordar"
          className="border-line text-ink flex min-h-12 items-center justify-center border-t text-sm font-semibold underline underline-offset-4"
        >
          Ver los {all.length}
        </Link>
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
              if (r.ok) setHidden((h) => new Set(h).add(target.id));
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
