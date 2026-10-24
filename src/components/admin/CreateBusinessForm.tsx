"use client";

import { useActionState, useState } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { createBusiness, type FormState } from "@/lib/actions/admin";

function slugifyClient(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function CreateBusinessForm({ needsAccount }: { needsAccount: boolean }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createBusiness, undefined);
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4">
      <Field label="Nombre del negocio" htmlFor="name">
        <input
          id="name"
          name="name"
          required
          minLength={2}
          maxLength={80}
          className="input"
          placeholder="Barbería La 33"
          onChange={(e) => {
            if (!slugTouched) setSlug(slugifyClient(e.target.value));
          }}
        />
      </Field>
      <Field label="Enlace de la fila" htmlFor="slug">
        <div className="flex items-center gap-1">
          <span className="text-muted text-sm">/</span>
          <input
            id="slug"
            name="slug"
            required
            pattern="[a-z0-9-]{3,40}"
            className="input"
            value={slug}
            onChange={(e) => {
              setSlugTouched(true);
              setSlug(e.target.value.toLowerCase());
            }}
          />
        </div>
        <span className="text-muted text-xs">
          Así quedará el QR: tu-dominio/{slug || "mi-negocio"}
        </span>
      </Field>
      <Field label="Dirección (opcional)" htmlFor="address">
        <input id="address" name="address" maxLength={200} className="input" />
      </Field>

      {needsAccount && (
        <fieldset className="border-line mt-2 flex flex-col gap-4 rounded-xl border p-4">
          <legend className="px-1 text-sm font-semibold">Tu cuenta de dueño</legend>
          <Field label="Correo" htmlFor="email">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="input"
            />
          </Field>
          <Field label="Contraseña (mínimo 8)" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              className="input"
            />
          </Field>
        </fieldset>
      )}

      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Creando…" : "Crear negocio"}
      </button>
    </form>
  );
}
