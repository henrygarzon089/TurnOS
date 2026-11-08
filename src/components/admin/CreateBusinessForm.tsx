"use client";

import { useActionState, useState } from "react";
import { ErrorText } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
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
      <Field
        label="Nombre del negocio"
        name="name"
        required
        minLength={2}
        maxLength={80}
        placeholder="Barbería La 33"
        onChange={(e) => {
          if (!slugTouched) setSlug(slugifyClient(e.target.value));
        }}
      />
      <Field
        label="Enlace de la fila"
        name="slug"
        prefix="/"
        required
        pattern="[a-z0-9-]{3,40}"
        value={slug}
        hint={`Así quedará el QR: tu-dominio/${slug || "mi-negocio"}`}
        onChange={(e) => {
          setSlugTouched(true);
          setSlug(e.target.value.toLowerCase());
        }}
      />
      <Field label="Dirección (opcional)" name="address" maxLength={200} />

      {needsAccount && (
        <fieldset className="border-line mt-2 flex flex-col gap-4 rounded-md border p-4">
          <legend className="px-1 text-sm font-semibold">Tu cuenta de dueño</legend>
          <Field label="Correo" name="email" type="email" autoComplete="email" required />
          <Field
            label="Contraseña (mínimo 8)"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </fieldset>
      )}

      {state?.error && <ErrorText>{state.error}</ErrorText>}
      <Button type="submit" className="mt-2 w-full" pending={pending}>
        Crear negocio
      </Button>
    </form>
  );
}
