"use client";

import { useActionState, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { publishPrivacyVersion, type FormState } from "@/lib/actions/admin";

type Version = { version: number; body: string; published_at: string };

export function PrivacyForm({ current, history }: { current?: Version; history: Version[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    publishPrivacyVersion,
    undefined,
  );
  const [editing, setEditing] = useState(false);

  return (
    <div className="mt-4 flex flex-col gap-4">
      {current && !editing && (
        <section className="border-line bg-card rounded-xl border p-4">
          <p className="text-muted text-xs">
            Versión {current.version} · publicada el{" "}
            {new Date(current.published_at).toLocaleDateString("es-CO", {
              timeZone: "America/Bogota",
            })}
          </p>
          <article className="mt-2 text-sm whitespace-pre-wrap">{current.body}</article>
          <button type="button" className="btn-secondary mt-3" onClick={() => setEditing(true)}>
            Publicar una versión nueva
          </button>
        </section>
      )}
      {(editing || !current) && (
        <form action={action} className="flex flex-col gap-3">
          <label htmlFor="body" className="font-semibold">
            Texto del aviso (versión {(current?.version ?? 0) + 1})
          </label>
          <textarea
            id="body"
            name="body"
            rows={12}
            required
            minLength={50}
            defaultValue={current?.body ?? ""}
            className="input min-h-64 py-2 text-sm"
          />
          {state?.error && <ErrorText>{state.error}</ErrorText>}
          {state?.ok && <p className="text-ok text-sm font-medium">Versión publicada.</p>}
          <div className="flex gap-2">
            <button type="submit" className="btn-primary" disabled={pending}>
              {pending ? "Publicando…" : "Publicar"}
            </button>
            {current && (
              <button type="button" className="btn-secondary" onClick={() => setEditing(false)}>
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
      {history.length > 0 && (
        <details className="text-sm">
          <summary className="text-muted cursor-pointer">
            Versiones anteriores ({history.length})
          </summary>
          {history.map((v) => (
            <article key={v.version} className="border-line mt-2 rounded-xl border p-3">
              <p className="text-muted text-xs">Versión {v.version}</p>
              <p className="mt-1 whitespace-pre-wrap">{v.body}</p>
            </article>
          ))}
        </details>
      )}
    </div>
  );
}
