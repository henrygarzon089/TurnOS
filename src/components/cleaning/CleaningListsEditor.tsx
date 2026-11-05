"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveCleaningList, setCleaningEnabled, type ListItem } from "@/lib/actions/cleaning";

type ListKind = "opening" | "closing" | "deep" | "between_clients";
const TITLES: Record<ListKind, string> = {
  opening: "Apertura",
  closing: "Cierre",
  deep: "Limpieza profunda",
  between_clients: "Entre clientes (para la revisión)",
};

/** REQ-060.1: encender o apagar la limpieza. */
export function CleaningSwitch({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  // Cambia al tocarlo; si el servidor no lo guarda, vuelve a como estaba
  const [on, setOn] = useState(enabled);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="border-line bg-card mt-3 rounded-xl border p-3">
      <label className="flex min-h-12 items-center justify-between gap-3">
        <span className="font-semibold">Limpieza activada</span>
        <input
          type="checkbox"
          role="switch"
          className="h-6 w-6"
          checked={on}
          disabled={busy}
          onChange={async (e) => {
            const next = e.target.checked;
            setOn(next);
            setBusy(true);
            setError(null);
            const res = await setCleaningEnabled(next);
            setBusy(false);
            if (!res.ok) {
              setOn(!next);
              setError(res.error);
            } else if (next) {
              // Encendida, la pestaña por defecto es Hoy: quedarse en Listas para revisarlas
              router.replace("/admin/limpieza?pestana=listas");
              router.refresh();
            } else router.refresh();
          }}
        />
      </label>
      <p className="text-muted text-sm">
        Apagada, nadie ve avisos ni botones de limpieza. Al encenderla por primera vez se crean las listas.
      </p>
      {error && (
        <p role="alert" className="text-danger text-sm">
          {error}
        </p>
      )}
    </div>
  );
}

/** REQ-060.3: agregar, renombrar, quitar y ordenar los puntos de una lista. */
function ListEditor({ kind, initial }: { kind: ListKind; initial: ListItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState<{ id: string | null; label: string; key: string }[]>(
    initial.map((i) => ({ ...i, key: i.id })),
  );
  const [added, setAdded] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);

  function move(index: number, delta: number) {
    setItems((prev) => {
      const next = [...prev];
      const [it] = next.splice(index, 1);
      next.splice(index + delta, 0, it);
      return next;
    });
  }

  async function save() {
    setStatus(null);
    const res = await saveCleaningList(
      kind,
      items.map(({ id, label }) => ({ id, label })),
    );
    if (!res.ok) {
      setStatus({ ok: false, text: res.error });
      return;
    }
    setItems(res.data.map((i) => ({ ...i, key: i.id })));
    setStatus({ ok: true, text: "Lista guardada." });
    router.refresh();
  }

  return (
    <section aria-label={TITLES[kind]} className="border-line bg-card mt-3 rounded-xl border p-3">
      <h2 className="font-semibold">{TITLES[kind]}</h2>
      <ol className="mt-2 space-y-2">
        {items.map((it, i) => (
          <li key={it.key} className="flex items-center gap-1">
            <input
              className="input min-w-0 flex-1"
              aria-label={`Punto ${i + 1}`}
              maxLength={80}
              value={it.label}
              onChange={(e) =>
                setItems((prev) => prev.map((x) => (x.key === it.key ? { ...x, label: e.target.value } : x)))
              }
            />
            <button type="button" className="min-h-12 px-2" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
              ↑
            </button>
            <button
              type="button"
              className="min-h-12 px-2"
              aria-label="Bajar"
              disabled={i === items.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
            <button
              type="button"
              className="text-danger min-h-12 px-2 text-sm"
              onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}
            >
              Quitar
            </button>
          </li>
        ))}
      </ol>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!added.trim()) return;
          setItems((prev) => [...prev, { id: null, label: added.trim(), key: crypto.randomUUID() }]);
          setAdded("");
        }}
      >
        <input
          className="input min-w-0 flex-1"
          aria-label={`Nuevo punto de ${TITLES[kind]}`}
          placeholder="Nuevo punto"
          maxLength={80}
          value={added}
          onChange={(e) => setAdded(e.target.value)}
        />
        <button type="submit" className="btn-secondary px-3">
          Agregar
        </button>
      </form>
      <button type="button" className="btn-primary mt-3 w-full" onClick={() => void save()}>
        Guardar lista
      </button>
      {status && (
        <p role={status.ok ? "status" : "alert"} className={`mt-1 text-sm ${status.ok ? "text-ok" : "text-danger"}`}>
          {status.text}
        </p>
      )}
    </section>
  );
}

export function CleaningListsEditor({ lists }: { lists: Record<string, ListItem[]> }) {
  return (
    <>
      {(Object.keys(TITLES) as ListKind[]).map((k) => (
        <ListEditor key={k} kind={k} initial={lists[k] ?? []} />
      ))}
    </>
  );
}
