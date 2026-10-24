"use client";

import { useActionState, useState } from "react";
import { signInBarber, signInOwner, type AuthFormState } from "@/lib/actions/auth";

type Tab = "barber" | "owner";

export function LoginForm({ initialTab, volver }: { initialTab: Tab; volver?: string }) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [ownerState, ownerAction, ownerPending] = useActionState<AuthFormState, FormData>(
    signInOwner,
    undefined,
  );
  const [barberState, barberAction, barberPending] = useActionState<AuthFormState, FormData>(
    signInBarber,
    undefined,
  );

  return (
    <div className="mt-6 flex flex-col gap-6">
      <div
        role="tablist"
        aria-label="Tipo de acceso"
        className="border-line flex rounded-xl border p-1"
      >
        <TabButton active={tab === "barber"} onClick={() => setTab("barber")}>
          Soy barbero
        </TabButton>
        <TabButton active={tab === "owner"} onClick={() => setTab("owner")}>
          Soy dueño
        </TabButton>
      </div>

      {tab === "barber" ? (
        <form
          action={barberAction}
          className="flex flex-col gap-4"
          aria-label="Entrar como barbero"
        >
          <input type="hidden" name="volver" value={volver ?? ""} />
          <Field label="Celular" htmlFor="phone">
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="300 123 4567"
              required
              className="input"
            />
          </Field>
          <Field label="PIN (6 números)" htmlFor="pin">
            <input
              id="pin"
              name="pin"
              type="password"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              autoComplete="current-password"
              required
              className="input tracking-[0.5em]"
            />
          </Field>
          {barberState?.error && <ErrorText>{barberState.error}</ErrorText>}
          <button type="submit" className="btn-primary" disabled={barberPending}>
            {barberPending ? "Entrando…" : "Entrar"}
          </button>
        </form>
      ) : (
        <form action={ownerAction} className="flex flex-col gap-4" aria-label="Entrar como dueño">
          <input type="hidden" name="volver" value={volver ?? ""} />
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
          <Field label="Contraseña" htmlFor="password">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="input"
            />
          </Field>
          {ownerState?.error && <ErrorText>{ownerState.error}</ErrorText>}
          <button type="submit" className="btn-primary" disabled={ownerPending}>
            {ownerPending ? "Entrando…" : "Entrar"}
          </button>
          <a href="/crear-negocio" className="text-accent text-center text-sm font-medium">
            ¿Nuevo negocio? Crear mi cuenta
          </a>
        </form>
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`min-h-12 flex-1 rounded-lg text-base font-semibold ${
        active ? "bg-accent text-accent-ink" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <label htmlFor={htmlFor} className="flex flex-col gap-1">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-danger text-sm font-medium">
      {children}
    </p>
  );
}
