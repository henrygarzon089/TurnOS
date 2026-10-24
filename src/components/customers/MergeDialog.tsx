"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ErrorText } from "@/components/auth/LoginForm";
import {
  findMergeCandidates,
  mergeCustomers,
  type CustomerListItem,
  type CustomerView,
} from "@/lib/actions/customers";
import { defaultKeepId } from "@/lib/domain/customer-history";

type Candidate = CustomerListItem & { createdAt: string };

/**
 * REQ-018.5 fusionar fichas (design.md §2.6): buscar la otra ficha → elegir qué celular queda →
 * confirmar. La ficha que queda conserva nombre y celular; el historial de ambas se conserva.
 */
export function MergeButton({ view }: { view: CustomerView }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn-secondary w-full" onClick={() => setOpen(true)}>
        Fusionar con otra ficha
      </button>
      {open && <MergeDialog view={view} onClose={() => setOpen(false)} />}
    </>
  );
}

function MergeDialog({ view, onClose }: { view: CustomerView; onClose: () => void }) {
  const router = useRouter();
  const me = view.customer;
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [other, setOther] = useState<Candidate | null>(null);
  const [keepId, setKeepId] = useState<string>(me.id);
  const [error, setError] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();
  const [merging, startMerge] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const timer = setTimeout(() => {
      startSearch(async () => setResults(await findMergeCandidates(q, me.id)));
    }, 250);
    return () => clearTimeout(timer);
  }, [q, me.id]);

  function pick(c: Candidate) {
    setOther(c);
    setKeepId(
      defaultKeepId(
        { id: me.id, lastVisitAt: me.lastVisitAt, createdAt: me.createdAt },
        { id: c.id, lastVisitAt: c.lastVisitAt, createdAt: c.createdAt },
      ),
    );
  }

  function confirm() {
    if (!other) return;
    const mergeId = keepId === me.id ? other.id : me.id;
    setError(null);
    startMerge(async () => {
      const res = await mergeCustomers(keepId, mergeId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onClose();
      if (keepId === me.id) router.refresh();
      else router.replace(`/app/clientes/${keepId}`);
    });
  }

  const options = other
    ? [
        { id: me.id, name: me.name, last4: me.phone.slice(-4) },
        { id: other.id, name: other.name, last4: other.phoneLast4 },
      ]
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Fusionar fichas"
      className="fixed inset-0 z-30 flex items-end bg-black/40"
    >
      <div className="bg-card flex max-h-[90dvh] w-full flex-col gap-3 overflow-y-auto rounded-t-2xl p-5">
        <p className="text-lg font-bold">Fusionar fichas</p>
        <p className="text-muted text-sm">
          Úsalo cuando un cliente cambió de celular. Se junta el historial, las visitas y los sellos
          de fidelidad en una sola ficha.
        </p>

        {!other ? (
          <>
            <label className="flex flex-col gap-1 text-sm font-medium">
              Buscar la otra ficha
              <input
                className="input"
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nombre o últimos números del celular"
                autoComplete="off"
              />
            </label>
            <p className="text-muted min-h-5 text-xs" aria-live="polite">
              {searching ? "Buscando…" : ""}
            </p>
            <ul className="flex flex-col gap-2">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="border-line flex min-h-12 w-full items-center justify-between rounded-xl border px-4 text-left"
                    onClick={() => pick(c)}
                  >
                    <span className="font-medium">{c.name}</span>
                    <span className="text-muted text-sm">
                      ···{c.phoneLast4} · {c.visitsCount} visitas
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">¿Qué celular queda?</legend>
            {options.map((o) => (
              <label
                key={o.id}
                className="border-line flex min-h-12 items-center gap-3 rounded-xl border px-4"
              >
                <input
                  type="radio"
                  name="keep"
                  value={o.id}
                  checked={keepId === o.id}
                  onChange={() => setKeepId(o.id)}
                  className="h-5 w-5"
                  aria-label={`${o.name} ···${o.last4}`}
                />
                <span>
                  <span className="block font-medium">···{o.last4}</span>
                  <span className="text-muted block text-xs">{o.name}</span>
                </span>
              </label>
            ))}
            <p className="text-muted text-xs">
              Queda el nombre de esa ficha. Las notas se unen y las visitas se suman.
            </p>
          </fieldset>
        )}

        {error && <ErrorText>{error}</ErrorText>}
        <div className="flex gap-3">
          <button type="button" className="btn-secondary flex-1" onClick={onClose}>
            Cancelar
          </button>
          {other && (
            <button
              type="button"
              className="btn-danger flex-1"
              onClick={confirm}
              disabled={merging}
            >
              {merging ? "Fusionando…" : "Fusionar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
