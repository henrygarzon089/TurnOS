"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field as UiField } from "@/components/ui/Field";
import { PhoneField } from "@/components/ui/PhoneField";
import { PinField } from "@/components/ui/PinField";
import { signInBarber, signInOwner, type AuthFormState } from "@/lib/actions/auth";
import type { PhoneCountry } from "@/lib/domain/phone";

type Tab = "barber" | "owner";

/**
 * Entrar (tablero Acceso): pestañas con subrayado, no rellenas, para que "Entrar" sea el único
 * principal (REQ-078.4). El barbero escribe el PIN en 6 casillas que muestran puntos (REQ-078.7).
 */
export function LoginForm({
  initialTab,
  volver,
  canSignup = false,
}: {
  initialTab: Tab;
  volver?: string;
  /** REQ-080.1: solo con el módulo `signup` encendido se ofrece crear un negocio. */
  canSignup?: boolean;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<PhoneCountry>("co");
  const [pin, setPin] = useState("");
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
      <div role="tablist" aria-label="Tipo de acceso" className="border-line flex border-b">
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
          <input type="hidden" name="phone_country" value={country} />
          <div className="flex flex-col gap-1">
            <PhoneField
              label="Celular"
              name="phone"
              required
              country={country}
              value={phone}
              onChange={setPhone}
            />
            {/* REQ-081.4: el barbero con celular de otro país lo escribe con su indicativo */}
            <button
              type="button"
              onClick={() => {
                setCountry(country === "co" ? "other" : "co");
                setPhone("");
              }}
              className="text-brand flex min-h-12 items-center self-start text-base font-semibold underline underline-offset-4"
            >
              {country === "co" ? "Mi celular no es de Colombia" : "Mi celular es de Colombia"}
            </button>
          </div>
          <PinField
            label="PIN (6 números)"
            name="pin"
            value={pin}
            onChange={setPin}
            error={barberState?.error}
          />
          <Button
            type="submit"
            className="mt-2 w-full"
            pending={barberPending}
            pendingText="Entrando…"
          >
            Entrar
          </Button>
        </form>
      ) : (
        <form action={ownerAction} className="flex flex-col gap-4" aria-label="Entrar como dueño">
          <input type="hidden" name="volver" value={volver ?? ""} />
          <UiField label="Correo" name="email" type="email" autoComplete="email" required />
          <UiField
            label="Contraseña"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
          {ownerState?.error && <ErrorText>{ownerState.error}</ErrorText>}
          <Button
            type="submit"
            className="mt-2 w-full"
            pending={ownerPending}
            pendingText="Entrando…"
          >
            Entrar
          </Button>
          {canSignup && (
            <Link
              href="/crear-negocio"
              className="text-brand flex min-h-12 items-center justify-center text-base font-semibold underline underline-offset-4"
            >
              ¿Nuevo negocio? Crear mi cuenta
            </Link>
          )}
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
      className={`-mb-px min-h-12 flex-1 border-b-2 text-base font-semibold motion-safe:transition-colors motion-safe:duration-150 ${
        active ? "border-brand text-ink" : "text-muted border-transparent"
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
