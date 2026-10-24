"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ErrorText, Field } from "@/components/auth/LoginForm";
import { joinQueue } from "@/lib/actions/public";
import { formatCOP } from "@/lib/domain/money";
import { formatPhoneCO, normalizePhoneCO } from "@/lib/domain/phone";
import { estimateNewTicket } from "@/lib/domain/queue-estimate";
import type { PublicBusiness } from "@/lib/queue/public-queue";
import { readPrefs, writePrefs } from "@/lib/storage/customer-prefs";

type Props = { business: PublicBusiness; now: string };

/** REQ-003.1 formulario de 4 campos + aviso de privacidad (REQ-002). */
export function JoinForm({ business, now }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [serviceId, setServiceId] = useState(business.services[0]?.id ?? "");
  const [barberId, setBarberId] = useState<string | null>(null);
  const [privacy, setPrivacy] = useState(false);
  const [alreadyAccepted, setAlreadyAccepted] = useState(false);
  const [error, setError] = useState<{ message: string; field?: string } | null>(null);

  // REQ-003.7 / REQ-002.4: prellenar desde el navegador
  useEffect(() => {
    // Tras hidratar (evita desajuste servidor/cliente): leer el navegador en el siguiente frame
    const id = requestAnimationFrame(() => {
      const p = readPrefs();
      if (p.name) setName(p.name);
      if (p.phone) setPhone(formatPhoneCO(p.phone));
      const v = p.privacyAccepted?.[business.slug];
      if (v && business.privacyVersion && v >= business.privacyVersion) {
        setAlreadyAccepted(true);
        setPrivacy(true);
      }
    });
    return () => cancelAnimationFrame(id);
  }, [business.slug, business.privacyVersion]);

  const service = business.services.find((s) => s.id === serviceId);

  // REQ-017.3: ¿alcanzamos a atenderte hoy?
  const warning = useMemo(() => {
    if (!service || !business.closesAt) return null;
    const est = estimateNewTicket(
      { now: new Date(now), barbers: business.queue.barbers, waiting: business.queue.waiting },
      service.durationMin,
      barberId,
    );
    if (est.waitMin === null) return null;
    const [h, m] = business.closesAt.split(":").map(Number);
    const closes = new Date(now);
    closes.setHours(h, m, 0, 0); // el navegador del cliente está en Colombia
    const minutesLeft = (closes.getTime() - new Date(now).getTime()) / 60_000;
    return est.waitMin + service.durationMin > minutesLeft
      ? "Es posible que no alcancemos a atenderte hoy: la espera supera el tiempo que falta para cerrar."
      : null;
  }, [service, barberId, business, now]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const r = await joinQueue({
        slug: business.slug,
        name,
        phone,
        serviceId,
        preferredBarberId: barberId,
        privacyAccepted: privacy,
        privacyVersion: business.privacyVersion,
        source: "qr",
      });
      if (!r.ok) {
        setError({ message: r.error, field: r.field });
        return;
      }
      const e164 = normalizePhoneCO(phone);
      writePrefs({
        name: name.trim(),
        phone: e164 ?? undefined,
        privacyAccepted: business.privacyVersion
          ? { [business.slug]: business.privacyVersion }
          : undefined,
        lastTicket: { [business.slug]: r.token },
      });
      router.push(`/t/${r.token}${r.existing ? "?ya=1" : ""}`);
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5" aria-label="Tomar turno">
      <Field label="Tu nombre" htmlFor="name">
        <input
          id="name"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={60}
          autoComplete="name"
          className="input"
        />
      </Field>
      <Field label="Tu celular (WhatsApp)" htmlFor="phone">
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="300 123 4567"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="input"
          aria-invalid={error?.field === "phone"}
        />
        {error?.field === "phone" && <ErrorText>{error.message}</ErrorText>}
      </Field>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Servicio</legend>
        <div className="flex flex-col gap-2">
          {business.services.map((s) => (
            <label
              key={s.id}
              className={`border-line bg-card flex min-h-12 cursor-pointer items-center justify-between rounded-xl border px-3 ${serviceId === s.id ? "border-accent ring-2 ring-blue-200" : ""}`}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name="serviceId"
                  value={s.id}
                  checked={serviceId === s.id}
                  onChange={() => setServiceId(s.id)}
                  className="h-5 w-5"
                />
                {s.name} <span className="text-muted text-sm">· {s.durationMin} min</span>
              </span>
              <span className="font-semibold">{formatCOP(s.price)}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-medium">Barbero</legend>
        <div className="flex flex-wrap gap-2">
          <Chip selected={barberId === null} onClick={() => setBarberId(null)}>
            El que esté libre
          </Chip>
          {business.barbersToday.map((b) => {
            const unavailable = b.status === "paused";
            return (
              <Chip
                key={b.id}
                selected={barberId === b.id}
                disabled={unavailable}
                onClick={() => setBarberId(b.id)}
              >
                {b.name}
                {unavailable && <span className="text-muted ml-1 text-xs">(en pausa)</span>}
              </Chip>
            );
          })}
        </div>
        {error?.field === "preferredBarberId" && <ErrorText>{error.message}</ErrorText>}
      </fieldset>

      {warning && (
        <p role="status" className="text-warn rounded-xl bg-amber-50 p-3 text-sm font-medium">
          {warning}
        </p>
      )}

      {alreadyAccepted ? (
        <p className="text-muted text-sm">
          Ya aceptaste nuestra política de datos.{" "}
          <Link href={`/${business.slug}/privacidad`} className="text-accent underline">
            Leerla
          </Link>
        </p>
      ) : (
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="privacyAccepted"
            checked={privacy}
            onChange={(e) => setPrivacy(e.target.checked)}
            className="mt-0.5 h-6 w-6 shrink-0"
          />
          <span>
            Acepto que <strong>{business.name}</strong> use mi nombre y celular para gestionar mi
            turno y contactarme por WhatsApp (Ley 1581 de 2012).{" "}
            <Link
              href={`/${business.slug}/privacidad`}
              className="text-accent underline"
              target="_blank"
            >
              Ver aviso completo
            </Link>
          </span>
        </label>
      )}
      {error?.field === "privacyAccepted" && <ErrorText>{error.message}</ErrorText>}
      {error && !error.field && <ErrorText>{error.message}</ErrorText>}

      <button type="submit" className="btn-primary" disabled={pending || !privacy}>
        {pending ? "Tomando turno…" : "Confirmar turno"}
      </button>
      {!privacy && !alreadyAccepted && (
        <p className="text-muted -mt-3 text-center text-xs">
          Marca la casilla de privacidad para continuar.
        </p>
      )}
    </form>
  );
}

function Chip({
  selected,
  disabled,
  onClick,
  children,
}: {
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      disabled={disabled}
      onClick={onClick}
      className={`min-h-12 rounded-full border px-4 text-base font-medium ${
        selected ? "bg-accent text-accent-ink border-accent" : "border-line bg-card text-ink"
      } disabled:opacity-50`}
    >
      {children}
    </button>
  );
}
